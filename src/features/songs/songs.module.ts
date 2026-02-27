import { Module } from '@nestjs/common';
import { SongsController } from './songs.controller';
import { SongsService } from './songs.service';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { FirebaseAdminProvider } from '../../auth/firebase-admin.provider';

/**
 * Songs feature module.
 * Manages song uploads with audio conversion and metadata persistence.
 * Uses Firestore transactions for atomic operations.
 *
 * Features:
 * - Song upload with audio/video file support
 * - Automatic audio format conversion to MP3
 * - Metadata validation using Zod
 * - Firestore transaction support for consistency
 * - Firebase Storage integration with signed URLs
 *
 * Configuration:
 * - File upload via multipart/form-data
 * - Requires Firebase Authentication
 *
 * Usage in AppModule:
 * ```typescript
 * @Module({
 *   imports: [SongsModule],
 * })
 * export class AppModule {}
 * ```
 */
@Module({
  imports: [DatabaseModule],
  controllers: [SongsController],
  providers: [SongsService, FirebaseAdminProvider],
  exports: [SongsService],
})
export class SongsModule {}
