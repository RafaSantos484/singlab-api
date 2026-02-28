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
   * @throws {NotFoundException} Song not found or doesn't belong to user
   * @throws {ConflictException} Separation already exists on this song
   * @throws {ServiceUnavailableException} Provider is temporarily unavailable
   * @throws {BadGatewayException} Provider returned an error during submission
   * @throws {InternalServerErrorException} Unexpected error during processing
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
      const data = await provider.requestSeparation(audioUrl, song.title);

      // Update song document with separation info
      await this.songsService.updateSongSeparationInfo(
        userId,
        songId,
        provider.name,
        data,
      );

      this.logger.log(
        `Separation submitted successfully for song ${songId} (provider=${provider.name})`,
      );

      return data;
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
}
