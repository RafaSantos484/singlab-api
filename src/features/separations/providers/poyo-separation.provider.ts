import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Env } from '../../../config/env.config';
import {
  SeparationConfigurationError,
  SeparationConflictError,
  SeparationProviderError,
  SeparationProviderUnavailableError,
} from './separation-provider.errors';
import type { StemSeparationProvider } from './stem-separation-provider.interface';
import {
  SeparationModelName,
  SeparationOutputType,
  SeparationProviderName,
  StemSeparationProviderContext,
  StemSeparationSubmitParams,
  StemSeparationTask,
  assertHttpsUrl,
} from './separation-provider.types';

interface PoyoSubmitResponse {
  id?: string;
  task_id?: string;
  status?: string;
  created_at?: string;
  createdAt?: string;
}

@Injectable()
export class PoyoStemSeparationProvider implements StemSeparationProvider {
  readonly name: SeparationProviderName = 'poyo';
  private readonly logger = new Logger(PoyoStemSeparationProvider.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private static readonly TIMEOUT_MS = 10_000;

  constructor() {
    try {
      this.apiKey = Env.poyoApiKey;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Missing PoYo API key';
      throw new SeparationConfigurationError(message);
    }
    this.baseUrl = assertHttpsUrl(Env.poyoApiBaseUrl, 'POYO_API_BASE_URL');
    this.validateConfiguration();
  }

  validateConfiguration(): void {
    if (!this.apiKey) {
      throw new SeparationConfigurationError(
        'PoYo API key is required to submit separation tasks',
      );
    }
  }

  async submitTask(
    params: StemSeparationSubmitParams,
    context: StemSeparationProviderContext,
  ): Promise<StemSeparationTask> {
    this.validateConfiguration();
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      PoyoStemSeparationProvider.TIMEOUT_MS,
    );

    const url = new URL('/api/generate/submit', this.baseUrl).toString();

    const requestBody = {
      model: 'upload-and-separate-vocals',
      callback_url: params.callbackUrl,
      input: {
        audio_url: params.audioUrl,
        title: params.title,
        model_name: params.modelName ?? SeparationModelName.Base,
        output_type: params.outputType ?? SeparationOutputType.General,
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === HttpStatus.CONFLICT) {
        throw new SeparationConflictError('Separation already exists');
      }

      if (!response.ok) {
        if (response.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
          throw new SeparationProviderUnavailableError(
            'PoYo service unavailable',
          );
        }
        throw new SeparationProviderError('Failed to submit separation task');
      }

      const payload = (await response.json()) as PoyoSubmitResponse;
      const taskId = payload.id ?? payload.task_id;
      const status = payload.status ?? 'queued';
      const createdTime = payload.created_at ?? payload.createdAt;

      if (!taskId) {
        throw new SeparationProviderError('Missing task id from PoYo response');
      }

      return {
        taskId,
        status,
        createdTime,
        provider: this.name,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof SeparationProviderError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        this.logger.warn(
          `Stem separation request timed out (provider=poyo, requestId=${
            context.requestId ?? 'n/a'
          })`,
        );
        throw new SeparationProviderUnavailableError(
          'PoYo separation request timed out',
        );
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Stem separation submission failed (provider=poyo, requestId=${
          context.requestId ?? 'n/a'
        }): ${message}`,
      );

      throw new SeparationProviderUnavailableError(
        'PoYo separation provider unavailable',
      );
    }
  }
}
