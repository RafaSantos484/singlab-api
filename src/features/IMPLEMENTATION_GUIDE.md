# Firestore Repository Implementation Guide

Complete step-by-step guide for implementing repositories for any entity in the SingLab API.

## Overview

This guide shows how to implement the repository pattern with Firestore using the SingLab infrastructure layer.

## File Structure for a New Entity

```
src/features/your-feature/
├── domain/
│   └── your-entity.ts
├── mappers/
│   └── your-entity.mapper.ts
├── repositories/
│   └── your-entity.repository.ts  
├── services/
│   └── your-entity.service.ts
├── controllers/
│   └── your-entity.controller.ts
└── your-feature.module.ts
```

---

## Step 1: Define Domain Entity

Create `src/features/your-feature/domain/your-entity.ts`:

```typescript
/**
 * Domain entity - no persistence concerns, pure business logic
 */
export interface YourEntity {
  id: string;
  // Your fields here
  createdAt: Date;
  updatedAt: Date;
}
```

**Rules:**
- No Firebase/Firestore imports
- Dates as JavaScript `Date` objects
- All business logic and validation here
- Interfaces or classes (prefer interfaces for simplicity)

---

## Step 2: Create Mapper

Create `src/features/your-feature/mappers/your-entity.mapper.ts`:

```typescript
import { BaseMapper } from '@/infrastructure';
import * as admin from 'firebase-admin';
import { YourEntity } from '../domain/your-entity';

/**
 * Persistence model - how data is stored in Firestore
 */
interface YourEntityDocument {
  id: string;
  // Your fields matching domain
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

/**
 * Mapper - converts between domain and persistence
 */
export class YourEntityMapper extends BaseMapper<
  YourEntity,
  YourEntityDocument
> {
  /**
   * Convert from Firestore document to domain entity
   */
  toDomain(raw: YourEntityDocument): YourEntity {
    return {
      id: raw.id,
      // Map your fields
      createdAt: raw.createdAt.toDate(),
      updatedAt: raw.updatedAt.toDate(),
    };
  }

  /**
   * Convert from domain entity to Firestore document
   */
  toPersistence(domain: YourEntity): YourEntityDocument {
    return {
      id: domain.id,
      // Map your fields
      createdAt: admin.firestore.Timestamp.fromDate(domain.createdAt),
      updatedAt: admin.firestore.Timestamp.fromDate(domain.updatedAt),
    };
  }
}
```

**Rules:**
- Extend `BaseMapper<TDomain, TPersistence>`
- Implement both `toDomain()` and `toPersistence()`
- Handle date conversions (Date ↔ Timestamp)
- Keep mapping logic simple

---

## Step 3: Create Repository

Create `src/features/your-feature/repositories/your-entity.repository.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import {
  FirestoreRepository,
  FirestoreProvider,
  Page,
} from '@/infrastructure';
import { YourEntity } from '../domain/your-entity';
import { YourEntityMapper } from '../mappers/your-entity.mapper';

/**
 * Domain-specific repository for YourEntity
 * 
 * Base class automatically provides:
 * - findById(id)
 * - save(entity)
 * - saveBatch(entities)
 * - delete(id)
 * - exists(id)
 * - count()
 * - findWithPagination(params)
 * - generateId()
 * 
 * Add your domain-specific queries here
 */
@Injectable()
export class YourEntityRepository extends FirestoreRepository<YourEntity> {
  constructor(firestore: FirestoreProvider) {
    super(firestore, 'collection_name', new YourEntityMapper());
  }

  /**
   * Domain-specific query example
   * 
   * Replace 'field' and 'value' with your actual fields
   */
  async findByField(value: string): Promise<YourEntity[]> {
    try {
      const snapshot = await this.db
        .collection(this.collectionName)
        .where('field', '==', value)
        .get();

      return snapshot.docs.map((doc) => {
        const data = { id: doc.id, ...doc.data() };
        return this.mapper.toDomain(data as any);
      });
    } catch (error) {
      this.logger.error(`Error finding ${value}`, error);
      throw error;
    }
  }

  /**
   * Paginated query example
   */
  async findPaginated(
    page: number = 1,
    limit: number = 20,
  ): Promise<Page<YourEntity>> {
    return this.findWithPagination({
      page,
      limit,
      orderBy: 'createdAt',
      orderDirection: 'desc',
    });
  }
}
```

**Rules:**
- Extend `FirestoreRepository<YourEntity>`
- Pass collection name to super() - must match Firestore collection
- Add domain-specific methods (not generic CRUD)
- Methods express business intent
- Handle errors with logging

---

## Step 4: Create Service

Create `src/features/your-feature/services/your-entity.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { YourEntityRepository } from '../repositories/your-entity.repository';
import { YourEntity } from '../domain/your-entity';
import { FirestoreUnitOfWork } from '@/infrastructure';

/**
 * Creates DTO for input validation
 */
export interface CreateYourEntityDto {
  // Your fields here
}

/**
 * Service layer - orchestrates business logic
 */
@Injectable()
export class YourEntityService {
  constructor(
    private readonly repository: YourEntityRepository,
    private readonly unitOfWork: FirestoreUnitOfWork,
  ) {}

  /**
   * Create new entity
   */
  async create(dto: CreateYourEntityDto): Promise<YourEntity> {
    // Validation
    if (!dto) {
      throw new Error('DTO required');
    }

    // Create entity
    const entity: YourEntity = {
      id: '', // Will be generated
      // Map DTO to entity
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.repository.save(entity);
  }

  /**
   * Get by ID
   */
  async getById(id: string): Promise<YourEntity> {
    const entity = await this.repository.findById(id);

    if (!entity) {
      throw new NotFoundException(`Entity ${id} not found`);
    }

    return entity;
  }

  /**
   * Multi-entity operation using Unit of Work
   * All operations succeed or fail together
   */
  async complexOperation(): Promise<void> {
    await this.unitOfWork.run(async () => {
      const entity = await this.repository.findById('123');
      
      if (entity) {
        // Modify entity
        entity.updatedAt = new Date();
        
        // Save
        await this.repository.save(entity);
      }

      // Other operations...
    });
  }
}
```

**Rules:**
- Single responsibility: business logic
- Use repository for data access
- Use Unit of Work for multi-entity operations
- Validate input, throw appropriate errors
- Return domain entities, not DTOs

---

## Step 5: Create Controller

Create `src/features/your-feature/controllers/your-entity.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpStatus,
} from '@nestjs/common';
import { YourEntityService, CreateYourEntityDto } from '../services/your-entity.service';

@Controller('your-entities')
export class YourEntityController {
  constructor(private readonly service: YourEntityService) {}

  @Post()
  async create(@Body() dto: CreateYourEntityDto) {
    return this.service.create(dto);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.service.getById(id);
  }
}
```

**Rules:**
- Minimal logic
- Delegate to service
- Return domain entities
- Use appropriate HTTP status codes

---

## Step 6: Create Module

Create `src/features/your-feature/your-feature.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infrastructure';
import { YourEntityRepository } from './repositories/your-entity.repository';
import { YourEntityService } from './services/your-entity.service';
import { YourEntityController } from './controllers/your-entity.controller';

@Module({
  imports: [DatabaseModule],
  providers: [YourEntityRepository, YourEntityService],
  controllers: [YourEntityController],
  exports: [YourEntityRepository, YourEntityService],
})
export class YourFeatureModule {}
```

**Rules:**
- Import DatabaseModule for repository access
- Export service for other modules
- List all providers and controllers

---

## Step 7: Register in AppModule

Update `src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { DatabaseModule } from './infrastructure';
import { YourFeatureModule } from './features/your-feature/your-feature.module';

@Module({
  imports: [
    DatabaseModule,
    YourFeatureModule, // Add your module
  ],
})
export class AppModule {}
```

---

## Common Patterns

### Paginated List Query

```typescript
async findUserEntities(
  userId: string,
  page: number,
  limit: number,
): Promise<Page<YourEntity>> {
  const countSnapshot = await this.db
    .collection(this.collectionName)
    .where('userId', '==', userId)
    .count()
    .get();
  const total = countSnapshot.data().count;

  const offset = (page - 1) * limit;
  const snapshot = await this.db
    .collection(this.collectionName)
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .offset(offset)
    .limit(limit + 1)
    .get();

  const items = snapshot.docs.map((doc) => {
    const data = { id: doc.id, ...doc.data() };
    return this.mapper.toDomain(data as any);
  });

  const hasNextPage = items.length > limit;
  if (hasNextPage) items.pop();

  return {
    items,
    total,
    page,
    limit,
    hasNextPage,
    hasPreviousPage: page > 1,
  };
}
```

### Status Transition

```typescript
async markAsProcessing(id: string): Promise<YourEntity> {
  const entity = await this.findById(id);
  if (!entity) throw new Error('Not found');

  entity.status = 'processing';
  entity.updatedAt = new Date();

  return this.save(entity);
}
```

### Batch Query with 'in' Operator

```typescript
async findByIds(ids: string[]): Promise<YourEntity[]> {
  if (ids.length === 0) return [];

  // Firestore 'in' operator limited to ~10 values
  const chunks = [];
  for (let i = 0; i < ids.length; i += 10) {
    chunks.push(ids.slice(i, i + 10));
  }

  const results: YourEntity[] = [];
  for (const chunk of chunks) {
    const snapshot = await this.db
      .collection(this.collectionName)
      .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
      .get();

    snapshot.docs.forEach((doc) => {
      const data = { id: doc.id, ...doc.data() };
      results.push(this.mapper.toDomain(data as any));
    });
  }

  return results;
}
```

### Delete with Batch (Firestore max 500 ops per batch)

```typescript
async deleteByUserId(userId: string): Promise<number> {
  const snapshot = await this.db
    .collection(this.collectionName)
    .where('userId', '==', userId)
    .get();

  let deleted = 0;
  let batch = this.db.batch();

  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
    deleted++;

    if (deleted % 500 === 0) {
      batch.commit();
      batch = this.db.batch();
    }
  });

  if (snapshot.docs.length % 500 !== 0) {
    await batch.commit();
  }

  return deleted;
}
```

---

## Testing

### Unit Test with Mocks

```typescript
import { Test } from '@nestjs/testing';

describe('YourEntityRepository', () => {
  let repository: YourEntityRepository;
  const mockFirestore = {
    getFirestore: jest.fn().mockReturnValue({
      collection: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ docs: [] }),
    }),
  };

  beforeEach(() => {
    repository = new YourEntityRepository(mockFirestore as any);
  });

  it('should find entity by ID', async () => {
    // Setup mock
    // Call method
    // Assert result
  });
});
```

### Integration Test with Emulator

```bash
firebase emulators:start --only firestore
```

```typescript
it('should save and retrieve entity', async () => {
  const entity = { id: '', /* fields */ };
  const saved = await repository.save(entity);

  const fetched = await repository.findById(saved.id);
  expect(fetched).toEqual(saved);
});
```

---

## Firestore Limitations to Remember

- Max 1 MB per document → denormalize if needed
- Max 500 operations per batch → handled automatically
- Max ~10 values in 'in' clause → use chunking
- No native joins → denormalize related data
- Transactions have timeout → keep operations short

---

## Performance Tips

1. **Use indexes** for frequently queried field combinations
2. **Avoid N+1** - use batch queries where possible
3. **Paginate** - don't fetch all records at once
4. **Use Unit of Work** - for related operations
5. **Monitor** - log query times and watch for N+1 patterns

---

You're ready to implement repositories! Start with the simplest entity and expand from there. 🚀
