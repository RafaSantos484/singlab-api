# Stem Separations

Submit stem separation tasks for songs via a provider-agnostic interface. The controller exposes `POST /songs/:songId/separations` to submit work and `GET /songs/:songId/separations/status` to refresh task status while persisting provider responses into `separatedSongInfo.providerData` and ready-to-use stems into `separatedSongInfo.stems`. The audio URL is generated on-demand from the stored `rawSongInfo.path` using a signed URL.

## Request

- **URL**: `POST /songs/:songId/separations`
- **Path Params**:
  - `songId` (string, required): ID of the song to separate.
- **Query Params**:
  - `provider` (string, optional): Separation provider to use (defaults to `poyo`).
- **Body**: none
- **Auth**: Firebase bearer token (required in production).

The `audioUrl` and `title` are automatically obtained from the song document (signed URL from `rawSongInfo.path` and the stored `title`).
The separation model and output type are hardcoded in the provider implementation (currently `base` model and `general` output type for PoYo).
The song must exist and belong to the authenticated user.

## Response

`202 Accepted`
```json
{
  "success": true,
  "data": {
    "task_id": "xxxx-xxxx-xxxx",
    "created_time": "2026-02-28T00:00:00Z"
  }
}
```

The exact response format depends on the provider implementation.

## Refresh Status

- **URL**: `GET /songs/:songId/separations/status`
- **Path Params**: `songId` (string, required)
- **Query Params**:
  - `provider` (string, optional): Overrides the default provider (defaults to `poyo`)
- **Auth**: Firebase bearer token (required in production)

The backend derives the task ID from the stored `separatedSongInfo` and short-circuits if the provider already marks the task as finished. `202 Accepted` is returned when the task is still running; `200 OK` when finished or failed. Response example when finished:

```json
{
  "success": true,
  "data": {
    "taskId": "xxxx-xxxx-xxxx",
    "status": "finished",
    "createdTime": "2026-02-28T00:00:00Z",
    "provider": "poyo",
    "providerData": {
      "task_id": "xxxx-xxxx-xxxx",
      "status": "finished"
    },
    "stems": {
      "uploadedAt": "2026-02-28T00:00:00Z",
      "paths": {
        "bass": "users/abc123/songs/xyz/stems/bass.mp3",
        "vocals": "users/abc123/songs/xyz/stems/vocals.mp3"
      }
    }
  }
}
```

`providerData` stores the provider-specific response (raw payload), while `stems` stores the normalized storage metadata with upload timestamp and storage paths. Signed URLs should be generated on demand from these paths. Stems are parsed from PoYo's `vocal_removal` JSON payload and stored without overwriting existing data while the task is still pending.

**Error Responses**:
- `404 Not Found` (`SONG_NOT_FOUND`) - Song doesn't exist or doesn't belong to the user
- `409 Conflict` (`SEPARATION_CONFLICT`) - Separation already exists for this audio
- `502 Bad Gateway` (`SEPARATION_PROVIDER_ERROR`) - Provider returned an error or inconsistent payload
- `503 Service Unavailable` (`SEPARATION_PROVIDER_UNAVAILABLE`) - Provider is temporarily unavailable
- `404 Not Found` (`SEPARATION_TASK_NOT_FOUND`) - Provider cannot find the task

All error responses follow this format:
```json
{
  "success": false,
  "error": {
    "code": "SONG_NOT_FOUND",
    "message": "Song with ID xyz not found",
    "statusCode": 404,
    "timestamp": "2026-02-28T10:30:45.123Z",
    "requestId": "abc123-def456"
  }
}
```

## Configuration

- `SEPARATION_PROVIDER` (default: `poyo`): Separation provider to use
- `POYO_API_KEY` (required when using PoYo): PoYo API authentication key
- `POYO_API_BASE_URL` (default: `https://api.poyo.ai`): PoYo API base URL

Configuration is validated at startup; missing API key prevents boot when PoYo is selected. `provider` defaults to `poyo` when unspecified.

### Provider resilience

- Submission requests use timeouts (10s) and retry once on 5xx/timeout from PoYo.
- Status polling uses timeouts (10s) and converts gateway issues into `503` errors.
- All provider calls include request IDs in the error response for tracing.

## Architecture

Controller → Service (fetches song) → Provider Factory (defaults to PoYo) → Provider implementation (PoYo). 

The service layer:
1. Retrieves provider from factory
2. Fetches song document with full validation
3. Calls `provider.requestSeparation()` with audio URL and title
4. Persists provider task/status data directly via `song.updateSeparatedSongInfo()`
5. Handles provider-specific errors and converts them to domain errors

Add new providers by implementing `StemSeparationProvider` interface and registering in the factory.
