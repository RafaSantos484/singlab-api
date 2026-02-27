import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { FirebaseAdminProvider } from '../../auth/firebase-admin.provider';

/**
 * Users feature module.
 * Manages user creation with Firebase Authentication and Firestore persistence.
 *
 * Strategy:
 * 1. Create user in Firebase Authentication.
 * 2. Persist profile document in Firestore (document ID = Auth UID).
 * 3. Roll back Auth user if Firestore write fails.
 *
 * Dependencies:
 * - DatabaseModule: Provides Firestore access.
 * - FirebaseAdminProvider: Provides Firebase Auth access.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [UsersController],
  providers: [UsersService, FirebaseAdminProvider],
  exports: [UsersService],
})
export class UsersModule {}
