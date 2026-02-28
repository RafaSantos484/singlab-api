import { HttpException, Injectable, Logger } from '@nestjs/common';
import { StemSeparationProviderFactory } from './providers/stem-separation-provider.factory';
import { SongsService } from '../songs/songs.service';
import {
  DomainError,
  SeparationConflictError,
  SeparationProviderError,
  SongNotFoundError,
} from '../../common/errors';

@Injectable()
export class SeparationsService {
  private readonly logger = new Logger(SeparationsService.name);

  constructor(
    private readonly providerFactory: StemSeparationProviderFactory,
    private readonly songsService: SongsService,
  ) {}

  /**
   * Submit stem separation request to provider.
   *
   * Orchestrates the separation flow:
   * 1. Gets provider instance from factory
   * 2. Fetches and validates song ownership
   * 3. Checks if separation already exists
   * 4. Extracts audio URL from song document
   * 5. Submits separation request to provider
   * 6. Updates song document with separation info
   * 7. Handles provider-specific errors
   *
   * @param userId - ID of the authenticated user
   * @param songId - ID of the song to separate
   * @param providerName - Optional provider identifier (defaults to first available)
   * @returns Provider-specific task metadata (format varies by provider)
   * @throws {SongNotFoundError} Song not found or doesn't belong to user
   * @throws {SeparationConflictError} Separation already exists on this song
   * @throws {SeparationProviderError} Provider failed during submission
   */
  async submitSeparation(
    userId: string,
    songId: string,
    providerName?: string,
  ): Promise<unknown> {
    const provider = this.providerFactory.getProvider(providerName);

    const song = await this.songsService.getSongById(userId, songId);
    if (!song) {
      throw new SongNotFoundError(`Song with ID ${songId} not found`, {
        songId,
        userId,
      });
    }

    // Check if separation already exists
    if (song.separatedSongInfo) {
      this.logger.warn(
        `Separation already exists for song ${songId}, cannot create a new one`,
      );
      throw new SeparationConflictError(
        'This song already has a separation. Delete it first before creating a new one.',
        {
          songId,
          userId,
          provider: provider.name,
        },
      );
    }

    const audioUrl = song.rawSongInfo.urlInfo.value;
    try {
      const separateTaskData = await provider.requestSeparation(
        audioUrl,
        song.title,
      );

      // Update song document with separation info
      await song.updateSeparatedSongInfo(provider.name, separateTaskData);

      this.logger.log(
        `Separation submitted successfully for song ${songId} (provider=${provider.name})`,
      );

      return separateTaskData;
    } catch (error) {
      if (error instanceof DomainError || error instanceof HttpException) {
        throw error;
      }

      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to submit separation for song ${songId} with provider ${provider.name}: ${errorMsg}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new SeparationProviderError(
        'Failed to submit separation for this song',
        {
          provider: provider.name,
          songId,
          userId,
        },
      );
    }
  }

  async refreshSeparationStatus(
    userId: string,
    songId: string,
    providerName?: string,
  ): Promise<unknown> {
    const provider = this.providerFactory.getProvider(providerName);

    const song = await this.songsService.getSongById(userId, songId);
    if (!song) {
      throw new SongNotFoundError(`Song with ID ${songId} not found`, {
        songId,
        userId,
      });
    }

    if (provider.isTaskFinished(song.separatedSongInfo?.data)) {
      this.logger.log(
        `Separation task for song ${songId} is already finished according to provider ${provider.name}`,
      );
      return song.separatedSongInfo?.data;
    }

    const taskId = provider.getTaskId(song.separatedSongInfo?.data);
    if (!taskId) {
      this.logger.warn(
        `No valid task ID found for song ${songId} with provider ${provider.name}, cannot refresh status`,
      );
      throw new SeparationProviderError(
        'Cannot refresh separation status due to missing task identifier',
        {
          provider: provider.name,
          songId,
          userId,
        },
      );
    }

    try {
      const detail = await provider.getTaskDetail(taskId);
      await song.updateSeparatedSongInfo(provider.name, detail);

      this.logger.log(
        `Updated separation status for song ${songId} (task=${taskId})`,
      );

      return detail;
    } catch (error) {
      if (error instanceof DomainError || error instanceof HttpException) {
        throw error;
      }

      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to refresh separation status for song ${songId}: ${errorMsg}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new SeparationProviderError('Failed to refresh separation status', {
        provider: provider.name,
        songId,
        taskId,
      });
    }
  }
}
