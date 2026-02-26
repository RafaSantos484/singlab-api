# Environment Configuration

This folder contains centralized application configurations, following hexagonal architecture principles.

## Env.config.ts

Class responsible for centralizing access to environment variables with types and default values.

### Available Variables

#### `nodeEnv: string | undefined`

Returns the application execution environment (development, production, etc).

```typescript
const env = Env.nodeEnv; // 'development', 'production', etc
```

#### `port: number`

Port where the application will run. Default: `5001`

```typescript
const port = Env.port; // 5001
```

#### `corsOrigin: CorsOrigin`

Configuration of allowed origins for CORS. Can be `"*"` or an array of URLs.
Default: `['http://localhost:3000']`

```typescript
const origins = Env.corsOrigin; // '*' or ['http://localhost:3000', 'https://example.com']
```

#### `skipAuth: boolean`

Flag to skip authentication validation. Default: `false`

⚠️ **WARNING**: Never set to `true` in production!

```typescript
const skipAuth = Env.skipAuth; // true or false
```

### Usage

```typescript
import { Env } from './config/env.config';

// Use in code
const port = Env.port;
const corsOrigin = Env.corsOrigin;
```

### Tests

Unit tests for the Env class are located in `test/config/env.config.spec.ts` and cover all usage scenarios.
