# Stem Separations

Submit stem separation tasks for songs via a provider-agnostic interface. The controller exposes `POST /songs/:songId/separations` and returns task metadata while the provider performs the work asynchronously. The audio URL is automatically extracted from the song's `rawSongInfo`.

## Request

- **URL**: `POST /songs/:songId/separations`
- **Path Params**:
  - `songId` (string, required): ID of the song to separate.
- **Body**
  - `title` (string, optional, max 255): Custom title for the separation (defaults to song title).
  - `modelName` (enum, optional, default `base`): `base | enhanced | instrumental`.
  - `outputType` (enum, optional, default `general`): `general | bass | drums | other | piano | guitar | vocals`.
  - `callbackUrl` (string, optional): HTTPS URL for provider callback.
- **Auth**: Firebase bearer token (required in production).

The `audioUrl` is automatically obtained from the song's `rawSongInfo.urlInfo.value`. The song must exist and belong to the authenticated user.

## Response

`202 Accepted`
```json
{
  "success": true,
  "data": {
    "taskId": "...",
    "status": "queued",
    "createdTime": "2026-02-28T00:00:00Z",
    "provider": "poyo"
  }
}
```

`404 Not Found` if song doesn't exist or doesn't belong to the user.

## Configuration

- `SEPARATION_PROVIDER` (default `poyo`)
- `POYO_API_KEY` (required when provider is PoYo)
- `POYO_API_BASE_URL` (default `https://app.poyoclub.com`)

Configuration is validated at startup; missing PoYo credentials prevent boot.

## Architecture

Controller → Service (fetches song) → Provider Factory → Provider implementation (PoYo). Add new providers by implementing `StemSeparationProvider` and wiring into the factory.
