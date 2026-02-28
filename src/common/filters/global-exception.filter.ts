import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import {
  SeparationProviderError,
  SeparationConflictError,
  SeparationProviderUnavailableError,
  SeparationConfigurationError,
} from '../../features/separations/providers/separation-provider.errors';

/**
 * Standard HTTP error response format.
 */
interface ErrorResponse {
  success: false;
  error: {
    message: string;
    statusCode: number;
    timestamp: string;
  };
}

/**
 * Global exception filter for standardizing error responses.
 *
 * Catches and transforms exceptions into consistent JSON format:
 * - Separation provider errors (conflict, unavailable, configuration, generic)
 * - HttpException: NestJS HTTP exceptions with custom messages
 * - All other errors: Generic 500 Internal Server Error
 *
 * Separation provider error mappings:
 * - SeparationConflictError → 409 Conflict
 * - SeparationProviderUnavailableError → 503 Service Unavailable
 * - SeparationConfigurationError → 500 Internal Server Error
 * - SeparationProviderError → 400 Bad Request
 *
 * Response format:
 * ```json
 * {
 *   "success": false,
 *   "error": {
 *     "message": "Error message",
 *     "statusCode": 400,
 *     "timestamp": "2026-02-27T10:30:45.123Z"
 *   }
 * }
 * ```
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: Error, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    // Handle separation provider errors
    if (exception instanceof SeparationConflictError) {
      statusCode = HttpStatus.CONFLICT;
      message = exception.message;
      this.logger.warn(`SeparationConflictError: ${message}`);
    } else if (exception instanceof SeparationProviderUnavailableError) {
      statusCode = HttpStatus.SERVICE_UNAVAILABLE;
      message = exception.message;
      this.logger.warn(`SeparationProviderUnavailableError: ${message}`);
    } else if (exception instanceof SeparationConfigurationError) {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = exception.message;
      this.logger.warn(`SeparationConfigurationError: ${message}`);
    } else if (exception instanceof SeparationProviderError) {
      statusCode = HttpStatus.BAD_REQUEST;
      message = exception.message;
      this.logger.warn(`SeparationProviderError: ${message}`);
    }
    // Handle HttpException
    else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Extract message from HttpException
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const errorObj = exceptionResponse as { message?: string | string[] };
        if (Array.isArray(errorObj.message)) {
          message = errorObj.message.join(', ');
        } else if (typeof errorObj.message === 'string') {
          message = errorObj.message;
        } else if ('error' in errorObj) {
          message = (errorObj as { error?: string }).error || message;
        }
      } else if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      }

      this.logger.warn(`HttpException: ${statusCode} ${message}`);
    } else {
      // Handle unexpected errors
      const errorMsg =
        exception instanceof Error ? exception.message : 'Unknown error';
      this.logger.error(
        `Unhandled exception: ${errorMsg}`,
        exception instanceof Error ? exception.stack : '',
      );
    }

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        message,
        statusCode,
        timestamp: new Date().toISOString(),
      },
    };

    response.status(statusCode).json(errorResponse);
  }
}
