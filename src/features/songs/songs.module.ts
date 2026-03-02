import { Module } from '@nestjs/common';
import { SongsController } from './songs.controller';
import { SongsService } from './songs.service';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { FirebaseAdminProvider } from '../../auth/firebase-admin.provider';

/**
 * Songs feature module.
 * Manages song metadata registration and retrieval.
 * The client is responsible for uploading raw audio files to Cloud Storage.
 * This module only validates storage file existence and persists Firestore docs.
 *
 * Features:
 * - Song registration (validates Storage file, persists Firestore doc)
 * - Metadata validation using Zod
 * - Firebase Storage signed URL generation on demand
 *
 * Dependencies:
 * - DatabaseModule: Provides Firestore and repository access
 *
 * Configuration:
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
