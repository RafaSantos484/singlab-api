import { Injectable } from '@nestjs/common';
import { Env } from '../../../config/env.config';
import { PoyoStemSeparationProvider } from './poyo-separation.provider';
import { SeparationConfigurationError } from './separation-provider.errors';
import type { StemSeparationProvider } from './stem-separation-provider.interface';
import type { SeparationProviderName } from './separation-provider.types';

@Injectable()
export class StemSeparationProviderFactory {
  constructor(private readonly poyoProvider: PoyoStemSeparationProvider) {
    this.validateSelectedProvider();
  }

  getProvider(): StemSeparationProvider {
    return this.resolveProvider();
  }

  private validateSelectedProvider(): void {
    this.resolveProvider();
  }

  private resolveProvider(): StemSeparationProvider {
    const provider = (Env.separationProvider || 'poyo').toLowerCase();
    switch (provider) {
      case 'poyo':
        return this.poyoProvider;
      default:
        throw new SeparationConfigurationError(
          `Unsupported separation provider: ${provider as SeparationProviderName}`,
        );
    }
  }
}
