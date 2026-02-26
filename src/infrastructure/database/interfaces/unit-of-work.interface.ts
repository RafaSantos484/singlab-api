import { IRepository } from './repository.interface';

/**
 * Unit of Work interface for managing transactions across multiple repositories.
 * Ensures that multiple operations either all succeed or all fail together.
 *
 * This pattern is essential for maintaining data consistency when operations
 * span multiple entities/aggregates.
 */
export interface IUnitOfWork {
  /**
   * Executes a callback function within a transaction context.
   * All repository operations within the callback will be part of the same transaction.
   *
   * If the callback throws an error, the transaction is rolled back.
   * If it succeeds, all changes are committed atomically.
   *
   * @template T - Return type of the callback
   * @param fn - Async function that receives repositories and performs operations
   * @returns Result of the callback function
   *
   * @example
   * const result = await unitOfWork.run(async (repos) => {
   *   const user = await repos.users.findById('123');
   *   user.credits -= 10;
   *   await repos.users.save(user);
   *   await repos.transactions.save(tx);
   *   return user.id;
   * });
   */
  run<T>(
    fn: (repos: Record<string, IRepository<any>>) => Promise<T>,
  ): Promise<T>;
}

/**
 * Transaction context containing multiple repositories.
 * Passed to the UnitOfWork callback function to perform operations.
 *
 * @example
 * interface TransactionContext {
 *   users: IRepository<User>;
 *   orders: IRepository<Order>;
 *   payments: IRepository<Payment>;
 * }
 */
export type TransactionContext = Record<string, IRepository<any>>;
