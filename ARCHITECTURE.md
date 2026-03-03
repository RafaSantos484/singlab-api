# SingLab API — Architecture Overview

## Role

The **singlab-api** backend is a stateless API gateway between the frontend
and external AI services. It does **not** read from or write to Firestore or
Cloud Storage — all Firebase data and file operations are handled directly by
the frontend.

Currently the only external service is the **PoYo** stem separation API.

## Request Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  Frontend (singlab-frontend)                                        │
│                                                                     │
│  POST /separations/submit   { audioUrl, title, provider? }         │
│  GET  /separations/status   ?taskId=xxx&provider=poyo              │
└────────────────────────────────┬────────────────────────────────────┘
                                 │  Authorization: Bearer <idToken>
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  NestJS (Firebase Cloud Function)                                   │
│                                                                     │
│  FirebaseAuthGuard ─► SeparationsController ─► SeparationsService  │
│                                                                     │
│  SeparationsService ─► StemSeparationProviderFactory                │
│                        └─► PoyoSeparationProvider                  │
└────────────────────────────────┬────────────────────────────────────┘
                                 │  HTTPS (Bearer POYO_API_KEY)
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PoYo API (api.poyo.ai)                                             │
│                                                                     │
│  POST /api/generate/submit              → returns task_id + status │
│  GET  /api/generate/detail/music?task_id=xxx → returns task detail │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  AppModule                                                           │
│  ├── AppController           GET /  (health check)                  │
│  └── SeparationsModule                                              │
│       ├── SeparationsController    POST /separations/submit         │
│       │                            GET  /separations/status         │
│       ├── SeparationsService       submitSeparation()               │
│       │                            getSeparationStatus()            │
│       ├── StemSeparationProviderFactory                             │
│       └── PoyoSeparationProvider   submit() / getTaskDetails()     │
└──────────────────────────────────────────────────────────────────────┘
```

## API Endpoints

| Method | Path | Body / Query | Description |
|--------|------|-------------|-------------|
| `GET` | `/` | — | Health check |
| `POST` | `/separations/submit` | `{ audioUrl, title, provider? }` | Start a stem separation task |
| `GET` | `/separations/status` | `?taskId=xxx&provider=poyo` | Get task status from provider |

Both `/separations/*` endpoints require a valid Firebase ID token
(`Authorization: Bearer <token>`) and return the raw provider response.

## File Organisation

```
src/
├── main.ts                   # Express + NestJS bootstrap (cached for serverless)
├── app.module.ts             # Root module (imports SeparationsModule)
├── app.controller.ts         # Health check
├── utils.ts                  # Shared utilities
├── auth/
│   ├── firebase-admin.provider.ts   # Firebase Admin init (Auth only)
│   ├── firebase-auth.guard.ts       # Bearer token verification guard
│   └── types.ts                     # Auth types (FirebaseUser)
├── config/
│   └── env.config.ts                # Static Env class for env vars
├── common/
│   ├── errors/
│   │   ├── domain-error.ts          # Base DomainError + separation errors
│   │   └── index.ts
│   └── filters/
│       └── global-exception.filter.ts
└── features/
    └── separations/
        ├── separations.module.ts
        ├── separations.controller.ts
        ├── separations.service.ts
        ├── dtos/
        │   └── separation-requests.dto.ts
        └── providers/
            ├── stem-separation-provider.interface.ts
            ├── stem-separation-provider.factory.ts
            ├── poyo-separation.provider.ts
            └── poyo-separation.types.ts
```

## Error Handling

```
Service throws DomainError
        │
        ▼
GlobalExceptionFilter catches & maps to HTTP response
        │
        ▼
{ success: false, error: { code, message, statusCode, timestamp, requestId } }
```

| Error Class | HTTP Status | When |
|-------------|-------------|------|
| `SeparationConflictError` | 409 | Task already exists for song |
| `SeparationNotFoundError` | 404 | No task found for given ID |
| `SeparationProviderError` | 502 | Provider returned an error |
| `SeparationProviderNotFoundError` | 400 | Unknown provider name |

## Adding a New Provider

1. Implement `StemSeparationProvider` interface.
2. Register in `StemSeparationProviderFactory`.
3. Add provider-specific types.
4. Frontend uses it via `provider` parameter.
