import type { SeparationProviderName } from './separation-provider.types';

/**
 * Interface for stem separation providers.
 *
 * Providers implement this interface to submit separation tasks to external services.
 * The interface is intentionally minimal to support diverse provider APIs.
 */
export interface StemSeparationProvider {
  /**
   * Provider identifier used for logging and selection.
   */
  readonly name: SeparationProviderName;

  /**
   * Request stem separation for an audio file.
   *
   * Submits a separation task to the provider's API. Implementation details
   * (model selection, output format, etc.) are provider-specific.
   *
   * @param audioUrl - Public URL of the audio file to separate
   * @param title - Title of the song for provider metadata
   * @returns Provider-specific task metadata (format varies by implementation)
   * @throws {SeparationConfigurationError} Provider misconfigured
   * @throws {SeparationConflictError} Separation already exists for this audio
   * @throws {SeparationProviderError} Provider returned an error
   * @throws {SeparationProviderUnavailableError} Provider is unavailable
   */
  requestSeparation(audioUrl: string, title: string): Promise<unknown>;
}
