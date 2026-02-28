import { Injectable } from '@nestjs/common';
import { PoyoStemSeparationProvider } from './poyo-separation.provider';
import { SeparationConfigurationError } from './separation-provider.errors';
import type { StemSeparationProvider } from './stem-separation-provider.interface';
import type { SeparationProviderName } from './separation-provider.types';

/**
 * Factory for resolving stem separation provider instances.
 *
 * Maintains registry of available providers and returns requested instance.
 * Currently supports: 'poyo' (default).
 */
@Injectable()
export class StemSeparationProviderFactory {
  constructor(private readonly poyoProvider: PoyoStemSeparationProvider) {}

  /**
   * Get separation provider by name.
   *
   * @param name - Provider identifier (optional, defaults to 'poyo')
   * @returns Configured provider instance
   * @throws {SeparationConfigurationError} Unknown provider name
   */
  getProvider(name?: string): StemSeparationProvider {
    const provider = name || 'poyo';
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
