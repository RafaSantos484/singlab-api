## Common Module

Shared utilities and patterns across the SingLab API, including error handling, exception filters, and type definitions.

## Error Handling Architecture

### Overview

The SingLab API uses a **two-tier error handling pattern**:

1. **Domain Errors** - Business logic failures (domain-level concerns)
2. **HTTP Exceptions** - Input validation and NestJS-specific errors (presentation-level concerns)

The **Global Exception Filter** standardizes all errors into a consistent JSON response format with request tracking.

### Domain Errors

Domain errors represent failures in business logic that should be communicated to clients without exposing internal implementation details. They map directly to HTTP status codes and include structured error codes.

#### Creating Domain Errors

Extend `DomainError` in `src/common/errors/domain-error.ts`:

```typescript
import { HttpStatus } from '@nestjs/common';
import { DomainError } from '@/common/errors';

export class CustomBusinessError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      message,
      'CUSTOM_BUSINESS_ERROR',      // Error code (uppercase with underscores)
      HttpStatus.CONFLICT,           // HTTP status code
      details                        // Optional debugging details
    );
  }
}
```

#### Using Domain Errors

Throw domain errors from services when business logic fails:

```typescript
import { SeparationConflictError } from '@/common/errors';

@Injectable()
export class SeparationsService {
  async submitSeparation(
    audioUrl: string,
    title: string,
  ): Promise<ProviderResponse> {
    if (isConflict) {
      throw new SeparationConflictError(
        'Task already in progress',
        { audioUrl }  // Debugging details (not exposed to client)
      );
    }
    return this.provider.submit(audioUrl, title);
  }
}
```

#### Built-in Domain Errors

The following domain errors are available:

| Error Class | HTTP Status | Code | Use Case |
|-------------|------------|------|----------|
| `SeparationConflictError` | 409 | `SEPARATION_CONFLICT` | Separation already exists for this song |
| `SeparationProviderError` | 502 | `SEPARATION_PROVIDER_ERROR` | Provider failed during request |
| `SeparationProviderUnavailableError` | 503 | `SEPARATION_PROVIDER_UNAVAILABLE` | Provider is temporarily unavailable |
| `SeparationConfigurationError` | 500 | `SEPARATION_CONFIGURATION_ERROR` | Provider configuration is invalid |

### HTTP Exceptions

Use `HttpException` from `@nestjs/common` for validation errors and presentation-level concerns:

```typescript
import { BadRequestException, HttpStatus } from '@nestjs/common';

@Post('submit')
async submitSeparation(@Body() dto: SubmitSeparationDto) {
  if (!dto.audioUrl) {
    throw new BadRequestException('audioUrl is required');
  }
  // ...
}
```

Common NestJS exceptions:
- `BadRequestException` (400) - Invalid input validation
- `UnauthorizedException` (401) - Missing/invalid authentication
- `ForbiddenException` (403) - Insufficient permissions
- `NotFoundException` (404) - Generic resource not found (use DomainError instead for domain concepts)
- `ConflictException` (409) - Generic conflict (use DomainError instead for domain conflicts)
- `InternalServerErrorException` (500) - Unexpected errors

### Global Exception Filter

The `GlobalExceptionFilter` in `src/common/filters/global-exception.filter.ts` catches all exceptions and transforms them into a standardized response format.

#### Response Format

All error responses follow this structure:

```json
{
  "success": false,
  "error": {
    "code": "SEPARATION_PROVIDER_ERROR",
    "message": "Provider failed to process separation",
    "statusCode": 502,
    "timestamp": "2026-02-28T10:30:45.123Z",
    "requestId": "req-abc123-def456"
  }
}
```

**Key fields:**
- `code` - Machine-readable error code (from DomainError) or inferred HTTP status name
- `message` - Human-readable error message (safe to display to users)
- `statusCode` - HTTP status code
- `timestamp` - ISO 8601 timestamp of error
- `requestId` - Unique request identifier for tracing and debugging

#### Error Mapping

| Exception Type | Mapping | Logging |
|---|---|---|
| `DomainError` | `statusCode` from error, `code` preserved | Status ≥ 500: error level, < 500: warn level |
| `HttpException` | HTTP status from exception | Status ≥ 500: error level, < 500: warn level |
| Other errors | 500 Internal Server Error, code: `INTERNAL_SERVER_ERROR` | error level |

#### Request Tracking

The filter extracts or generates a `requestId` for each request to enable end-to-end tracing:
- If the `X-Request-ID` header is present, it is preserved
- Otherwise, a UUID is generated automatically
- The `requestId` is included in all error responses and logs

This enables correlating error logs with client-side issue reports.

#### Logging Strategy

Exceptions are logged with context including:
- `statusCode`, `message`, `code`
- HTTP method and path
- User ID (if authenticated)
- Request ID for tracing

Example log output:
```
[GlobalExceptionFilter] SeparationProviderError: Provider failed to process separation
  statusCode=502 code=SEPARATION_PROVIDER_ERROR method=POST path=/separations/submit userId=user123 requestId=req-abc123
```

## Structure

```
src/common/
├── errors/
│   ├── domain-error.ts       # Base DomainError class and built-in error types
│   └── index.ts              # Error exports
├── filters/
│   ├── global-exception.filter.ts  # Centralized exception handling
│   └── index.ts              # Filter exports
└── README.md                 # This file
```

## Adding New Domain Errors

To add a new domain error:

1. **Add class to `domain-error.ts`**:
   ```typescript
   export class MyEntityNotFoundError extends DomainError {
     constructor(message: string, details?: Record<string, unknown>) {
       super(message, 'MY_ENTITY_NOT_FOUND', HttpStatus.NOT_FOUND, details);
     }
   }
   ```

2. **Export from `index.ts`**:
   ```typescript
   export { MyEntityNotFoundError } from './domain-error';
   ```

3. **Use in services**:
   ```typescript
   import { MyEntityNotFoundError } from '@/common/errors';
   throw new MyEntityNotFoundError('Entity not found', { entityId });
   ```

## Best Practices

1. **Use DomainError for domain logic failures** - Throw domain errors from services, not HTTP exceptions
2. **Use HttpException only for inputs** - Validate inputs and throw HttpException for validation failures
3. **Include debugging details** - Pass debug details in the `details` object, they won't be exposed to clients
4. **Let the filter handle mapping** - The exception filter automatically converts exceptions to HTTP responses
5. **Never catch and re-throw** - Let exceptions bubble up to the filter for proper handling and logging
6. **Use requestId for debugging** - Reference the requestId when investigating issues reported by users
