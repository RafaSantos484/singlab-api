# Songs Feature Module

Module responsible for song upload and management with automatic audio conversion and metadata persistence using Firestore transactions.

## Features

### 1. Song Upload
- Accepts audio files (MP3, WAV, OGG, WebM, AAC, FLAC, M4A, WMA, Opus) or video (MP4, WebM, MOV)
- Automatically converts file to standard MP3 format
- Validates metadata using Zod schema (title, author)
- Performs operations in atomic Firestore transactions

### 2. Storage
- **Firestore**: Document with metadata at `/users/{userId}/songs/{songId}`
  - `title`: Song title
  - `author`: Artist/Author
  - `rawSongInfo`: Object with raw file information
    - `urlInfo`: Signed URL info
      - `value`: Signed URL of file in Storage (valid for 7 days)
      - `expiresAt`: Expiration timestamp (ISO 8601)
    - `uploadedAt`: Upload timestamp (ISO 8601)
  - `status`: Processing state ('processing' → 'ready')
  - `format`: Final format ('mp3')

- **Firebase Storage**: Converted file at `/users/{userId}/songs/{songId}/raw.mp3`

### 3. Automatic URL Refresh
- Signed URLs expire in **7 days**
- Use `GET /songs/:songId/raw/url` to get always-valid URL
- Backend checks expiration and automatically renews if <24h remaining
- Client avoids broken links without complex logic

**Invariants:**
- Storage path is always `users/{userId}/songs/{songId}/raw.mp3` (used for cleanup and refresh logic).
- URL refresh updates Firestore atomically; no client-provided URL is ever trusted.
- Separation metadata (`separatedSongInfo`) is appended without mutating raw file metadata.

## Architecture

```
src/features/songs/
├── songs.module.ts              # NestJS module (imports AudioModule)
├── songs.controller.ts          # HTTP endpoints
├── songs.service.ts             # Business logic
├── dtos/
│   └── upload-song.dto.ts      # Zod schemas + types
├── utils/
│   └── audio-conversion.util.ts # ❌ DEPRECATED - Use AudioModule instead
└── index.ts                      # Public exports
```

### Module Dependencies

- **AudioModule** (src/features/audio/)
  - Provides `AudioConversionService` for audio conversion
  - Responsible for format detection and MP3 conversion
  - Implements FFmpeg with thread-safety and timeout

- **DatabaseModule** (src/infrastructure/database/)
  - Provides Firestore access
  - Repository pattern for persistence

## Endpoints

### 1. Upload Song
```http
POST /songs/upload
Content-Type: multipart/form-data
Authorization: <Firebase Auth Token>

file: <audio/video file>
metadata: {"title": "Song Name", "author": "Artist Name"}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "songId": "abc123",
    "title": "Song Name",
    "author": "Artist Name",
    "rawSongInfo": {
      "urlInfo": {
        "value": "https://storage.googleapis.com/...",
        "expiresAt": "2026-03-06T10:30:00.000Z"
      },
      "uploadedAt": "2026-02-26T10:30:00.000Z"
    }
  }
}
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
    "id": "abc123",
    "title": "Song Name",
    "author": "Artist Name",
    "rawSongInfo": {
      "urlInfo": {
        "value": "https://storage.googleapis.com/...",
        "expiresAt": "2026-03-06T10:30:00.000Z"
      },
      "uploadedAt": "2026-02-26T10:30:00.000Z"
    },
    "status": "ready",
    "format": "mp3"
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
      "id": "abc123",
      "title": "Song Name",
      "author": "Artist Name",
      "rawSongInfo": {
        "urlInfo": {
          "value": "https://storage.googleapis.com/...",
          "expiresAt": "2026-03-06T10:30:00.000Z"
        },
        "uploadedAt": "2026-02-26T10:30:00.000Z"
      },
      "status": "ready",
      "format": "mp3"
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
- Checks validity of stored URL (`urlInfo.expiresAt`)
- If <24h remaining or expired: generates new URL (valid for 7 days) and updates Firestore
- If >24h remaining: returns current URL

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "value": "https://storage.googleapis.com/...",
    "expiresAt": "2026-03-06T10:30:00.000Z",
    "refreshed": false
  }
}
```

**Field `refreshed`:**
- `false`: Existing URL still valid (cache-friendly)
- `true`: New URL generated (client should invalidate cache)

**Errors:**
- `404 Not Found`: Song does not exist or has no raw file
- `500 Internal Server Error`: Error generating signed URL

**Recommended usage:**
```typescript
// Client checks urlInfo.expiresAt before using
if (new Date(song.rawSongInfo.urlInfo.expiresAt) < new Date()) {
  const { data } = await fetch(`/songs/${songId}/raw/url`);
  song.rawSongInfo.urlInfo.value = data.value;
  song.rawSongInfo.urlInfo.expiresAt = data.expiresAt;
}
```

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
  "rawSongInfo": {"urlInfo": {"value": "hacked-url"}}
}
```
Result: Only title is updated, other fields are ignored

**Errors:**
- `400 Bad Request`: Validation failed or no valid field provided
- `404 Not Found`: Song does not exist
- `500 Internal Server Error`: Update error

### 7. Delete Song (DELETE)
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

## Zod Validation

The module automatically validates song metadata:

```typescript
{
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
```

## Audio Conversion

Uses FFmpeg to automatically convert to MP3:

- **Input**: MP3, WAV, OGG, WebM, MP4, MOV, AAC, FLAC, M4A, WMA, Opus
- **Output**: MP3 (128 kbps, 44.1 kHz, 2 channels)
- **Storage**: `/users/{userId}/songs/{songId}/raw.mp3`

### Supported Formats

**Audio:**
- MP3
- WAV
- OGG
- WebM
- AAC
- FLAC
- M4A
- WMA
- Opus

**Video (extracts audio):**
- MP4
- WebM
- MOV

## Firestore Transactions

All operations are executed in atomic transactions to ensure consistency:

1. ✅ Create Firestore document with metadata
2. ✅ Upload converted file to Storage
3. ✅ Generate signed URL
4. ✅ Update document with Storage URL
5. ❌ If any step fails, entire transaction is rolled back

**Benefits:**
- No orphaned documents without files
- No orphaned files without documents
- Guaranteed consistency between Firestore and Storage

## Configuration

### Environment Variables

```env
# Firebase
FIREBASE_SERVICE_ACCOUNT_JSON=<credentials.json>
GOOGLE_APPLICATION_CREDENTIALS=<path/to/credentials.json>

# Storage
FIREBASE_STORAGE_BUCKET=<project-id>.appspot.com
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
| 400 | `INVALID_SONG_DATA` | Metadata validation failed | Check your JSON format, title/author fields |
| 400 | `UNSUPPORTED_FILE_FORMAT` | File format not supported | Upload mp3, wav, ogg, webm, mp4, mov, etc. |
| 400 | `BAD_REQUEST` | File or metadata missing | Both `file` and `metadata` fields required |
| 401 | `UNAUTHORIZED` | No auth token | Firebase token missing or invalid |
| 404 | `SONG_NOT_FOUND` | Song doesn't exist or doesn't belong to user | Check songId and authentication |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected server error | Check logs for details using requestId |

**Request Tracing:**
Every error response includes a `requestId` that matches server-side logs. Use this when reporting issues to help developers debug.

## Usage Example (Client)

### JavaScript/TypeScript

```typescript
const uploadSong = async (file: File, title: string, author: string, authToken: string) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('metadata', JSON.stringify({ title, author }));

  const response = await fetch('/songs/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
    body: formData,
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
  -F "file=@music.mp3" \
  -F 'metadata={"title":"My Song","author":"My Name"}'
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

## Legacy Code Migration

### AudioConversionUtil (DEPRECATED)

The `audio-conversion.util.ts` utility has been replaced by `AudioConversionService` for better architecture and performance.

**Migration reasons:**
- ✅ Thread-safe FFmpeg initialization
- ✅ Direct streaming to storage (no memory accumulation)
- ✅ Timeout protection (30 seconds)
- ✅ Better error handling
- ✅ NestJS dependency injection pattern

**How to migrate your code:**

If you're still using `AudioConversionUtil`:

```typescript
// ❌ BEFORE (deprecated)
import { AudioConversionUtil } from 'src/features/songs/utils/audio-conversion.util';

const result = await AudioConversionUtil.convertToMp3(buffer, format);
```

```typescript
// ✅ AFTER
import { AudioConversionService } from 'src/features/audio/audio-conversion.service';

constructor(private audioConversionService: AudioConversionService) {}

// Replace convertToMp3() with convertAndStreamToStorage()
const result = await this.audioConversionService.convertAndStreamToStorage(
  buffer,
  format,
  storagePath
);

// Replace other methods
const format = this.audioConversionService.getFileFormat(mimetype, filename);
const isSupported = this.audioConversionService.isSupportedFormat(format);
```

**Timeline:**
- v1.x: AudioConversionUtil marked as @deprecated
- v2.0: Complete removal

## Future Improvements

- [x] ~~Signed URL caching~~ → **Auto-refresh implemented**
- [ ] Asynchronous processing with Cloud Tasks (for larger files)
- [ ] Metadata normalization (ID3 tags)
- [ ] Automatic BPM detection
- [ ] Automatic vocal/instrumental separation (stems)
- [ ] Karaoke generation with vocal removal
- [ ] Configurable file size limit
- [ ] Adaptive audio compression based on device
- [ ] Support for multiple quality versions (bitrates)

## Monitoring

Important logs for monitoring:

```
[SongsService] Song upload initiated...
[SongsService] Converting audio (mp4) to MP3 for user <id>
[SongsService] File uploaded to users/<id>/songs/<id>/raw.mp3
[SongsService] Song uploaded successfully. User: <id>, Song ID: <id>
[SongsService] Song upload failed for user <id>: <error>
```

## Troubleshooting

### FFmpeg not found
- Install FFmpeg: `brew install ffmpeg` (macOS) or `choco install ffmpeg` (Windows)
- Manually configure path if necessary

### Storage permission error
- Verify Firebase Storage security rules
- Confirm `FIREBASE_STORAGE_BUCKET` is configured

### Firestore transaction error
- Limit of 500 operations per transaction not exceeded (unlikely)
- Try again; may be temporary connectivity error

## References

- [Firebase Admin SDK - Firestore](https://firebase.google.com/docs/firestore)
- [Firebase Admin SDK - Storage](https://firebase.google.com/docs/storage)
- [Zod Documentation](https://zod.dev)
- [NestJS File Upload](https://docs.nestjs.com/techniques/file-upload)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
