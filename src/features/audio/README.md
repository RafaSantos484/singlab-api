# Audio Module

Audio conversion service for the SingLab API.

## Overview

The audio module handles conversion of various audio and video formats to MP3, with the following key improvements:

### Key Features

1. **Thread-Safe FFmpeg Initialization**
   - Uses Promise-based lock to prevent race conditions during module initialization
   - Ensures single instance across the application

2. **Efficient Stream Processing**
   - Streams audio directly from buffer to Cloud Storage
   - Minimizes memory footprint by avoiding large buffer accumulation
   - Uses Node.js streams and Google Cloud Storage write streams

3. **Timeout Protection**
   - 30-second timeout on all conversions
   - Prevents indefinite hangs if FFmpeg process fails
   - Properly cleans up resources on timeout

4. **Comprehensive Format Support**
   - Audio: MP3, WAV, OGG, WebM, AAC, FLAC, M4A, WMA, Opus
   - Video: MP4, WebM, MOV
   - MIME type detection with fallback to filename extension

## Architecture

### FFmpegProvider

Thread-safe provider for lazy-loading the FFmpeg module.

```typescript
// Gets or initializes FFmpeg in thread-safe manner
const ffmpeg = await FFmpegProvider.getInstance();
```

**Features:**
- Promise-based lock mechanism prevents multiple initializations
- Caches module after first successful initialization
- Comprehensive error handling with descriptive messages

### AudioConversionService

Main service for audio format detection and conversion.

```typescript
// Detect file format
const format = service.getFileFormat(mimetype, filename);

// Validate supported format
if (!service.isSupportedFormat(format)) {
  throw new Error('Unsupported format');
}

// Convert and stream to storage
const result = await service.convertAndStreamToStorage(
  buffer,
  format,
  storagePath
);
```

**Methods:**

- `getFileFormat(mimetype: string, originalName: string): string`
  - Detects file format from MIME or filename
  - Falls back gracefully to "unknown" if format cannot be determined

- `isSupportedFormat(format: string): boolean`
  - Validates if format is supported for conversion

- `getSupportedFormatsString(): string`
  - Returns comma-separated list of supported formats (useful for error messages)

- `convertAndStreamToStorage(buffer, format, path): Promise<{path, extension}>`
  - Main conversion method
  - Streams directly to Cloud Storage to minimize memory usage
  - Includes 30-second timeout
  - Returns storage path where file was written

## Integration with SongsService

The `SongsService` now uses `AudioConversionService` instead of the static utility:

```typescript
constructor(
  firestoreProvider: FirestoreProvider,
  firebaseAdminProvider: FirebaseAdminProvider,
  private readonly audioConversionService: AudioConversionService,
) {
  // ...
}

// Format detection
const format = this.audioConversionService.getFileFormat(mimetype, originalName);

// Conversion with streaming
const { path } = await this.audioConversionService.convertAndStreamToStorage(
  buffer,
  format,
  storagePath,
);
```

## Performance Improvements

### Memory Efficiency
- **Before:** Accumulated all chunks in memory - could exceed 512MB RAM limit in Cloud Functions
- **After:** Streams directly to Cloud Storage, constant memory footprint

### Reliability
- **Before:** No timeout protection - could hang indefinitely
- **After:** 30-second timeout on all conversions with proper cleanup

### Race Conditions
- **Before:** Lazy loading without locks could cause double-initialization
- **After:** Promise-based lock ensures single, safe initialization

## Error Handling

Errors are propagated up to `SongsService` with descriptive messages:

```
Error: Audio conversion timeout
Error: Failed to initialize FFmpeg
Error: Failed to write to storage
Error: Audio conversion failed: [underlying error]
```

## Configuration

FFmpeg configuration for MP3 conversion:
- **Codec:** libmp3lame
- **Bitrate:** 128k (balanced quality vs size)
- **Channels:** 2 (stereo)
- **Frequency:** 44100 Hz
- **Timeout:** 30 seconds

## Dependencies

- `fluent-ffmpeg` - FFmpeg command wrapper
- `ffmpeg-static` - Bundled FFmpeg binary
- `@google-cloud/storage` - Cloud Storage integration
- NestJS common utilities

## Usage in Other Modules

To use audio conversion in another feature module:

```typescript
import { AudioModule } from '../audio/audio.module';

@Module({
  imports: [AudioModule],
  // ...
})
export class MyModule {}

// In service:
constructor(
  private readonly audioConversionService: AudioConversionService,
) {}
```

## Testing

The audio module is tested through:
1. Unit tests for FFmpegProvider (initialization safety)
2. Unit tests for AudioConversionService (format detection)
3. Integration tests via SongsService (full conversion pipeline)

See [../../upload-song.dto.spec.ts] and [../../audio-conversion.util.spec.ts]

## Deprecation Notice: AudioConversionUtil

The old `src/features/songs/utils/audio-conversion.util.ts` has been replaced by this module.

**Why the change:**
- ❌ Old: Memory accumulation in buffers
- ❌ Old: Potential race conditions in FFmpeg initialization
- ❌ Old: No timeout protection
- ✅ New: Direct stream-to-storage pipeline
- ✅ New: Thread-safe FFmpeg provider
- ✅ New: 30-second timeout protection
- ✅ New: Better error handling

**Migration:**
If you have imports of the old utility, update to use `AudioConversionService`:

```typescript
// ❌ OLD
import { AudioConversionUtil } from 'src/features/songs/utils/audio-conversion.util';
const result = await AudioConversionUtil.convertToMp3(buffer, format);

// ✅ NEW
import { AudioConversionService } from 'src/features/audio/audio-conversion.service';
@Module({ imports: [AudioModule] })
constructor(private audioService: AudioConversionService) {}
const result = await this.audioService.convertAndStreamToStorage(buffer, format, path);
```

The old utility will be removed in v2.0.0.
