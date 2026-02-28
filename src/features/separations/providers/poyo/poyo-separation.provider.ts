import { Injectable, Logger } from '@nestjs/common';
import { Env } from '../../../../config/env.config';
import type { StemSeparationProvider } from '../stem-separation-provider.interface';
import type {
  PoyoSeparationTaskDetails,
  PoyoSeparationStatus,
} from './poyo-separation.types';
import {
  DomainError,
  SeparationConflictError,
  SeparationProviderError,
  SeparationProviderUnavailableError,
  SeparationTaskNotFoundError,
} from '../../../../common/errors';

type PoyoTaskStatus = PoyoSeparationStatus;

/**
 * PoYo separation model options.
 * Defines available AI models for vocal separation.
 */
enum PoyoSeparationModelName {
  Base = 'base',
  Enhanced = 'enhanced',
  Instrumental = 'instrumental',
}

/**
 * PoYo output type options.
 * Specifies which stem(s) to extract from the audio.
 */
enum PoyoSeparationOutputType {
  General = 'general',
  Bass = 'bass',
  Drums = 'drums',
  Other = 'other',
  Piano = 'piano',
  Guitar = 'guitar',
  Vocals = 'vocals',
}

/**
 * PoYo API response format for task submission.
 */
interface PoyoSubmitResponse {
  code: 200;
  data: {
    task_id: string;
    status: PoyoTaskStatus;
    created_time: string;
  };
}

interface PoyoDetailResponse {
  code: number;
  data: PoyoSeparationTaskDetails;
}

/**
 * PoYo stem separation provider implementation.
 *
 * Submits separation tasks to PoYo AI service API.
 * Currently hardcoded to use 'base' model and 'general' output type.
 *
 * @see https://api.poyo.ai/docs
 */
@Injectable()
export class PoyoStemSeparationProvider implements StemSeparationProvider {
  readonly name = 'poyo';

  private static readonly CONFLICT_STATUS = 409;
  private static readonly INTERNAL_SERVER_ERROR_STATUS = 500;
  private static readonly DETAIL_TIMEOUT_MS = 10_000;
  private static readonly DETAIL_ENDPOINT = '/api/generate/detail/music';
  private static readonly SUBMIT_ENDPOINT = '/api/generate/submit';
  private readonly logger = new Logger(PoyoStemSeparationProvider.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    try {
      this.apiKey = Env.poyoApiKey;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Missing PoYo API key';
      throw new Error(
        `PoYo separation provider initialization failed: ${message}`,
      );
    }
    this.baseUrl = Env.poyoApiBaseUrl;
  }

  isTaskFinished(taskData?: PoyoSeparationTaskDetails): boolean {
    return taskData?.status === 'finished';
  }

  getTaskId(taskData?: PoyoSeparationTaskDetails): string | undefined {
    return taskData?.task_id;
  }

  /**
   * Submit separation task to PoYo API.
   *
   * Sends POST request to `/api/generate/submit` endpoint with hardcoded configuration:
   * - Model: 'base'
   * - Output type: 'general'
   *
   * @param audioUrl - Public URL of audio file to separate
   * @param title - Song title for provider metadata
   * @returns PoYo task data containing task_id and created_time
   * @throws {SeparationConflictError} HTTP 409 - separation already exists
   * @throws {SeparationProviderUnavailableError} HTTP 500+ or timeout
   * @throws {SeparationProviderError} Other HTTP error responses
   */
  async requestSeparation(audioUrl: string, title: string): Promise<unknown> {
    const url = new URL(
      PoyoStemSeparationProvider.SUBMIT_ENDPOINT,
      this.baseUrl,
    ).toString();

    const requestBody = {
      model: 'upload-and-separate-vocals',
      // callback_url: params.callbackUrl,
      input: {
        audio_url: audioUrl,
        title,
        model_name: PoyoSeparationModelName.Base,
        output_type: PoyoSeparationOutputType.General,
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.buildAuthHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        if (response.status === PoyoStemSeparationProvider.CONFLICT_STATUS) {
          throw new SeparationConflictError(
            'A separation task for this song already exists with PoYo',
            {
              provider: this.name,
              status: response.status,
            },
          );
        }

        if (
          response.status >=
          PoyoStemSeparationProvider.INTERNAL_SERVER_ERROR_STATUS
        ) {
          throw new SeparationProviderUnavailableError(
            'PoYo separation provider is currently unavailable',
            {
              provider: this.name,
              status: response.status,
            },
          );
        }

        throw new SeparationProviderError('Failed to submit separation task', {
          provider: this.name,
          status: response.status,
        });
      }

      const payload = (await response.json()) as PoyoSubmitResponse;
      payload.data.status = 'not_started';
      return payload.data;
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error submitting separation task to PoYo: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new SeparationProviderUnavailableError(
        'PoYo separation provider is currently unavailable',
        { provider: this.name },
      );
    }
  }

  async getTaskDetail(taskId: string): Promise<PoyoSeparationTaskDetails> {
    const url = new URL(
      PoyoStemSeparationProvider.DETAIL_ENDPOINT,
      this.baseUrl,
    );
    url.searchParams.set('task_id', taskId);

    try {
      const response = await this.fetchWithTimeout(url.toString(), {
        method: 'GET',
        headers: this.buildAuthHeaders(),
      });

      if (!response.ok) {
        if ([400, 404].includes(response.status)) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          throw new SeparationTaskNotFoundError('Separation task not found', {
            provider: this.name,
            taskId,
            status: response.status,
          });
        }

        if (
          response.status >=
          PoyoStemSeparationProvider.INTERNAL_SERVER_ERROR_STATUS
        ) {
          throw new SeparationProviderUnavailableError(
            'PoYo separation provider is currently unavailable',
            {
              provider: this.name,
              taskId,
              status: response.status,
            },
          );
        }

        throw new SeparationProviderError(
          'Failed to fetch separation task detail',
          {
            provider: this.name,
            taskId,
            status: response.status,
          },
        );
      }

      const payload = (await response.json()) as PoyoDetailResponse;

      if (payload.code !== 200) {
        throw new SeparationProviderError(
          'Failed to fetch separation task detail',
          {
            provider: this.name,
            taskId,
            providerCode: payload.code,
          },
        );
      }

      const detail = payload.data;
      this.logger.log(
        `Retrieved PoYo separation detail (task=${taskId}, status=${detail.status})`,
      );

      return detail;
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Unknown error';

      if (error instanceof Error && error.name === 'AbortError') {
        throw new SeparationProviderUnavailableError(
          'PoYo separation provider timed out',
          { provider: this.name, taskId },
        );
      }

      this.logger.error(
        `Error fetching separation detail from PoYo (task=${taskId}): ${message}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new SeparationProviderUnavailableError(
        'PoYo separation provider is currently unavailable',
        { provider: this.name, taskId },
      );
    }
  }

  private buildAuthHeaders(includeJson = true): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
    };

    if (includeJson) {
      headers['Content-Type'] = 'application/json';
    }

    return headers;
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      PoyoStemSeparationProvider.DETAIL_TIMEOUT_MS,
    );

    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }
}
