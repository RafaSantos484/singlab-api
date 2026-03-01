# SingLab API Setup Guide

This guide explains how to configure the SingLab API project for local
development and Firebase deployment.

## Initial Setup Steps

### 1. Update Project Information

Edit `package.json`:

```json
{
  "name": "singlab-api",
  "version": "0.1.0",
  "description": "SingLab API for karaoke and singing practice",
  "author": "Your Name <your.email@example.com>",
  "license": "MIT"
}
```

### 2. Configure Firebase Project

```bash
firebase use --add
```

Update `.firebaserc`:

```json
{
  "projects": {
    "default": "your-project-id",
    "staging": "your-project-staging",
    "production": "your-project-prod"
  }
}
```

### 3. Configure Environment Files

```bash
cp .env.dev.example .env.dev
cp .env.production.example .env.production
```

Local development:

```env
PORT=5001
CORS_ORIGIN=*
SKIP_AUTH=true
NODE_ENV=development
```

Production:

```env
PORT=5001
CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com
SKIP_AUTH=false
NODE_ENV=production
```

### 4. Configure Firebase Credentials (Optional)

If you need Firebase Admin SDK access, set up credentials:

```bash
cp ~/Downloads/credentials.json .
```

Only commit `credentials.json.example` with placeholder values. Never commit
the real `credentials.json` file.

For details, see [FIREBASE_CREDENTIALS.md](./FIREBASE_CREDENTIALS.md).

### 5. Update Firebase Function Settings (Optional)

Edit `src/main.ts` to change region, timeouts, or memory settings.

## Development Workflow

```bash
npm run dev
npm run test
npm run serve
```

## Feature Modules (Planned)

Recommended modules for the SingLab pipeline:

- `uploads` for multipart ingestion and link validation
- `media` for FFmpeg normalization
- `stems` for vocal/instrumental separation providers
- `transcribe` for lyric transcription providers
- `storage` for asset persistence and metadata

Generate modules with Nest CLI:

```bash
nest generate module uploads
nest generate controller uploads
nest generate service uploads
```

## Best Practices

- Never commit `.env` files (only `.env.*.example`).
- Keep `SKIP_AUTH=false` in production.
- Validate all inputs and file types.
- Persist source provenance for uploaded media.

## CI/CD Setup

GitHub Actions are configured for CI and Firebase deployment.

### Required secrets

- `FIREBASE_SERVICE_ACCOUNT`
- `ENV_PROD`

### Firebase alias

```json
{
  "projects": {
    "default": "your-dev-project-id",
    "prod": "your-production-project-id"
  }
}
```

## Additional Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [Firebase Functions v2](https://firebase.google.com/docs/functions/2nd-gen)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
