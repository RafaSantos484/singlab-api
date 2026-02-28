import { Injectable } from '@nestjs/common';
import { PoyoStemSeparationProvider } from './poyo/poyo-separation.provider';
import type { StemSeparationProvider } from './stem-separation-provider.interface';
import { SeparationConfigurationError } from 'src/common/errors';

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
   * @throws {HttpException} Unknown provider name
   */
  getProvider(name?: string): StemSeparationProvider {
    const resolvedName = name ?? 'poyo';

    switch (resolvedName) {
      case 'poyo':
        return this.poyoProvider;
      default:
        throw new SeparationConfigurationError(
          `Unknown separation provider: ${resolvedName}`,
          { provider: resolvedName },
        );
    }
  }
}
