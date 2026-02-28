# Stem Separations

Submit stem separation tasks for songs via a provider-agnostic interface. The controller exposes `POST /songs/:songId/separations` and returns task metadata while the provider performs the work asynchronously. The audio URL is automatically extracted from the song's `rawSongInfo`.

## Request

- **URL**: `POST /songs/:songId/separations`
- **Path Params**:
  - `songId` (string, required): ID of the song to separate.
- **Query Params**:
  - `provider` (string, optional): Separation provider to use (defaults to first available provider).
- **Body**: none
- **Auth**: Firebase bearer token (required in production).

The `audioUrl` and `title` are automatically obtained from the song document (`rawSongInfo.urlInfo.value` and `title`).
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

**Error Responses**:
- `404 Not Found` - Song doesn't exist or doesn't belong to the user
- `409 Conflict` - Separation already exists for this audio with the provider
- `502 Bad Gateway` - Provider returned an error
- `503 Service Unavailable` - Provider is temporarily unavailable

## Configuration

- `POYO_API_KEY` (required): PoYo API authentication key
- `POYO_API_BASE_URL` (default: `https://api.poyo.ai`): PoYo API base URL

Configuration is validated at startup; missing API key prevents boot.

## Architecture

Controller → Service (fetches song) → Provider Factory → Provider implementation (PoYo). 

The service layer:
1. Retrieves provider from factory
2. Fetches song document with full validation
3. Calls `provider.requestSeparation()` with audio URL and title
4. Handles provider-specific errors and converts them to HTTP exceptions

Add new providers by implementing `StemSeparationProvider` interface and registering in the factory.
