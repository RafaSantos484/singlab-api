# Environment Configuration

This folder contains centralized application configuration for the SingLab API.

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

Warning: never set this to `true` in production.

```typescript
const skipAuth = Env.skipAuth; // true or false
```

#### `APP_FIREBASE_STORAGE_BUCKET` (env var)

Optional bucket name for Firebase Storage. If set, it overrides the automatic
bucket resolution logic. Use the format `<project-id>.appspot.com`.

```env
APP_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
```

#### `separationProvider: string`

Selected stem separation provider for audio processing. Default: `'poyo'`

```typescript
const provider = Env.separationProvider; // 'poyo'
```

Supported providers:
- `'poyo'` - PoYo AI audio separation service

When the provider is PoYo, configuration is validated at startup (fails fast if
`POYO_API_KEY` is missing).

#### `poyoApiKey: string`

API key for PoYo stem separation service. Required when provider is PoYo.

```typescript
const apiKey = Env.poyoApiKey; // throws if not configured
```

Environment variable: `POYO_API_KEY`

#### `poyoApiBaseUrl: string`

Base URL for PoYo API. Default: `'https://api.poyo.ai'`

```typescript
const baseUrl = Env.poyoApiBaseUrl; // 'https://api.poyo.ai'
```

Environment variable: `POYO_API_BASE_URL`

Must use HTTPS protocol.

### Usage

```typescript
import { Env } from './config/env.config';

// Use in code
const port = Env.port;
const corsOrigin = Env.corsOrigin;
```

### Tests

Unit tests for the Env class are located in `test/config/env.config.spec.ts` and cover all usage scenarios.
