import { Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { IRepository, Page, PaginationParams } from '../interfaces';
import { BaseMapper } from '../mappers/mapper.base';
import { FirestoreProvider } from './firestore.provider';

/**
 * Base Firestore repository implementation.
 * Provides common CRUD operations for any Firestore collection.
 *
 * Extend this class to create domain-specific repositories with custom methods.
 *
 * @template TEntity - Domain entity type
 * @template TId - Entity identifier type (usually string)
 *
 * @example
 * export interface User {
 *   id: string;
 *   email: string;
 *   name: string;
 *   createdAt: Date;
 * }
 *
 * @Injectable()
 * export class UserRepository extends FirestoreRepository<User> {
 *   constructor(firestore: FirestoreProvider) {
 *     super(firestore, 'users', UserMapper);
 *   }
 *
 *   async findByEmail(email: string): Promise<User | null> {
 *     const snapshot = await this.db
 *       .collection(this.collectionName)
 *       .where('email', '==', email)
 *       .limit(1)
 *       .get();
 *
 *     if (snapshot.empty) {
 *       return null;
 *     }
 *
 *     return this.mapper.toDomain(snapshot.docs[0].data() as any);
 *   }
 *
 *   async findByEmailBatch(emails: string[]): Promise<User[]> {
 *     const users: User[] = [];
 *     for (let i = 0; i < emails.length; i += 10) {
 *       const chunk = emails.slice(i, i + 10);
 *       const snapshot = await this.db
 *         .collection(this.collectionName)
 *         .where('email', 'in', chunk)
 *         .get();
 *
 *       snapshot.docs.forEach((doc) => {
 *         users.push(this.mapper.toDomain(doc.data() as any));
 *       });
 *     }
 *     return users;
 *   }
 * }
 */
export abstract class FirestoreRepository<
  TEntity,
  TId extends string | number = string,
> implements IRepository<TEntity, TId> {
  protected readonly logger: Logger;
  protected readonly db: admin.firestore.Firestore;

  /**
   * Creates an instance of FirestoreRepository.
   *
   * @param firestore - Firestore provider instance
   * @param collectionName - Name of the Firestore collection
   * @param mapper - Mapper instance for domain/persistence conversion
   */
  constructor(
    firestore: FirestoreProvider,
    protected readonly collectionName: string,
    protected readonly mapper: BaseMapper<TEntity, any>,
  ) {
    this.logger = new Logger(this.constructor.name);
    this.db = firestore.getFirestore();
  }

  /**
   * Finds an entity by its unique identifier (document ID).
   *
   * @param id - Document ID
   * @returns Entity or null if not found
   */
  async findById(id: TId): Promise<TEntity | null> {
    try {
      const docSnapshot = await this.db
        .collection(this.collectionName)
        .doc(String(id))
        .get();

      if (!docSnapshot.exists) {
        return null;
      }

      const data = {
        id: docSnapshot.id,
        ...docSnapshot.data(),
      };

      return this.mapper.toDomain(data);
    } catch (error) {
      this.logger.error(`Error finding entity by id ${id}`, error);
      throw error;
    }
  }

  /**
   * Saves (creates or updates) an entity.
   *
   * @param entity - Entity to save
   * @returns Saved entity with the document ID
   */
  async save(entity: TEntity & { id?: TId }): Promise<TEntity> {
    try {
      const persistence = this.mapper.toPersistence(entity);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const docId = (persistence.id || this.generateId()) as TId;

      await this.db
        .collection(this.collectionName)
        .doc(String(docId))
        .set(
          {
            ...persistence,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

      const saved = await this.findById(docId);
      if (!saved) {
        throw new Error('Failed to retrieve saved entity');
      }
      return saved;
    } catch (error) {
      this.logger.error('Error saving entity', error);
      throw error;
    }
  }

  /**
   * Saves multiple entities in a batch operation.
   * Firestore limits batch writes to 500 operations.
   *
   * @param entities - Entities to save
   * @returns Saved entities
   */
  async saveBatch(entities: Array<TEntity & { id?: TId }>): Promise<TEntity[]> {
    try {
      const batchSize = 500;
      const batches = Math.ceil(entities.length / batchSize);

      for (let i = 0; i < batches; i++) {
        const batch = this.db.batch();
        const start = i * batchSize;
        const end = Math.min((i + 1) * batchSize, entities.length);

        for (let j = start; j < end; j++) {
          const entity = entities[j];

          const persistence = this.mapper.toPersistence(entity);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          const docId = (persistence.id ?? this.generateId()) as TId;

          batch.set(
            this.db.collection(this.collectionName).doc(String(docId)),
            {
              ...persistence,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true },
          );

          // Persist generated id back to entity reference to ensure consistency
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          (entities[j] as any).id = docId;
        }

        await batch.commit();
      }

      const ids = entities.map((entity) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return (entity as any).id as TId;
      });

      const results = await Promise.all(ids.map((id) => this.findById(id)));
      const persistedEntities: TEntity[] = [];

      for (const result of results) {
        if (result !== null) {
          persistedEntities.push(result);
        }
      }

      return persistedEntities;
    } catch (error) {
      this.logger.error('Error batch saving entities', error);
      throw error;
    }
  }

  /**
   * Deletes an entity by its unique identifier.
   *
   * @param id - Document ID
   * @returns true if entity was deleted, false if not found
   */
  async delete(id: TId): Promise<boolean> {
    try {
      const docRef = this.db.collection(this.collectionName).doc(String(id));
      const doc = await docRef.get();

      if (!doc.exists) {
        return false;
      }

      await docRef.delete();
      return true;
    } catch (error) {
      this.logger.error(`Error deleting entity ${id}`, error);
      throw error;
    }
  }

  /**
   * Checks if an entity exists by its unique identifier.
   *
   * @param id - Document ID
   * @returns true if entity exists
   */
  async exists(id: TId): Promise<boolean> {
    try {
      const doc = await this.db
        .collection(this.collectionName)
        .doc(String(id))
        .get();

      return doc.exists;
    } catch (error) {
      this.logger.error(`Error checking existence of ${id}`, error);
      throw error;
    }
  }

  /**
   * Counts all entities in the collection.
   *
   * @returns Total count
   */
  async count(): Promise<number> {
    try {
      const snapshot = await this.db
        .collection(this.collectionName)
        .count()
        .get();

      return snapshot.data().count;
    } catch (error) {
      this.logger.error('Error counting entities', error);
      throw error;
    }
  }

  /**
   * Finds entities with pagination support.
   * Extends base repository for list operations.
   *
   * @param params - Pagination parameters
   * @returns Paginated list of entities
   */
  protected async findWithPagination(
    params: PaginationParams,
  ): Promise<Page<TEntity>> {
    try {
      const {
        page,
        limit,
        orderBy = 'createdAt',
        orderDirection = 'desc',
      } = params;

      const offset = (page - 1) * limit;

      // Get total count
      const countSnapshot = await this.db
        .collection(this.collectionName)
        .count()
        .get();
      const total = countSnapshot.data().count;

      // Get paginated results
      let query: admin.firestore.Query = this.db.collection(
        this.collectionName,
      );

      if (orderBy) {
        query = query.orderBy(
          orderBy,
          orderDirection as admin.firestore.OrderByDirection,
        );
      }

      const snapshot = await query
        .offset(offset)
        .limit(limit + 1)
        .get();

      const items = snapshot.docs.map((doc) => {
        const data = {
          id: doc.id,
          ...doc.data(),
        };
        return this.mapper.toDomain(data);
      });

      const hasNextPage = items.length > limit;
      if (hasNextPage) {
        items.pop(); // Remove the extra fetched item
      }

      return {
        items,
        total,
        page,
        limit,
        hasNextPage,
        hasPreviousPage: page > 1,
      };
    } catch (error) {
      this.logger.error('Error fetching paginated entities', error);
      throw error;
    }
  }

  /**
   * Generates a unique document ID.
   * Can be overridden in subclasses for custom ID generation.
   *
   * @returns Generated ID
   */
  protected generateId(): string {
    return this.db.collection(this.collectionName).doc().id;
  }
}
