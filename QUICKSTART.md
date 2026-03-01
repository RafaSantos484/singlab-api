# Firestore Database Layer - Quick Start Guide

## 📍 Getting Started (5 minutes)

This guide provides everything you need to start using the Firestore infrastructure layer in the SingLab API.

### Key Files Location

**Infrastructure Core** (`src/infrastructure/`)
- Interfaces and contracts
- Firestore provider and repository implementations
- Mappers for domain ↔ persistence conversion
- NestJS module configuration

**Documentation** (Root directory)
- `ARCHITECTURE.md` - Visual diagrams
- `IMPLEMENTATION_GUIDE.md` - Step-by-step instructions

---

## 🚀 How to Start (3 Steps)

### Step 1: Understand the Architecture (5 min)

Read the overview:

```
Domain Entity (TypeScript)
         ↓
     Mapper (converts to/from database format)
         ↓
Firestore (persistent storage)
         ↓
Repository (manages domain queries)
         ↓
Service Layer (business logic)
         ↓
Controller (HTTP endpoints)
```

### Step 2: Create Your First Repository (15 min)

Follow this pattern:

**1. Define Domain Entity**
```typescript
// src/features/song/domain/song.ts
export interface Song {
  id: string;
  title: string;
  artist: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**2. Create Mapper**
```typescript
// src/features/song/mappers/song.mapper.ts
import { BaseMapper } from '@/infrastructure';
import * as admin from 'firebase-admin';

export class SongMapper extends BaseMapper<Song, SongDocument> {
  toDomain(raw: SongDocument): Song {
    return {
      id: raw.id,
      title: raw.title,
      artist: raw.artist,
      createdAt: raw.createdAt.toDate(),
      updatedAt: raw.updatedAt.toDate(),
    };
  }

  toPersistence(domain: Song): SongDocument {
    return {
      id: domain.id,
      title: domain.title,
      artist: domain.artist,
      createdAt: admin.firestore.Timestamp.fromDate(domain.createdAt),
      updatedAt: admin.firestore.Timestamp.fromDate(domain.updatedAt),
    };
  }
}
```

**3. Create Domain-Specific Repository**
```typescript
// src/features/song/repositories/song.repository.ts
import { Injectable } from '@nestjs/common';
import { FirestoreRepository, FirestoreProvider } from '@/infrastructure';

@Injectable()
export class SongRepository extends FirestoreRepository<Song> {
  constructor(firestore: FirestoreProvider) {
    super(firestore, 'songs', new SongMapper());
  }

  // Add domain-specific queries here
  async findByArtist(artist: string): Promise<Song[]> {
    const snapshot = await this.db
      .collection(this.collectionName)
      .where('artist', '==', artist)
      .get();

    return snapshot.docs.map((doc) => {
      const data = { id: doc.id, ...doc.data() };
      return this.mapper.toDomain(data as any);
    });
  }
}
```

**4. Create Service**
```typescript
// src/features/song/services/song.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class SongService {
  constructor(private readonly songRepository: SongRepository) {}

  async getById(id: string): Promise<Song> {
    const song = await this.songRepository.findById(id);
    if (!song) throw new Error('Song not found');
    return song;
  }

  async getByArtist(artist: string): Promise<Song[]> {
    return this.songRepository.findByArtist(artist);
  }
}
```

**5. Register in Module**
```typescript
// src/features/song/song.module.ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infrastructure';

@Module({
  imports: [DatabaseModule],
  providers: [SongRepository, SongService],
  controllers: [SongController],
  exports: [SongRepository, SongService],
})
export class SongModule {}
```

**6. Add to AppModule**
```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infrastructure';
import { SongModule } from './features/song/song.module';

@Module({
  imports: [DatabaseModule, SongModule],
})
export class AppModule {}
```

### Step 3: Use in Controller (5 min)

```typescript
// src/features/song/controllers/song.controller.ts
import { Controller, Get, Param } from '@nestjs/common';

@Controller('songs')
export class SongController {
  constructor(private readonly songService: SongService) {}

  @Get(':id')
  async getById(@Param('id') id: string): Promise<Song> {
    return this.songService.getById(id);
  }

  @Get('artist/:artist')
  async getByArtist(@Param('artist') artist: string): Promise<Song[]> {
    return this.songService.getByArtist(artist);
  }
}
```

---

## 📦 Available Methods

Every repository automatically inherits these methods:

```typescript
// Single operations
await repository.findById(id)              // Get by ID
await repository.save(entity)              // Create or update
await repository.delete(id)                // Delete

// Batch operations
await repository.saveBatch([...])          // Batch write
await repository.count()                   // Total count
await repository.exists(id)                // Check existence

// Pagination
await repository.findWithPagination({
  page: 1,
  limit: 20,
  orderBy: 'createdAt',
  orderDirection: 'desc'
})
```

---

## 💡 Key Concepts

### Repository Pattern
Encapsulates data access logic. You write business queries, not database queries.

### Unit of Work
Ensures multiple operations on different entities succeed or fail together:

```typescript
await unitOfWork.run(async () => {
  const user = await userRepository.findById('123');
  user.credits -= 10;
  await userRepository.save(user);
  
  const payment = await paymentRepository.save(newPayment);
  // All succeed together or all rollback ✅
});
```

### Mappers
Convert between domain entities (your code) and database models (Firestore):

```typescript
Domain Entity: Song { id, title, artist, createdAt: Date }
                 ↕ (mapper)
Database Doc: { id, title, artist, createdAt: Timestamp }
```

---

## 🏗️ Project Structure

```
src/
├── app.module.ts (← DatabaseModule imported here)
├── infrastructure/
│   └── database/
│       ├── database.module.ts (← Export DatabaseModule)
│       ├── interfaces/
│       │   ├── repository.interface.ts
│       │   └── unit-of-work.interface.ts
│       ├── firestore/
│       │   ├── firestore.provider.ts
│       │   ├── firestore-repository.ts
│       │   └── firestore-unit-of-work.ts
│       └── mappers/
│           └── mapper.base.ts
├── features/
│   └── song/
│       ├── domain/
│       │   └── song.ts
│       ├── mappers/
│       │   └── song.mapper.ts
│       ├── repositories/
│       │   └── song.repository.ts
│       ├── services/
│       │   └── song.service.ts
│       ├── controllers/
│       │   └── song.controller.ts
│       └── song.module.ts
```

---

## ✅ Validation

```bash
npm run build      # Should compile without errors
npm run lint       # Should pass ESLint
npm test           # Ready to test
```

---

## 📚 Documentation

- `ARCHITECTURE.md` - Visual diagrams of the system
- `IMPLEMENTATION_GUIDE.md` - Detailed step-by-step guide
- `src/infrastructure/database/README.md` - Technical documentation
- `src/infrastructure/USAGE_GUIDE.ts` - Code examples
- `test/infrastructure/firestore-repository.spec.ts` - Test examples

---

## 🎯 Next Steps

1. **Create your first repository** - Choose a domain entity and follow Step 2
2. **Test it** - Use Firebase Emulator for testing
3. **Integrate** - Add to AppModule and test endpoints
4. **Scale** - Create repositories for all entities

---

**Ready to get started?** Pick an entity and follow the 15-minute guide above! 🚀
