import { Module } from '@nestjs/common';
import { SongsController } from './songs.controller';
import { SongsService } from './songs.service';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { FirebaseAdminProvider } from '../../auth/firebase-admin.provider';
import { AudioModule } from '../audio/audio.module';

/**
 * Songs feature module.
 * Manages song uploads with audio conversion and metadata persistence.
 * Uses Firestore transactions for atomic operations.
 *
 * Features:
 * - Song upload with audio/video file support
 * - Automatic audio format conversion to MP3 (via AudioModule)
 * - Metadata validation using Zod
 * - Firestore transaction support for consistency
 * - Firebase Storage integration with signed URLs
 *
 * Dependencies:
 * - AudioModule: Provides AudioConversionService for format conversion
 * - DatabaseModule: Provides Firestore and repository access
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
  imports: [DatabaseModule, AudioModule],
  controllers: [SongsController],
  providers: [SongsService, FirebaseAdminProvider],
  exports: [SongsService],
})
export class SongsModule {}
