# Songs Feature Module

Module responsible for song metadata registration and management. The client is responsible for uploading the raw audio file to Firebase Storage; this module validates that the file exists and persists the Firestore document.

## Features

### 1. Song Registration
- Client pre-generates a `songId` and uploads the audio file to Storage at the canonical path
- API validates the metadata (`songId`, `title`, `author`) using Zod schema
- API verifies that the file exists at `users/:userId/songs/:songId/raw.mp3` before creating the document
- No server-side audio conversion — the client is responsible for providing a compatible MP3

### 2. Storage
- **Firestore**: Document with metadata at `/users/{userId}/songs/{songId}`
  - `title`: Song title
  - `author`: Artist/Author
  - `rawSongInfo`: Object with raw file information
    - `path`: Storage path of the raw MP3 (e.g. `users/{userId}/songs/{songId}/raw.mp3`)
    - `uploadedAt`: ISO timestamp of registration

- **Firebase Storage**: Raw audio file at `/users/{userId}/songs/{songId}/raw.mp3`
  - Uploaded by the client before calling `POST /songs/upload`
  - On deletion, all files under `users/{userId}/songs/{songId}/` are removed (raw + stems)

### 3. On-demand signed URLs
- Signed URLs are generated only when requested (valid for 7 days)
- Use `GET /songs/:songId/raw/url` to obtain a fresh URL based on the stored path
- No expiration metadata is stored; clients fetch a new URL when needed

**Invariants:**
- Storage path is always `users/{userId}/songs/{songId}/raw.mp3` (used for cleanup and URL generation).
- Separation metadata (`separatedSongInfo` with providerData + stems) is appended without mutating raw file metadata.

## Architecture

```
src/features/songs/
├── songs.module.ts              # NestJS module
├── songs.controller.ts          # HTTP endpoints
├── songs.service.ts             # Business logic
├── dtos/
│   └── upload-song.dto.ts      # Zod schemas + types
├── utils/
│   └── audio-conversion.util.ts # ❌ DEPRECATED
└── index.ts                      # Public exports
```

### Module Dependencies

- **DatabaseModule** (src/infrastructure/database/)
  - Provides Firestore access
  - Repository pattern for persistence

## Endpoints

### 1. Register Song
```http
POST /songs/upload
Content-Type: application/json
Authorization: <Firebase Auth Token>

{
  "songId": "abc123",
  "title": "Song Name",
  "author": "Artist Name"
}
```

**Prerequisites:**
1. Generate a `songId` (e.g. Firestore client-side document ID).
2. Upload the raw audio file to Firebase Storage at `users/:userId/songs/:songId/raw.mp3`.
3. Call this endpoint to register the document in Firestore.

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "songId": "abc123",
    "title": "Song Name",
    "author": "Artist Name",
    "rawSongInfo": {
      "path": "users/abc123/songs/xyz/raw.mp3",
      "uploadedAt": "2026-03-02T00:00:00.000Z"
    }
  }
}
```

**Errors:**
- `400 Bad Request`: Validation failed or raw file not found in Storage
- `401 Unauthorized`: Missing or invalid Firebase token
- `500 Internal Server Error`: Storage check or database failure
```

### 2. Get Song by ID
```http
GET /songs/:songId
Authorization: <Firebase Auth Token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "title": "Song Name",
    "author": "Artist Name",
    "rawSongInfo": {
      "path": "users/abc123/songs/xyz/raw.mp3",
      "uploadedAt": "2026-03-02T00:00:00.000Z"
    },
    "separatedSongInfo": null
  }
}
```

### 3. List User Songs
```http
GET /songs
Authorization: <Firebase Auth Token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "title": "Song Name",
      "author": "Artist Name",
      "rawSongInfo": {
        "path": "users/abc123/songs/xyz/raw.mp3",
        "uploadedAt": "2026-03-02T00:00:00.000Z"
      },
      "separatedSongInfo": null
    }
  ],
  "total": 1
}
```

### 4. Get Refreshed Raw File URL
```http
GET /songs/:songId/raw/url
Authorization: <Firebase Auth Token>
```

**Behavior:**
- Generates a signed URL (valid for 7 days) based on the stored path
- No expiration metadata is persisted in Firestore

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "value": "https://storage.googleapis.com/...",
    "path": "users/abc123/songs/xyz/raw.mp3"
  }
}
```

**Errors:**
- `404 Not Found`: Song does not exist or has no raw file
- `500 Internal Server Error`: Error generating signed URL

### 5. Delete Song
```http
DELETE /songs/:songId
Authorization: <Firebase Auth Token>
```

Deletes the song and its associated file from Cloud Storage.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Song deleted successfully"
}
```

**Errors:**
- `404 Not Found`: Song does not exist
- `500 Internal Server Error`: Error deleting file/document

### 6. Update Song Metadata (PATCH)
```http
PATCH /songs/:songId
Content-Type: application/json
Authorization: <Firebase Auth Token>

{
  "title": "New Song Title",
  "author": "New Artist Name"
}
```

Updates only title and/or author fields. Unspecified fields are not modified. Requests with file-related fields (file, rawSongInfo, etc.) have those fields automatically ignored.

**Validation:**
- `title`: 1-255 characters (optional)
- `author`: 1-255 characters (optional)
- At least one field must be provided
- Updating file or other sensitive information is not allowed

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "title": "New Song Title",
    "author": "New Artist Name"
  }
}
```

**Examples:**

Update title only:
```http
PATCH /songs/abc123
{"title": "Updated Title"}
```

Update both:
```http
PATCH /songs/abc123
{"title": "New Title", "author": "New Author"}
```

Ignore disallowed fields (security example):
```http
PATCH /songs/abc123
{
  "title": "New Title",
  "file": "malicious-file.mp3",
  "rawSongInfo": {"path": "malicious-path.mp3"}
}
```
Result: Only title is updated, other fields are ignored

**Errors:**
- `400 Bad Request`: Validation failed or no valid field provided
- `404 Not Found`: Song does not exist
- `500 Internal Server Error`: Update error

## Zod Validation

The module automatically validates song registration metadata:

```typescript
{
  songId: string   // 1-128 characters
  title: string    // 1-255 characters
  author: string   // 1-255 characters
}
```

Validation errors return `400 Bad Request`:
```json
{
  "statusCode": 400,
  "message": "Invalid song data: Title is required; Author must be at most 255 characters"
}

## Configuration

### Environment Variables

```env
# Firebase
FIREBASE_SERVICE_ACCOUNT_JSON=<credentials.json>
GOOGLE_APPLICATION_CREDENTIALS=<path/to/credentials.json>

# Storage
APP_FIREBASE_STORAGE_BUCKET=<project-id>.appspot.com
```

### Firestore/Storage Permissions

```
# firestore.rules
match /users/{userId}/songs/{document=**} {
  allow read, write: if request.auth.uid == userId;
}

# storage.rules
match /users/{userId}/songs/{allPaths=**} {
  allow read, write: if request.auth.uid == userId;
}
```

## Error Handling

The Songs module uses a standardized error response format with error codes and request IDs for tracing:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_SONG_DATA",
    "message": "Error message describing what went wrong",
    "statusCode": 400,
    "timestamp": "2026-02-28T10:30:45.123Z",
    "requestId": "req-abc123-def456"
  }
}
```

**Common Errors:**

| HTTP Status | Code | Cause | Notes |
|-------------|------|-------|-------|
| 400 | `INVALID_SONG_DATA` | Metadata validation failed | Check songId, title, author fields |
| 400 | `BAD_REQUEST` | Raw file not found in Storage | Upload the file to Storage before calling this endpoint |
| 401 | `UNAUTHORIZED` | No auth token | Firebase token missing or invalid |
| 404 | `SONG_NOT_FOUND` | Song doesn't exist or doesn't belong to user | Check songId and authentication |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected server error | Check logs for details using requestId |

**Request Tracing:**
Every error response includes a `requestId` that matches server-side logs. Use this when reporting issues to help developers debug.

## Usage Example (Client)

### JavaScript/TypeScript

```typescript
import { getStorage, ref, uploadBytes } from 'firebase/storage';
import { getFirestore, doc } from 'firebase/firestore';

const registerSong = async (file: File, title: string, author: string, authToken: string) => {
  const storage = getStorage();
  const songId = doc(getFirestore(), 'dummy').id; // generate a client-side ID

  // 1. Upload raw audio to Firebase Storage
  const storageRef = ref(storage, `users/${userId}/songs/${songId}/raw.mp3`);
  await uploadBytes(storageRef, file);

  // 2. Register metadata with the API
  const response = await fetch('/songs/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ songId, title, author }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
};
```

### cURL

```bash
curl -X POST http://localhost:5001/songs/upload \
  -H "Authorization: Bearer <firebase-token>" \
  -H "Content-Type: application/json" \
  -d '{"songId": "abc123", "title": "My Song", "author": "My Name"}'
```

## Local Development

### Running Tests

```bash
# All tests
npm test

# Songs tests only
npm test -- features/songs

# Watch mode
npm test:watch
```

### Running Local Server

```bash
npm run dev
```

Access: `http://localhost:5001`

### Firebase Emulator

```bash
npm run serve
```

## Legacy Code

### AudioConversionUtil (DEPRECATED)

The `audio-conversion.util.ts` utility is deprecated and kept for reference only.

## Future Improvements

- [x] ~~Signed URL caching~~ → **Auto-refresh implemented**
- [x] ~~Client-side upload flow~~ → **Implemented**
- [ ] Metadata normalization (ID3 tags)
- [ ] Automatic BPM detection
- [ ] Configurable file size limits
- [ ] Support for multiple quality versions (bitrates)

## Monitoring

Important logs for monitoring:

```
[SongsController] Song registration initiated for user: <id>
[SongsService] Song registered successfully for user: <id>, song ID: <id>
[SongsService] Song upload failed for user <id>: <error>
[SongsService] Storage existence check failed for path <path>: <error>
```

## Troubleshooting

### Raw file not found (400)
- Ensure the audio file is uploaded to `users/:userId/songs/:songId/raw.mp3` in Firebase Storage **before** calling `POST /songs/upload`
- Verify the `songId` in the request body matches the one used for the Storage upload

## References

- [Firebase Admin SDK - Firestore](https://firebase.google.com/docs/firestore)
- [Firebase Admin SDK - Storage](https://firebase.google.com/docs/storage)
- [Firebase Storage - Client Upload](https://firebase.google.com/docs/storage/web/upload-files)
- [Zod Documentation](https://zod.dev)
