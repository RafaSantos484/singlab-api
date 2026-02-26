/**
 * Base repository interface for domain-oriented data access.
 * Each entity should have its own repository implementing this interface
 * with domain-specific methods (not generic CRUD).
 *
 * @template TEntity - Domain entity type
 * @template TId - Entity identifier type (usually string or number)
 */
export interface IRepository<TEntity, TId = string> {
  /**
   * Finds an entity by its unique identifier.
   *
   * @param id - Entity identifier
   * @returns Entity or null if not found
   */
  findById(id: TId): Promise<TEntity | null>;

  /**
   * Saves (creates or updates) an entity.
   * Should be atomic and handle both insert and update scenarios.
   *
   * @param entity - Entity to save
   * @returns Saved entity with any generated fields
   */
  save(entity: TEntity): Promise<TEntity>;

  /**
   * Saves multiple entities in a batch operation.
   * Should be optimized for bulk writes.
   *
   * @param entities - Entities to save
   * @returns Saved entities
   */
  saveBatch(entities: TEntity[]): Promise<TEntity[]>;

  /**
   * Deletes an entity by its unique identifier.
   *
   * @param id - Entity identifier
   * @returns true if entity was deleted, false if not found
   */
  delete(id: TId): Promise<boolean>;

  /**
   * Checks if an entity exists by its unique identifier.
   *
   * @param id - Entity identifier
   * @returns true if entity exists, false otherwise
   */
  exists(id: TId): Promise<boolean>;

  /**
   * Counts all entities in the repository.
   *
   * @returns Total count of entities
   */
  count(): Promise<number>;
}

/**
 * Pagination parameters for list operations.
 */
export interface PaginationParams {
  page: number;
  limit: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

/**
 * Paginated response data.
 */
export interface Page<TEntity> {
  items: TEntity[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
