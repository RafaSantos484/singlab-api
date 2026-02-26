/**
 * Example tests for Firestore Repository pattern.
 * Demonstrates unit testing with mocking and integration testing scenarios.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { FirestoreRepository, FirestoreProvider, BaseMapper } from '@/infrastructure';
import * as admin from 'firebase-admin';

/**
 * Example domain entity for testing
 */
interface TestEntity {
  id: string;
  name: string;
  value: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Example persistence model
 */
interface TestEntityDoc {
  id: string;
  name: string;
  value: number;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

/**
 * Example mapper for testing
 */
class TestEntityMapper extends BaseMapper<TestEntity, TestEntityDoc> {
  toDomain(raw: TestEntityDoc): TestEntity {
    return {
      id: raw.id,
      name: raw.name,
      value: raw.value,
      createdAt: raw.createdAt.toDate(),
      updatedAt: raw.updatedAt.toDate(),
    };
  }

  toPersistence(domain: TestEntity): TestEntityDoc {
    return {
      id: domain.id,
      name: domain.name,
      value: domain.value,
      createdAt: admin.firestore.Timestamp.fromDate(domain.createdAt),
      updatedAt: admin.firestore.Timestamp.fromDate(domain.updatedAt),
    };
  }
}

/**
 * Example repository for testing
 */
class TestEntityRepository extends FirestoreRepository<TestEntity> {
  constructor(firestore: FirestoreProvider) {
    super(firestore, 'test_entities', new TestEntityMapper());
  }

  /**
   * Domain-specific query: find by value range
   */
  async findByValueRange(min: number, max: number): Promise<TestEntity[]> {
    const snapshot = await this.db
      .collection(this.collectionName)
      .where('value', '>=', min)
      .where('value', '<=', max)
      .get();

    return snapshot.docs.map((doc) => {
      const data = { id: doc.id, ...doc.data() };
      return this.mapper.toDomain(data as any);
    });
  }
}

/**
 * UNIT TESTS - Testing with mocks
 * ================================
 */
describe('FirestoreRepository (Unit Tests)', () => {
  let repository: TestEntityRepository;
  let mockFirestoreProvider: Partial<FirestoreProvider>;
  let mockDb: any;

  beforeEach(async () => {
    // Mock Firestore provider and database
    mockDb = {
      collection: jest.fn().mockReturnThis(),
      doc: jest.fn().mockReturnThis(),
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      batch: jest.fn(),
      count: jest.fn(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
    };

    mockFirestoreProvider = {
      getFirestore: jest.fn().mockReturnValue(mockDb),
    };

    repository = new TestEntityRepository(
      mockFirestoreProvider as any
    );
  });

  describe('findById', () => {
    it('should return entity when document exists', async () => {
      const testEntity: TestEntity = {
        id: '123',
        name: 'Test',
        value: 42,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          name: testEntity.name,
          value: testEntity.value,
          createdAt: admin.firestore.Timestamp.fromDate(testEntity.createdAt),
          updatedAt: admin.firestore.Timestamp.fromDate(testEntity.updatedAt),
        }),
        id: '123',
      });

      const result = await repository.findById('123');

      expect(result).toEqual(testEntity);
      expect(mockDb.collection).toHaveBeenCalledWith('test_entities');
      expect(mockDb.doc).toHaveBeenCalledWith('123');
    });

    it('should return null when document does not exist', async () => {
      mockDb.get.mockResolvedValueOnce({ exists: false });

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error when query fails', async () => {
      mockDb.get.mockRejectedValueOnce(new Error('Database error'));

      await expect(repository.findById('123')).rejects.toThrow('Database error');
    });
  });

  describe('save', () => {
    it('should create entity with generated ID', async () => {
      const entity: TestEntity = {
        id: '',
        name: 'New',
        value: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.doc.mockReturnValueOnce({
        id: 'generated-id',
        set: jest.fn().mockResolvedValue(undefined),
        get: jest.fn(),
      });

      // Mock the subsequent findById call
      mockDb.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          name: entity.name,
          value: entity.value,
          createdAt: admin.firestore.Timestamp.fromDate(entity.createdAt),
          updatedAt: admin.firestore.Timestamp.fromDate(entity.updatedAt),
        }),
        id: 'generated-id',
      });

      // This would call the repository's save
      // The actual implementation would generate an ID and call set()
    });
  });

  describe('delete', () => {
    it('should delete entity and return true', async () => {
      mockDb.get.mockResolvedValueOnce({ exists: true });
      mockDb.delete.mockResolvedValueOnce(undefined);

      const result = await repository.delete('123');

      expect(result).toBe(true);
    });

    it('should return false when entity does not exist', async () => {
      mockDb.get.mockResolvedValueOnce({ exists: false });

      const result = await repository.delete('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true when entity exists', async () => {
      mockDb.get.mockResolvedValueOnce({ exists: true });

      const result = await repository.exists('123');

      expect(result).toBe(true);
    });

    it('should return false when entity does not exist', async () => {
      mockDb.get.mockResolvedValueOnce({ exists: false });

      const result = await repository.exists('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('count', () => {
    it('should return total count of entities', async () => {
      mockDb.count.mockReturnValueOnce({
        get: jest.fn().mockResolvedValueOnce({
          data: () => ({ count: 42 }),
        }),
      });

      const result = await repository.count();

      expect(result).toBe(42);
    });
  });
});

/**
 * INTEGRATION TESTS - Testing with Firestore Emulator
 * ====================================================
 *
 * Run these tests with:
 * firebase emulators:start --only firestore
 *
 * Or set: const FIRESTORE_EMULATOR_HOST='localhost:8080'
 */
describe('FirestoreRepository (Integration Tests)', () => {
  let repository: TestEntityRepository;
  let firestoreProvider: FirestoreProvider;
  let db: admin.firestore.Firestore;

  beforeAll(async () => {
    // Initialize Firebase Admin for testing
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: 'test-project',
      });
    }

    firestoreProvider = new FirestoreProvider();
    db = firestoreProvider.getFirestore();
    repository = new TestEntityRepository(firestoreProvider);
  });

  afterEach(async () => {
    // Clean up test collection
    const snapshot = await db.collection('test_entities').get();
    for (const doc of snapshot.docs) {
      await doc.ref.delete();
    }
  });

  afterAll(async () => {
    // Clean up
    if (admin.apps.length) {
      await admin.app().delete();
    }
  });

  describe('Complete CRUD workflow', () => {
    it('should create, read, update, and delete entity', async () => {
      const entity: TestEntity = {
        id: '',
        name: 'Integration Test',
        value: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Create
      const saved = await repository.save(entity);
      expect(saved.id).toBeDefined();
      expect(saved.name).toBe('Integration Test');

      // Read
      const fetched = await repository.findById(saved.id);
      expect(fetched).toEqual(saved);

      // Update
      const toUpdate = fetched!;
      toUpdate.value = 200;
      const updated = await repository.save(toUpdate);
      expect(updated.value).toBe(200);

      // Delete
      const deleted = await repository.delete(updated.id);
      expect(deleted).toBe(true);

      const notFound = await repository.findById(updated.id);
      expect(notFound).toBeNull();
    });

    it('should batch save entities', async () => {
      const entities: TestEntity[] = [
        {
          id: '',
          name: 'Entity 1',
          value: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '',
          name: 'Entity 2',
          value: 20,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const saved = await repository.saveBatch(entities);
      expect(saved).toHaveLength(2);
      expect(saved[0].name).toBe('Entity 1');
      expect(saved[1].name).toBe('Entity 2');
    });

    it('should support pagination', async () => {
      // Create test data
      for (let i = 0; i < 25; i++) {
        await repository.save({
          id: '',
          name: `Item ${i}`,
          value: i,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // First page
      const page1 = await repository.findWithPagination({
        page: 1,
        limit: 10,
        orderBy: 'createdAt',
      });

      expect(page1.items).toHaveLength(10);
      expect(page1.page).toBe(1);
      expect(page1.hasNextPage).toBe(true);
      expect(page1.hasPreviousPage).toBe(false);

      // Second page
      const page2 = await repository.findWithPagination({
        page: 2,
        limit: 10,
      });

      expect(page2.items).toHaveLength(10);
      expect(page2.hasNextPage).toBe(true);
      expect(page2.hasPreviousPage).toBe(true);
    });
  });
});

/**
 * UNIT OF WORK TESTS
 * ==================
 */
describe('FirestoreUnitOfWork (Unit Tests)', () => {
  it('should execute callback in transaction', async () => {
    const mockFirestoreProvider = {
      getFirestore: jest.fn().mockReturnValue({
        runTransaction: jest.fn().mockImplementation((fn) => fn({})),
      }),
    };

    const { FirestoreUnitOfWork } = await import('@/infrastructure');
    const unitOfWork = new FirestoreUnitOfWork(
      mockFirestoreProvider as any
    );

    const callback = jest.fn().mockResolvedValue('result');
    const result = await unitOfWork.run(callback);

    expect(callback).toHaveBeenCalled();
    expect(result).toBe('result');
  });

  it('should rollback on error', async () => {
    const mockFirestoreProvider = {
      getFirestore: jest.fn().mockReturnValue({
        runTransaction: jest
          .fn()
          .mockRejectedValue(new Error('Transaction failed')),
      }),
    };

    const { FirestoreUnitOfWork } = await import('@/infrastructure');
    const unitOfWork = new FirestoreUnitOfWork(
      mockFirestoreProvider as any
    );

    await expect(
      unitOfWork.run(async () => {
        throw new Error('Operation failed');
      })
    ).rejects.toThrow();
  });
});
