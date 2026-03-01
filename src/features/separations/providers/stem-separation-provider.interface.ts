export type SeparationProviderName = 'poyo';

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
   * Check if a separation task has finished.
   *
   * Examines task data returned by the provider and determines if the
   * separation has completed successfully. Used to short-circuit status
   * polling when the task is already done.
   *
   * @param taskData - Provider-specific task metadata
   * @returns true if task status indicates completion, false otherwise
   */
  isTaskFinished(taskData: unknown): boolean;

  /**
   * Extract task identifier from provider-specific task data.
   *
   * Retrieves the task ID needed for subsequent status queries.
   * Returns undefined if the data structure is incompatible or missing ID.
   *
   * @param taskData - Provider-specific task metadata
   * @returns Task identifier string, or undefined if not present
   */
  getTaskId(taskData: unknown): string | undefined;

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

  /**
   * Fetches current separation task detail from provider.
   *
   * @param taskId - Provider task identifier
   * @returns Normalized task detail including status and stems when ready
   */
  getTaskDetail(taskId: string): Promise<unknown>;

  /**
   * Extract stem URLs from provider-specific task data.
   *
   * Retrieves URLs of separated audio stems when task is finished.
   * Returns empty object if task is not finished or data is incompatible.
   *
   * @param taskData - Provider-specific task metadata
   * @returns Record of stem names to URLs, or empty object
   */
  getStemUrls(taskData: unknown): Record<string, string>;
}
