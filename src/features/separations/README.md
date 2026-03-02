# Stem Separations

Submit stem separation tasks for songs via a provider-agnostic interface. The controller exposes `POST /songs/:songId/separations` to submit work, `GET /songs/:songId/separations/status` to refresh task status, and `PATCH /songs/:songId/separations/stems` to persist stem storage paths after the client uploads them. Provider responses are persisted into `separatedSongInfo.providerData`; stem storage paths are set via the PATCH endpoint after the client uploads the files. The audio URL is generated on-demand from the stored `rawSongInfo.path` using a signed URL.

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

### Retry logic for failed separations

If a previous separation attempt failed (status is `failed`), submitting a new separation request will automatically retry the separation with the same provider. This allows users to recover from transient provider errors or temporary unavailability without manually deleting the separation first. For any other status (`not_started`, `processing`, or `finished`), a conflict error is returned and the separation must be explicitly deleted before creating a new one.

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

The backend derives the task ID from the stored `separatedSongInfo` and short-circuits if the provider already marks the task as finished. The status is normalized across providers using a four-state model: `not_started`, `processing`, `finished`, and `failed`. `202 Accepted` is returned when the task is still running; `200 OK` when finished or failed. Response example when finished:

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
    }
  }
}
```

`providerData` stores the raw provider-specific response payload. Stem storage paths are set separately once the client downloads and uploads the files via `PATCH /songs/:songId/separations/stems`.

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

## Update Stems

- **URL**: `PATCH /songs/:songId/separations/stems`
- **Path Params**: `songId` (string, required)
- **Query Params**:
  - `provider` (string, optional): Overrides the default provider (defaults to `poyo`)
- **Auth**: Firebase bearer token (required in production)

Called by the client after downloading stems from the provider and uploading them to Firebase Storage. The request body must contain a `stems` object mapping stem names to their Firebase Storage paths.

**Request body:**
```json
{
  "stems": {
    "vocals": "users/abc123/songs/xyz/stems/vocals.mp3",
    "accompaniment": "users/abc123/songs/xyz/stems/accompaniment.mp3"
  }
}
```

The API validates that all provided storage paths exist in Firebase Storage before persisting them to the Firestore document. Existing `providerData` is preserved.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Separation stems updated successfully"
}
```

**Error Responses**:
- `400 Bad Request` - Invalid request body or stem files not found in Storage
- `404 Not Found` (`SONG_NOT_FOUND`) - Song doesn't exist or doesn't belong to the user
- `502 Bad Gateway` (`SEPARATION_PROVIDER_ERROR`) - No separation exists for this song

## Configuration

- `SEPARATION_PROVIDER` (default: `poyo`): Separation provider to use
- `POYO_API_KEY` (required when using PoYo): PoYo API authentication key
- `POYO_API_BASE_URL` (default: `https://api.poyo.ai`): PoYo API base URL

Configuration is validated at startup; missing API key prevents boot when PoYo is selected. `provider` defaults to `poyo` when unspecified.

## Provider Interface

All separation providers implement the `StemSeparationProvider` interface, which abstracts provider-specific details and exposes a consistent API for task submission, status checking, and stem extraction.

### Task status model

Provider-specific task statuses are normalized to a unified four-state model:

- **`not_started`**: Task queued but not yet processing
- **`processing`**: Actively separating stems
- **`finished`**: Completed successfully, stems are available
- **`failed`**: Failed with an error

Each provider maps its internal states to this generic model via the `getTaskStatus()` method. For example, PoYo's `running` status maps to `processing`, while its `finished` status maps to `finished`. This abstraction allows the separation service to handle tasks uniformly regardless of the underlying provider.

### Provider resilience

- Submission requests use timeouts (10s) and retry once on 5xx/timeout from PoYo.
- Status polling uses timeouts (10s) and converts gateway issues into `503` errors.
- All provider calls include request IDs in the error response for tracing.

## Architecture

Controller → Service (fetches song) → Provider Factory (defaults to PoYo) → Provider implementation (PoYo). 

The service layer:
1. Retrieves provider from factory
2. Fetches song document with full validation
3. Checks existing separation status via `provider.getTaskStatus()` and allows retry if failed
4. Calls `provider.requestSeparation()` with audio URL and title
5. Persists provider task/status data directly via `song.updateSeparatedSongInfo()`
6. Handles provider-specific errors and converts them to domain errors

Add new providers by implementing `StemSeparationProvider` interface and registering in the factory.
