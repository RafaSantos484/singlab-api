import { HttpException, Injectable, Logger } from '@nestjs/common';
import { StemSeparationProviderFactory } from './providers/stem-separation-provider.factory';
import { DomainError, SeparationProviderError } from '../../common/errors';

/**
 * Service that mediates between the frontend and external stem
 * separation providers (e.g. PoYo).
 *
 * No Firestore or Storage interaction — the backend simply forwards
 * requests to the provider and returns raw responses. The frontend
 * is responsible for persisting task metadata and stem paths.
 */
@Injectable()
export class SeparationsService {
  private readonly logger = new Logger(SeparationsService.name);

  constructor(
    private readonly providerFactory: StemSeparationProviderFactory,
  ) {}

  /**
   * Submit a stem separation request to the configured provider.
   *
   * @param audioUrl - Public URL of the audio file to separate.
   * @param title - Song title for provider metadata.
   * @param providerName - Optional provider identifier (defaults to first available).
   * @returns Provider-specific task metadata (format varies by provider).
   * @throws {SeparationProviderError} Provider failed during submission.
   * @throws {SeparationProviderUnavailableError} Provider is unavailable.
   */
  async submitSeparation(
    audioUrl: string,
    title: string,
    providerName?: string,
  ): Promise<unknown> {
    const provider = this.providerFactory.getProvider(providerName);

    try {
      const taskData = await provider.requestSeparation(audioUrl, title);

      this.logger.log(
        `Separation submitted successfully (provider=${provider.name})`,
      );

      return taskData;
    } catch (error) {
      if (error instanceof DomainError || error instanceof HttpException) {
        throw error;
      }

      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to submit separation with provider ${provider.name}: ${errorMsg}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new SeparationProviderError('Failed to submit separation request', {
        provider: provider.name,
      });
    }
  }

  /**
   * Retrieve the current status of a separation task from the provider.
   *
   * @param taskId - Provider-specific task identifier.
   * @param providerName - Optional provider identifier (defaults to first available).
   * @returns Provider-specific task detail including status and stem URLs when finished.
   * @throws {SeparationProviderError} Provider fetch failed.
   * @throws {SeparationTaskNotFoundError} Task not found.
   */
  async getSeparationStatus(
    taskId: string,
    providerName?: string,
  ): Promise<unknown> {
    const provider = this.providerFactory.getProvider(providerName);

    try {
      const detail = await provider.getTaskDetail(taskId);

      this.logger.log(
        `Retrieved separation status (task=${taskId}, status=${provider.getTaskStatus(detail)}, provider=${provider.name})`,
      );

      return detail;
    } catch (error) {
      if (error instanceof DomainError || error instanceof HttpException) {
        throw error;
      }

      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to get separation status for task ${taskId}: ${errorMsg}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new SeparationProviderError(
        'Failed to retrieve separation status',
        { provider: provider.name, taskId },
      );
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
