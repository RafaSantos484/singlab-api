import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Bucket } from '@google-cloud/storage';
import { StemSeparationProviderFactory } from './providers/stem-separation-provider.factory';
import { SongsService } from '../songs/songs.service';
import {
  DomainError,
  SeparationConflictError,
  SeparationProviderError,
  SongNotFoundError,
} from '../../common/errors';
import { FirebaseAdminProvider } from '../../auth/firebase-admin.provider';
import type { SeparatedSongStems } from '../songs/songs.service';

@Injectable()
export class SeparationsService {
  private readonly logger = new Logger(SeparationsService.name);
  private readonly bucket: Bucket;

  constructor(
    private readonly providerFactory: StemSeparationProviderFactory,
    private readonly songsService: SongsService,
    firebaseAdminProvider: FirebaseAdminProvider,
  ) {
    this.bucket = firebaseAdminProvider.getBucket();
  }

  /**
   * Submit stem separation request to provider.
   *
   * Orchestrates the separation flow:
   * 1. Gets provider instance from factory
   * 2. Fetches and validates song ownership
   * 3. Checks if separation already exists (allows retry if status is 'failed')
   * 4. Extracts audio URL from song document
   * 5. Submits separation request to provider
   * 6. Updates song document with separation info
   * 7. Handles provider-specific errors
   *
   * If a previous separation attempt failed, this method allows automatic retry
   * without requiring manual deletion. For other statuses (not_started, processing,
   * finished), a conflict error is thrown.
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

    // Check if separation already exists and validate state
    if (song.separatedSongInfo) {
      const taskStatus = provider.getTaskStatus(
        song.separatedSongInfo.providerData,
      );

      // Allow automatic retry if previous attempt failed.
      // This provides resilience against transient provider errors without
      // requiring manual deletion. For other states (not_started, processing,
      // finished), we enforce conflict to prevent accidental overwrites.
      if (taskStatus !== 'failed') {
        this.logger.warn(
          `Separation already exists for song ${songId} with status '${taskStatus}', cannot create a new one`,
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

      this.logger.log(
        `Previous separation attempt failed for song ${songId}, retrying with provider ${provider.name}`,
      );
    }

    const audioUrl = await this.songsService.createSignedUrlForPath(
      song.rawSongInfo.path,
    );
    try {
      const separateTaskData = await provider.requestSeparation(
        audioUrl,
        song.title,
      );

      // Update song document with separation info
      await song.updateSeparatedSongInfo({
        provider: provider.name,
        providerData: separateTaskData,
        stems: null,
      });

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

  /**
   * Refresh separation task status from the provider.
   *
   * Fetches the latest task detail from the provider and persists it to
   * `separatedSongInfo.providerData`. Short-circuits if the task is already
   * marked as finished to avoid unnecessary API calls.
   *
   * Stem storage paths are NOT managed here. The client is responsible for
   * downloading stems from the provider and uploading them to Firebase Storage,
   * then calling `updateSeparationStems` to persist the paths.
   *
   * @param userId - ID of the authenticated user
   * @param songId - ID of the song
   * @param providerName - Optional provider identifier (defaults to first available)
   * @returns Provider-specific task detail
   * @throws {SongNotFoundError} Song not found or doesn't belong to user
   * @throws {SeparationProviderError} No task ID found or provider fetch failed
   */
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

    // Short-circuit if task is already finished to avoid unnecessary API calls.
    // The provider's getTaskStatus() normalizes provider-specific statuses
    // to the generic four-state model (not_started, processing, finished, failed).
    if (
      provider.getTaskStatus(song.separatedSongInfo?.providerData) ===
      'finished'
    ) {
      this.logger.log(
        `Separation task for song ${songId} is already finished according to provider ${provider.name}`,
      );
      return song.separatedSongInfo?.providerData;
    }

    const taskId = provider.getTaskId(song.separatedSongInfo?.providerData);
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

      // Update song with provider data only.
      // Client is responsible for downloading stems and uploading to storage.
      await song.updateSeparatedSongInfo({
        provider: provider.name,
        providerData: detail,
      });

      this.logger.log(
        `Updated separation status for song ${songId} (task=${taskId}, status=${provider.getTaskStatus(detail)})`,
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

  /**
   * Update the stems for an existing separation.
   *
   * Called by the client after uploading stems to Firebase Storage.
   * Persists the stem storage paths to the song document.
   *
   * @param userId - User ID
   * @param songId - Song ID
   * @param stemPaths - Record of stem names to storage paths
   * @param providerName - Optional provider identifier
   * @throws {SongNotFoundError} Song not found or doesn't belong to user
   * @throws {SeparationProviderError} No separation exists for this song
   * @throws {BadRequestException} Stem files not found in storage
   */
  async updateSeparationStems(
    userId: string,
    songId: string,
    stemPaths: Record<string, string>,
    providerName?: string,
  ): Promise<void> {
    const provider = this.providerFactory.getProvider(providerName);

    const song = await this.songsService.getSongById(userId, songId);
    if (!song) {
      throw new SongNotFoundError(`Song with ID ${songId} not found`, {
        songId,
        userId,
      });
    }

    if (!song.separatedSongInfo) {
      throw new SeparationProviderError('No separation exists for this song', {
        songId,
        userId,
        provider: provider.name,
      });
    }

    // Validate that all stem files exist in storage before updating the document
    const validationResults = await Promise.all(
      Object.entries(stemPaths).map(async ([stemName, storagePath]) => {
        try {
          const [exists] = await this.bucket.file(storagePath).exists();
          if (!exists) {
            this.logger.warn(
              `Stem file ${stemName} not found at ${storagePath} for song ${songId}`,
            );
            return { stemName, exists: false, path: storagePath };
          }
          return { stemName, exists: true, path: storagePath };
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(
            `Failed to verify stem ${stemName} at ${storagePath}: ${errorMsg}`,
          );
          return { stemName, exists: false, path: storagePath };
        }
      }),
    );

    const missingStems = validationResults.filter((r) => !r.exists);
    if (missingStems.length > 0) {
      const missingPaths = missingStems.map((s) => s.path).join(', ');
      throw new BadRequestException(
        `Stem files not found in storage: ${missingPaths}. Upload the files before updating the document.`,
      );
    }

    const now = new Date().toISOString();

    // All stems validated - update song with stems only (preserve existing providerData)
    await song.updateSeparatedSongInfo({
      provider: provider.name,
      stems: {
        uploadedAt: now,
        paths: stemPaths,
      },
    });

    this.logger.log(
      `Updated ${Object.keys(stemPaths).length} stems for song ${songId}`,
    );
  }

  /**
   * Process stem URLs by downloading and uploading to storage.
   *
   * Downloads each stem from provider URLs and uploads to Firebase Storage,
   * storing only the path. Signed URLs are generated on-demand when needed.
   *
   * @deprecated This method is kept for reference only. Stem processing is now the client's responsibility.
   * @param userId - User ID
   * @param songId - Song ID
   * @param stemUrls - Record of stem names to download URLs
   * @returns Stem metadata with upload time and storage paths
   */
  private async processStemUrls(
    userId: string,
    songId: string,
    stemUrls: Record<string, string>,
  ): Promise<SeparatedSongStems> {
    const now = new Date().toISOString();

    const uploadResults = await Promise.all(
      Object.entries(stemUrls).map(async ([stemName, stemUrl]) => {
        try {
          this.logger.debug(
            `Processing stem ${stemName} for song ${songId}...`,
          );

          const stemBuffer = await this.downloadStem(stemUrl);

          const storagePath = `users/${userId}/songs/${songId}/stems/${stemName}.mp3`;
          await this.uploadStemToStorage(stemBuffer, storagePath);

          this.logger.debug(
            `Successfully processed stem ${stemName} for song ${songId}`,
          );

          return { stemName, storagePath };
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(
            `Failed to process stem ${stemName} for song ${songId}: ${errorMsg}`,
          );
          return null;
        }
      }),
    );

    const paths = uploadResults.reduce<Record<string, string>>(
      (acc, result) => {
        if (result) {
          acc[result.stemName] = result.storagePath;
        }
        return acc;
      },
      {},
    );

    return {
      uploadedAt: now,
      paths,
    };
  }

  /**
   * Download stem audio file from URL.
   *
   * @param url - URL of the stem file
   * @returns Buffer containing the downloaded file
   * @throws Error if download fails
   */
  private async downloadStem(url: string): Promise<Buffer> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to download stem: ${errorMsg}`);
    }
  }

  /**
   * Upload stem buffer to Firebase Storage.
   *
   * @param buffer - File content
   * @param storagePath - Target storage path
   * @throws Error if upload fails
   */
  private async uploadStemToStorage(
    buffer: Buffer,
    storagePath: string,
  ): Promise<void> {
    try {
      const file = this.bucket.file(storagePath);
      await file.save(buffer, {
        metadata: {
          contentType: 'audio/mpeg',
        },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to upload stem to storage: ${errorMsg}`);
    }
  }

  /**
   * Stateless proxy: Submit separation request directly to provider.
   *
   * This method acts as a pure proxy to the separation provider.
   * It does NOT interact with Firestore — that is the caller's responsibility.
   *
   * @param audioUrl - Signed URL of the audio file
   * @param title - Song title for provider metadata
   * @param providerName - Optional provider identifier
   * @returns Provider-specific task metadata
   * @throws {SeparationProviderError} Provider failed during submission
   */
  async submitSeparationProxy(
    audioUrl: string,
    title: string,
    providerName?: string,
  ): Promise<unknown> {
    const provider = this.providerFactory.getProvider(providerName);

    try {
      const task = await provider.requestSeparation(audioUrl, title);
      return task;
    } catch (error) {
      if (error instanceof SeparationProviderError) {
        throw error;
      }

      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new SeparationProviderError(
        `Failed to submit separation request to provider ${provider.name}: ${errorMsg}`,
        {
          provider: provider.name,
          originalError: errorMsg,
        },
      );
    }
  }

  /**
   * Stateless proxy: Refresh task status directly from provider.
   *
   * This method acts as a pure proxy to the separation provider.
   * It does NOT interact with Firestore — that is the caller's responsibility.
   *
   * @param taskId - Provider-specific task identifier
   * @param providerName - Optional provider identifier
   * @returns Provider-specific task detail with current status
   * @throws {SeparationProviderError} Provider failed during refresh
   */
  async refreshSeparationStatusProxy(
    taskId: string,
    providerName?: string,
  ): Promise<unknown> {
    const provider = this.providerFactory.getProvider(providerName);

    try {
      const detail = await provider.getTaskDetail(taskId);
      return detail;
    } catch (error) {
      if (error instanceof SeparationProviderError) {
        throw error;
      }

      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new SeparationProviderError(
        `Failed to refresh separation status from provider ${provider.name}: ${errorMsg}`,
        {
          provider: provider.name,
          originalError: errorMsg,
        },
      );
    }
  }
}
