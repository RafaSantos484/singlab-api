import { Module } from '@nestjs/common';
import { FirestoreProvider } from './firestore/firestore.provider';
import { FirestoreUnitOfWork } from './firestore/firestore-unit-of-work';

/**
 * Database module providing Firestore infrastructure.
 * Centralizes all database-related providers and services.
 *
 * Exports:
 * - FirestoreProvider: Factory for Firestore instance
 * - FirestoreUnitOfWork: Transaction management
 *
 * Usage:
 * ```
 * @Module({
 *   imports: [DatabaseModule],
 * })
 * export class AppModule {}
 * ```
 */
@Module({
  providers: [FirestoreProvider, FirestoreUnitOfWork],
  exports: [FirestoreProvider, FirestoreUnitOfWork],
})
export class DatabaseModule {}
