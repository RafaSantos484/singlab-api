# SingLab API

SingLab is a web application focused on karaoke and singing practice. This
repository contains the backend API, built with NestJS, TypeScript, and
Firebase Cloud Functions.

The API accepts audio inputs (uploaded files or approved links), normalizes the
media, separates vocals from instrumental, transcribes lyrics, and stores the
processed assets with metadata for playback and practice features.

## Features

- NestJS v11 with Express adapter, optimized for Firebase Functions v2
- Async processing pipeline for audio ingestion and AI jobs
- Media normalization with FFmpeg (planned)
- Pluggable providers for stem separation and transcription (planned)
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

```env
PORT=5001
CORS_ORIGIN=*
SKIP_AUTH=true
```

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
│   ├── config/
│   │   └── env.config.ts
│   ├── app.controller.ts
│   ├── app.module.ts
│   ├── main.ts
│   └── utils.ts
├── test/
│   ├── config/
│   │   └── env.config.spec.ts
│   ├── app.controller.spec.ts
│   └── app.e2e-spec.ts
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

## Processing Pipeline (Planned)

1. Ingest audio from uploads or approved links.
2. Normalize audio with FFmpeg (sample rate, channels, format).
3. Separate stems (vocals and instrumental).
4. Transcribe lyrics from the vocal stem.
5. Persist assets (original, vocal, instrumental) and metadata.
6. Emit job status updates for the frontend.

The separation and transcription providers are intentionally pluggable so the
project can evolve between SaaS APIs and self-hosted models.

## Environment Configuration

The API uses a type-safe `Env` class in `src/config/env.config.ts`.

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PORT` | `number` | `5001` | Local server port |
| `CORS_ORIGIN` | `string` or `array` | `*` | Allowed CORS origins |
| `SKIP_AUTH` | `boolean` | `false` | Skip authentication (dev only) |
| `NODE_ENV` | `string` | - | Environment name |

Example usage:

```typescript
import { Env } from './config/env.config';

const port = Env.port;
const origins = Env.corsOrigin;
const skipAuth = Env.skipAuth;
```

## Firebase Service Account Credentials

If you integrate Firebase Admin SDK features, set up credentials as described
in [FIREBASE_CREDENTIALS.md](./FIREBASE_CREDENTIALS.md).

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

This repository currently contains the initial NestJS/Firebase scaffold. Core
audio processing features will be added next.

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
