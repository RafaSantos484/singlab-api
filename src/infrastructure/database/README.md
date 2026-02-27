# Firestore Database Layer

Robust Firestore access layer following Domain-Driven Design (DDD) and clean architecture principles.

## Architecture

### Main Components

#### 1. **Interfaces** (`interfaces/`)

- **`IRepository<TEntity>`**: Repository interface defining domain-oriented persistence operations
  - `findById(id)` - Find by ID
  - `save(entity)` - Create or update
  - `saveBatch(entities)` - Batch insert/update
  - `delete(id)` - Delete document
  - `exists(id)` - Check existence
  - `count()` - Count total records

- **`IUnitOfWork`**: Manages multi-entity transactions
  - `run<T>(fn)` - Execute callback in transaction

#### 2. **Mappers** (`mappers/`)

- **`BaseMapper<TDomain, TPersistence>`**: Converts between domain and persistence models
  - `toDomain(raw)` - Database to domain
  - `toPersistence(domain)` - Domain to database
  - `toDomainArray(raw[])` - Convert arrays
  - `toPersistenceArray(domain[])` - Convert arrays

#### 3. **Firestore Provider** (`firestore/firestore.provider.ts`)

- Obtains Firestore instance from Firebase Admin SDK
- Delegates initialization to centralized `FirebaseAdminProvider`
- Provides singleton Firestore instance (cached after first access)
- Health check for readiness probes

#### 3.1 Firebase Initialization (Centralized)

Firebase Admin SDK is initialized in a single location: `FirebaseAdminProvider`
(`src/auth/firebase-admin.provider.ts`).

**Credential priority order:**
1. `credentials.json` in project root (if exists)
2. Environment variables: `FIREBASE_SERVICE_ACCOUNT_JSON` or
  `GOOGLE_APPLICATION_CREDENTIALS`
3. Application default credentials (Firebase Functions runtime)


#### 4. **Firestore Repository** (`firestore/firestore-repository.ts`)

- Base implementation for domain-oriented repositories
- Generic CRUD with reusable methods
- Built-in pagination
- Error handling and logging

#### 5. **Firestore Unit of Work** (`firestore/firestore-unit-of-work.ts`)

- Manages Firestore transactions
- Automatic rollback on error
- All-or-nothing semantics

## Basic Usage

### 1. Define Domain Entity

```typescript
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}
```

```typescript
import { BaseMapper } from '@/infrastructure';

export class UserMapper extends BaseMapper<User, UserFirestoreDoc> {
  toDomain(raw: UserFirestoreDoc): User {
    return {
      id: raw.id,
      email: raw.email,
      name: raw.name,
      createdAt: raw.createdAt.toDate(),
      updatedAt: raw.updatedAt.toDate(),
    };
  }

  toPersistence(domain: User): UserFirestoreDoc {
    return {
      id: domain.id,
      email: domain.email,
      name: domain.name,
      createdAt: admin.firestore.Timestamp.fromDate(domain.createdAt),
      updatedAt: admin.firestore.Timestamp.fromDate(domain.updatedAt),
    };
  }
}
```

### 3. Create Domain-Specific Repository

```typescript
import { Injectable } from '@nestjs/common';
import { FirestoreRepository, FirestoreProvider } from '@/infrastructure';

@Injectable()
export class UserRepository extends FirestoreRepository<User> {
  constructor(firestore: FirestoreProvider) {
    super(firestore, 'users', new UserMapper());
  }

  // Domain-specific business methods
  async findByEmail(email: string): Promise<User | null> {
    const snapshot = await this.db
      .collection(this.collectionName)
      .where('email', '==', email)
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    const data = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    return this.mapper.toDomain(data as any);
  }

  async findActiveUsers(page: number, limit: number) {
    return this.findWithPagination({ page, limit, orderBy: 'createdAt' });
  }
}
```

### 4. Use in Service

```typescript
import { Injectable } from '@nestjs/common';
import { FirestoreUnitOfWork } from '@/infrastructure';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly unitOfWork: FirestoreUnitOfWork,
  ) {}

  async createUser(email: string, name: string): Promise<User> {
    const user: User = {
      id: '',
      email,
      name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.userRepository.save(user);
  }

  // Multi-entity operation in transaction
  async transferCredits(
    fromUserId: string,
    toUserId: string,
    amount: number,
  ): Promise<void> {
    await this.unitOfWork.run(async (tx) => {
      const fromUser = await this.userRepository.findById(fromUserId);
      const toUser = await this.userRepository.findById(toUserId);

      if (!fromUser || !toUser) throw new Error('User not found');

      fromUser.credits -= amount;
      toUser.credits += amount;

      await this.userRepository.save(fromUser);
      await this.userRepository.save(toUser);
    });
  }
}
```

### 5. Register Module

```typescript
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infrastructure';

@Module({
  imports: [DatabaseModule],
  providers: [UserRepository, UserService],
  controllers: [UserController],
})
export class UserModule {}
```

## Recommended Patterns

### ✅ Business-Specific Methods

```typescript
// GOOD - Expresses business intent
async findByEmail(email: string): Promise<User | null> { }
async findActiveUsers(): Promise<User[]> { }
async deactivateUser(userId: string): Promise<User> { }
```

### ❌ Generic CRUD in Public Interface

```typescript
// BAD - Too generic, lacks expressiveness
interface GenericRepository<T> {
  get(id: string): Promise<T>;
  set(entity: T): Promise<void>;
  delete(id: string): Promise<void>;
}
```

### Unit of Work for Transactions

```typescript
// Ensures atomicity across multiple entities
await this.unitOfWork.run(async (repos) => {
  await repos.users.save(user);
  await repos.orders.save(order);
  await repos.inventory.update(item);
  // Either all succeed or all fail
});
```

## Pagination

```typescript
const result = await userRepository.findWithPagination({
  page: 2,
  limit: 20,
  orderBy: 'createdAt',
  orderDirection: 'desc',
});

console.log({
  items: result.items,        // User[]
  total: result.total,        // Total records
  page: result.page,          // Current page
  hasNextPage: result.hasNextPage,
  hasPreviousPage: result.hasPreviousPage,
});
```

## Error Handling

```typescript
try {
  const user = await userRepository.findById('123');
  if (!user) {
    throw new NotFoundException('User not found');
  }
} catch (error) {
  throw new InternalServerErrorException('Database error');
}
```

## Firestore Limitations

- **Batch writes**: Maximum 500 operations per batch
- **Document size**: Maximum 1 MB per document
- **Query limit**: Maximum 10 documents in `where('field', 'in', [...])` (before Firestore v39)
- **Transactions**: Maximum 25 reads/writes (may vary)

## Performance

### Avoid N+1

```typescript
// ❌ BAD - N+1 queries
for (const userId of userIds) {
  const user = await userRepository.findById(userId);
}

// ✅ GOOD - Batch query
async findByIds(ids: string[]): Promise<User[]> {
  const snapshot = await this.db
    .collection(this.collectionName)
    .where(admin.firestore.FieldPath.documentId(), 'in', ids)
    .get();

  return snapshot.docs.map((doc) => 
    this.mapper.toDomain({ id: doc.id, ...doc.data() })
  );
}
```

### Composite Indexes

For queries with multiple conditions, create indexes in Firestore:

```
- Collection: users
- Fields:
  - isActive (Ascending)
  - createdAt (Descending)
```

## Testing

### Mocking Repository

```typescript
import { Test } from '@nestjs/testing';

const mockUserRepository = {
  findById: jest.fn(),
  save: jest.fn(),
};

const module = await Test.createTestingModule({
  providers: [
    UserService,
    { provide: UserRepository, useValue: mockUserRepository },
  ],
}).compile();
```

### Integration Tests with Emulator

```bash
firebase emulators:start --only firestore
```

```typescript
// Use Firestore Emulator in tests
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
```

## Observability

### Logging

```typescript
// Automatically logged in FirestoreRepository
this.logger.log(`Saving user ${user.id}`);
this.logger.error('Save failed', error);
```

### Metrics

Consider integrating:
- Query execution time
- Read/write operation counts
- Errors and retries
- Health checks

## Next Steps

1. **Entity-specific implementations**: Create repositories for your entities (Audio, Transcript, etc)
2. **Caching**: Integrate Redis or similar for read-heavy queries
3. **CQRS**: Separate optimized reads from writes if needed
4. **Audit**: Add change trail for compliance
