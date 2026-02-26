import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { IUnitOfWork } from '../interfaces';
import { FirestoreProvider } from './firestore.provider';

/**
 * Firestore implementation of Unit of Work pattern.
 * Manages transactions across multiple repositories.
 *
 * Firestore automatically handles transaction rollback on errors,
 * ensuring all-or-nothing semantics for multi-document operations.
 *
 * Limitations:
 * - Max document size: 1 MB
 * - Max write operations per transaction: 500
 * - Max read/write operations total: varies by operation type
 *
 * @example
 * const result = await unitOfWork.run(async (repos) => {
 *   const user = await repos.users.findById('123');
 *   user.credits -= 10;
 *   await repos.users.save(user);
 *
 *   const transaction = {
 *     id: generateId(),
 *     userId: user.id,
 *     amount: 10,
 *     timestamp: new Date(),
 *   };
 *   await repos.transactions.save(transaction);
 *
 *   return { user, transaction };
 * });
 */
@Injectable()
export class FirestoreUnitOfWork implements IUnitOfWork {
  private readonly logger = new Logger(FirestoreUnitOfWork.name);
  private readonly db: admin.firestore.Firestore;

  constructor(private readonly firestoreProvider: FirestoreProvider) {
    this.db = firestoreProvider.getFirestore();
  }

  /**
   * Executes a callback function within a Firestore transaction.
   * All repository operations within the callback use the transaction context.
   *
   * @template T - Return type
   * @param fn - Callback receiving transaction context with repositories
   * @returns Result of the callback
   * @throws Error if transaction fails; automatically rolled back
   */
  async run<T>(fn: (repos: Record<string, any>) => Promise<T>): Promise<T> {
    try {
      return await this.db.runTransaction(async (transaction) => {
        // Create transaction-aware context that can be passed to repositories
        const transactionContext = {
          transaction,
          db: this.db,
        };

        // Execute user's function with transaction context
        return fn(transactionContext);
      });
    } catch (error) {
      this.logger.error('Transaction failed and was rolled back', error);
      throw error;
    }
  }

  /**
   * Alternative run method that accepts initial repository bindings.
   * Useful for pre-configured repositories.
   *
   * @template T - Return type
   * @param repositories - Pre-configured repositories
   * @param fn - Callback function
   * @returns Result of the callback
   */
  async runWithRepositories<T>(
    repositories: Record<string, any>,
    fn: (repos: Record<string, any>) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.db.runTransaction(async (transaction) => {
        // Bind transaction context to repositories
        const boundRepos = Object.entries(repositories).reduce<
          Record<string, any>
        >((acc, [key, repo]) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          acc[key] = {
            ...repo,
            // If repositories have transaction support, pass it
            _transaction: transaction,
          };
          return acc;
        }, {});

        return fn(boundRepos);
      });
    } catch (error) {
      this.logger.error(
        'Transaction with repositories failed and was rolled back',
        error,
      );
      throw error;
    }
  }
}
