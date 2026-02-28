export class SeparationProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class SeparationConflictError extends SeparationProviderError {}

export class SeparationProviderUnavailableError extends SeparationProviderError {}

export class SeparationConfigurationError extends SeparationProviderError {}
