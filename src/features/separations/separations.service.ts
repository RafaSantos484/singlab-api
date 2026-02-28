import {
  BadGatewayException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { StemSeparationProviderFactory } from './providers/stem-separation-provider.factory';
import {
  SeparationConflictError,
  SeparationProviderError,
  SeparationProviderUnavailableError,
} from './providers/separation-provider.errors';
import { SongsService } from '../songs/songs.service';

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
   * 3. Extracts audio URL from song document
   * 4. Submits separation request to provider
   * 5. Handles provider-specific errors
   *
   * @param userId - ID of the authenticated user
   * @param songId - ID of the song to separate
   * @param providerName - Optional provider identifier (defaults to first available)
   * @returns Provider-specific task metadata (format varies by provider)
   * @throws {NotFoundException} Song not found or doesn't belong to user
   * @throws {ConflictException} Separation already exists with this provider
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
      throw new NotFoundException(`Song with ID ${songId} not found`);
    }

    const audioUrl = song.rawSongInfo.urlInfo.value;
    try {
      const task = await provider.requestSeparation(audioUrl, song.title);

      return task;
    } catch (error) {
      this.handleProviderError(error, provider.name);
    }
  }

  /**
   * Convert provider-specific errors into appropriate HTTP exceptions.
   *
   * Maps separation provider errors to NestJS HTTP exceptions:
   * - SeparationConflictError → 409 Conflict
   * - SeparationProviderUnavailableError → 503 Service Unavailable
   * - SeparationProviderError → 502 Bad Gateway
   * - Other errors → 500 Internal Server Error
   *
   * @param error - Error thrown by provider
   * @param providerName - Name of the provider for logging
   * @throws {ConflictException} When separation already exists
   * @throws {ServiceUnavailableException} When provider is unavailable
   * @throws {BadGatewayException} When provider returns an error
   * @throws {InternalServerErrorException} For unexpected errors
   */
  private handleProviderError(error: unknown, providerName: string): never {
    if (error instanceof SeparationConflictError) {
      this.logger.warn(`Separation conflict from provider=${providerName}`);
      throw new ConflictException(
        'A separation for this audio already exists with the provider',
      );
    }

    if (error instanceof SeparationProviderUnavailableError) {
      this.logger.warn(
        `Separation provider unavailable (provider=${providerName})`,
      );
      throw new ServiceUnavailableException(
        'Stem separation provider is currently unavailable. Please retry later.',
      );
    }

    if (error instanceof SeparationProviderError) {
      this.logger.warn(`Separation provider error (provider=${providerName})`);
      throw new BadGatewayException(
        'Stem separation provider returned an error while submitting the task',
      );
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    this.logger.error(
      `Unexpected separation submission failure (provider=${providerName}): ${message}`,
    );
    throw new InternalServerErrorException('Failed to submit separation task');
  }
}
