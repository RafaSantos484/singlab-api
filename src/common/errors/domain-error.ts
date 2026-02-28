import { HttpStatus } from '@nestjs/common';

/**
 * Base error class for domain-level failures that should be translated
 * into HTTP responses by the global exception filter without leaking
 * internal details to clients.
 */
export abstract class DomainError extends Error {
  readonly code: string;
  readonly statusCode: HttpStatus;
  readonly details?: Record<string, unknown>;

  protected constructor(
    message: string,
    code: string,
    statusCode: HttpStatus,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const isDomainError = (error: unknown): error is DomainError => {
  return error instanceof DomainError;
};

export class SongNotFoundError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'SONG_NOT_FOUND', HttpStatus.NOT_FOUND, details);
  }
}

export class SeparationConflictError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'SEPARATION_CONFLICT', HttpStatus.CONFLICT, details);
  }
}

export class SeparationProviderUnavailableError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      message,
      'SEPARATION_PROVIDER_UNAVAILABLE',
      HttpStatus.SERVICE_UNAVAILABLE,
      details,
    );
  }
}

export class SeparationProviderError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      message,
      'SEPARATION_PROVIDER_ERROR',
      HttpStatus.BAD_GATEWAY,
      details,
    );
  }
}

export class SeparationConfigurationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      message,
      'SEPARATION_CONFIGURATION_ERROR',
      HttpStatus.INTERNAL_SERVER_ERROR,
      details,
    );
  }
}
