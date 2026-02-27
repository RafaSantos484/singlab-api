import { Module } from '@nestjs/common';
import { FirebaseAdminProvider } from '../../auth/firebase-admin.provider';
import { AudioConversionService } from './audio-conversion.service';

/**
 * Audio module for handling audio conversion and processing.
 * Provides AudioConversionService for use across the application.
 * Depends on Firebase Admin for storage access.
 */
@Module({
  providers: [AudioConversionService, FirebaseAdminProvider],
  exports: [AudioConversionService],
})
export class AudioModule {}
