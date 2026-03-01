/**
 * Infrastructure module barrel export.
 * Re-exports all database-related modules and interfaces.
 *
 * Usage:
 * ```
 * import {
 *   DatabaseModule,
 *   FirestoreProvider,
 *   FirestoreRepository,
 *   IRepository,
 *   IUnitOfWork,
 *   BaseMapper,
 * } from './infrastructure';
 * ```
 */

// Database interfaces
export * from './database/interfaces/index';

// Mappers
export * from './database/mappers/mapper.base';

// Firestore implementation
export * from './database/firestore/index';

// Database module
export { DatabaseModule } from './database/database.module';
