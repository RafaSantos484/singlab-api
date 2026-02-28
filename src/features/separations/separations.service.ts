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
import type { SubmitSeparationDto } from './dto/submit-separation.dto';
import {
  SeparationModelName,
  SeparationOutputType,
  type StemSeparationTask,
} from './providers/separation-provider.types';
import {
  SeparationConflictError,
  SeparationProviderError,
  SeparationProviderUnavailableError,
} from './providers/separation-provider.errors';
import { SongsService } from '../songs/songs.service';

interface SeparationRequestContext {
  userId?: string;
  requestId?: string;
}

@Injectable()
export class SeparationsService {
  private readonly logger = new Logger(SeparationsService.name);

  constructor(
    private readonly providerFactory: StemSeparationProviderFactory,
    private readonly songsService: SongsService,
  ) {}

  async submitSeparation(
    songId: string,
    dto: SubmitSeparationDto,
    context: SeparationRequestContext,
  ): Promise<StemSeparationTask> {
    if (!context.userId) {
      throw new InternalServerErrorException('User ID required for separation');
    }

    const song = await this.songsService.getSongById(context.userId, songId);
    if (!song) {
      throw new NotFoundException(`Song with ID ${songId} not found`);
    }

    const audioUrl = song.rawSongInfo?.urlInfo?.value;
    if (!audioUrl || typeof audioUrl !== 'string') {
      throw new InternalServerErrorException(
        'Song does not have a valid audio URL',
      );
    }

    const provider = this.providerFactory.getProvider();
    const payload = {
      audioUrl,
      title: dto.title ?? song.title,
      modelName: dto.modelName ?? SeparationModelName.Base,
      outputType: dto.outputType ?? SeparationOutputType.General,
      callbackUrl: dto.callbackUrl,
    };

    try {
      const task = await provider.submitTask(payload, {
        requestId: context.requestId,
      });

      return task;
    } catch (error) {
      this.handleProviderError(error, provider.name, context.requestId);
    }
  }

  private handleProviderError(
    error: unknown,
    providerName: string,
    requestId?: string,
  ): never {
    const correlation = requestId ?? 'n/a';

    if (error instanceof SeparationConflictError) {
      this.logger.warn(
        `Separation conflict from provider=${providerName}, requestId=${correlation}`,
      );
      throw new ConflictException(
        'A separation for this audio already exists with the provider',
      );
    }

    if (error instanceof SeparationProviderUnavailableError) {
      this.logger.warn(
        `Separation provider unavailable (provider=${providerName}, requestId=${correlation})`,
      );
      throw new ServiceUnavailableException(
        'Stem separation provider is currently unavailable. Please retry later.',
      );
    }

    if (error instanceof SeparationProviderError) {
      this.logger.warn(
        `Separation provider error (provider=${providerName}, requestId=${correlation})`,
      );
      throw new BadGatewayException(
        'Stem separation provider returned an error while submitting the task',
      );
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    this.logger.error(
      `Unexpected separation submission failure (provider=${providerName}, requestId=${correlation}): ${message}`,
    );
    throw new InternalServerErrorException('Failed to submit separation task');
  }
}
