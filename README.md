# SingLab API

SingLab is a web application focused on karaoke and singing practice. This
repository contains the backend API, built with NestJS, TypeScript, and
Firebase Cloud Functions.

The API acts as a **stateless gateway** between the frontend and external AI
services. It does not access Firestore or Cloud Storage — all Firebase data
and file operations are handled directly by the frontend.

## Features

- NestJS v11 with Express adapter, optimized for Firebase Functions v2
- **Stateless stem separation proxy** with pluggable provider support
  - `POST /separations/submit` — forward separation request to provider
  - `GET /separations/status` — fetch task status from provider
  - Currently supports PoYo AI separation service
  - Extensible architecture for adding more providers
- **Stateless separation proxy endpoints** (`POST /separations/submit`, `GET /separations/status`) for frontend-managed persistence
- Media normalization with FFmpeg (planned)
- Transcription support (planned)
- Centralized environment configuration via `Env` class
- Jest unit and e2e tests, ESLint, Prettier

## Prerequisites

- Node.js 18+ (Firebase Functions v2 requirement)
- npm or yarn
- Firebase CLI (`npm install -g firebase-tools`)
- Firebase project on Blaze plan

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Firebase project

```bash
firebase login
firebase use --add
```

Update `.firebaserc` with your project ID:

```json
{
  "projects": {
    "default": "your-firebase-project-id"
  }
}
```

### 3. Configure environment variables

```bash
cp .env.dev.example .env.dev
```

Edit `.env.dev` with required settings:

```env
PORT=5001
CORS_ORIGIN=*
SKIP_AUTH=true

# Stem separation provider
POYO_API_KEY=your-poyo-api-key
POYO_API_BASE_URL=https://api.poyo.ai
```

See [src/config/README.md](src/config/README.md) for complete configuration options.

### 4. Run the API locally

```bash
npm run dev
```

Local API: http://localhost:5001

## Scripts

### Development

```bash
npm run dev
npm run dev:local
npm run build
```

### Local Tunnel Exposure

Expose local API via ngrok for testing webhooks and remote clients:

```bash
npm run tunnel          # Uses default environment (local)
npm run tunnel:dev      # Uses dev environment
npm run tunnel:local    # Uses local environment
```

Requires ngrok CLI installed globally. Install with: `npm install -g ngrok`

### Testing

```bash
npm test
npm run test:watch
npm run test:coverage
```

### Build and Deploy

```bash
npm run build
npm run serve
npm run deploy
npm run logs
```

### Code Quality

```bash
npm run lint
npm run format
```

## Project Structure

```
.
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── app.controller.ts
│   ├── utils.ts
│   ├── auth/                  # Firebase Auth guard + admin provider
│   ├── config/
│   │   └── env.config.ts
│   ├── common/                # Errors + global exception filter
│   └── features/
│       └── separations/       # Stem separation proxy (controller, service, providers)
├── test/
│   └── app.spec.ts
├── dist/
├── .env.dev
├── .env.dev.example
├── .env.production.example
├── credentials.json
├── credentials.json.example
├── firebase.json
├── .firebaserc
├── package.json
└── tsconfig.json
```

## API Endpoints

| Method | Path | Body / Query | Description |
|--------|------|-------------|-------------|
| `GET` | `/` | — | Health check |
| `POST` | `/separations/submit` | `{ audioUrl, title, provider? }` | Start a stem separation task |
| `GET` | `/separations/status` | `?taskId=xxx&provider=poyo` | Get task status from provider |

Both `/separations/*` endpoints require a valid Firebase ID token.
The backend returns the raw provider response — the frontend writes
results to Firestore.

## Environment Configuration

The API uses a type-safe `Env` class in `src/config/env.config.ts`.

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PORT` | `number` | `5001` | Local server port (dev only) |
| `CORS_ORIGIN` | `string` or `array` | `['http://localhost:3000']` | Allowed CORS origins |
| `SKIP_AUTH` | `boolean` | `false` | Skip authentication (dev only) |
| `NODE_ENV` | `string` | - | Environment name (dev, production, test) |
| `POYO_API_KEY` | `string` | - | PoYo stem separation API key |
| `POYO_API_BASE_URL` | `string` | `https://api.poyo.ai` | PoYo API base URL |

Example usage:

```typescript
import { Env } from './config/env.config';

const port = Env.port;
const origins = Env.corsOrigin;
const skipAuth = Env.skipAuth;
const poyoKey = Env.poyoApiKey;
```

## Firebase Service Account Credentials

The API uses Firebase Admin SDK solely for ID token verification.
Set up credentials as described in [FIREBASE_CREDENTIALS.md](./FIREBASE_CREDENTIALS.md).

## Deployment

```bash
npm run deploy
```

Function URL:

```
https://REGION-PROJECT_ID.cloudfunctions.net/api
```

To rename the exported function or set region/memory settings, edit
`src/main.ts`.

## CI/CD

This repository ships with GitHub Actions for CI and Firebase deployment.

### Required secrets

- `FIREBASE_SERVICE_ACCOUNT`
- `ENV_PROD`

See [TEMPLATE_SETUP.md](./TEMPLATE_SETUP.md) for setup details.

## Testing

Tests live in `test/` and use Jest.

```bash
npm test
```

## Legal and Compliance Notes

- Only process audio you have rights to use.
- For third-party platforms, comply with their Terms of Service.
- Store provenance data for uploaded assets to support compliance reviews.

## Status

The API is production-ready as a stateless separation gateway.
All Firebase data and file operations are handled by the frontend.

### Cold Starts

Firebase Functions may have cold starts. Mitigation:
- Keep functions warm with Cloud Scheduler
- Use minimum instances (costs apply)
- Optimize bundle size

### Environment Variables Not Loading

Ensure you're using the correct `.env` file for your environment:
- Local development: `.env.dev`
- Firebase emulators: `.env.dev` (with local Firebase emulator setup)
- Production: Set in Firebase Console > Functions > Runtime environment variables

### Build Errors

```bash
# Clean and rebuild
npm run clean
npm run build

# Check TypeScript errors
npx tsc --noEmit
```

## 📄 License

MIT License - feel free to use this template for any project.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

- [NestJS Documentation](https://docs.nestjs.com)
- [Firebase Functions Documentation](https://firebase.google.com/docs/functions)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)

---

**Happy coding!** 🎉
