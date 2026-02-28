import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { isDomainError } from '../errors';

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    statusCode: number;
    timestamp: string;
    requestId: string;
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
 * - SeparationProviderError → 502 Bad Gateway
 *
 * Response format:
 * ```json
 * {
 *   "success": false,
 *   "error": {
 *     "code": "DOMAIN_CODE",
 *     "message": "Error message",
 *     "statusCode": 400,
 *     "timestamp": "2026-02-27T10:30:45.123Z",
 *     "requestId": "abc123"
 *   }
 * }
 * ```
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const { statusCode, message, code, logLevel } =
      this.mapException(exception);
    const requestId = this.getRequestId(request);

    this.logException(exception, {
      statusCode,
      message,
      code,
      logLevel,
      method: request?.method,
      path: request?.originalUrl,
      userId: this.extractUserId(request),
      requestId,
    });

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code,
        message,
        statusCode,
        timestamp: new Date().toISOString(),
        requestId,
      },
    };

    response.status(statusCode).json(errorResponse);
  }

  private mapException(exception: unknown): {
    statusCode: number;
    message: string;
    code: string;
    logLevel: 'warn' | 'error';
  } {
    if (isDomainError(exception)) {
      const statusCodeNum = exception.statusCode as number;
      const threshold = HttpStatus.INTERNAL_SERVER_ERROR as number;
      return {
        statusCode: exception.statusCode,
        message: exception.message,
        code: exception.code,
        logLevel: statusCodeNum >= threshold ? 'error' : 'warn',
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const threshold = HttpStatus.INTERNAL_SERVER_ERROR as number;
      return {
        statusCode,
        message: this.extractHttpExceptionMessage(exception),
        code: this.extractHttpExceptionCode(exception),
        logLevel: statusCode >= threshold ? 'error' : 'warn',
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
      logLevel: 'error',
    };
  }

  private extractHttpExceptionMessage(exception: HttpException): string {
    const exceptionResponse = exception.getResponse();

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const errorObj = exceptionResponse as {
        message?: string | string[];
        error?: string;
      };
      if (Array.isArray(errorObj.message)) {
        return errorObj.message.join(', ');
      }
      if (typeof errorObj.message === 'string') {
        return errorObj.message;
      }
      if (typeof errorObj.error === 'string' && errorObj.error.length > 0) {
        return errorObj.error;
      }
    }

    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    return exception.message;
  }

  private extractHttpExceptionCode(exception: HttpException): string {
    const statusCode = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const errorObj = exceptionResponse as { code?: string };
      if (typeof errorObj.code === 'string' && errorObj.code.length > 0) {
        return errorObj.code;
      }
    }

    return `HTTP_${statusCode}`;
  }

  private getRequestId(request?: Request): string {
    const headerId = request?.headers?.['x-request-id'];
    if (typeof headerId === 'string' && headerId.trim().length > 0) {
      return headerId.trim();
    }
    return `${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  }

  private extractUserId(request?: Request): string | undefined {
    const maybeUser = request as Request & {
      user?: {
        uid?: string;
      };
    };
    return maybeUser?.user?.uid;
  }

  private logException(
    exception: unknown,
    context: {
      statusCode: number;
      message: string;
      code: string;
      logLevel: 'warn' | 'error';
      method?: string;
      path?: string;
      userId?: string;
      requestId: string;
    },
  ): void {
    const prefix = `${context.method ?? 'UNKNOWN'} ${
      context.path ?? 'UNKNOWN'
    }`;
    const suffix = `(user=${context.userId ?? 'anonymous'}; requestId=${
      context.requestId
    })`;
    const logMessage = `${prefix} -> ${context.statusCode} ${context.code}: ${context.message} ${suffix}`;
    const stack = exception instanceof Error ? exception.stack : undefined;

    if (context.logLevel === 'warn') {
      this.logger.warn(logMessage);
      return;
    }

    this.logger.error(logMessage, stack);
  }
}
