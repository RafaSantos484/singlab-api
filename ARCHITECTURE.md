# Firestore Infrastructure - Architecture Overview

## Request Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│  HTTP Request                                                            │
│  GET /songs/artist/Beatles                                              │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Controller Layer                                                        │
│  @Controller('songs')                                                   │
│  @Get('artist/:artist')                                                 │
│  getSongsByArtist(@Param artist)                                        │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Service Layer (Business Logic)                                         │
│  @Injectable()                                                           │
│  SongService {                                                           │
│    getSongsByArtist(artist) {                                           │
│      return this.songRepository.findByArtist(artist)                    │
│    }                                                                     │
│  }                                                                       │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Repository Layer (Domain Queries)                                      │
│  @Injectable()                                                           │
│  SongRepository extends FirestoreRepository<Song> {                     │
│    async findByArtist(artist: string): Promise<Song[]> {               │
│      const snapshot = await this.db                                     │
│        .collection(this.collectionName)                                 │
│        .where('artist', '==', artist)                                   │
│        .get();                                                          │
│                                                                         │
│      return snapshot.docs.map(doc =>                                   │
│        this.mapper.toDomain(...)  ← Uses Mapper                       │
│      );                                                                 │
│    }                                                                     │
│  }                                                                       │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
                    ▼                                 ▼
        ┌─────────────────────┐          ┌─────────────────────┐
        │  Mapper             │          │  Firestore Instance │
        │  SongMapper         │          │  (Firebase Admin)   │
        │                     │          │                     │
        │ toDomain(doc)       │          │ DB Collections:     │
        │ ↕                   │          │  - songs            │
        │ toPersistence(entity)          │  - users            │
        │                     │          │  - uploads          │
        │ Converts:           │          │                     │
        │ Domain ↔ Firestore  │          │ Documents with      │
        │                     │          │ Firestore Timestamps│
        └─────────────────────┘          └─────────────────────┘
```

## Component Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            AppModule                                     │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  imports: [DatabaseModule, SongModule, ...]                       │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└──────────────┬─────────────────────────────────────────────────────────┬─┘
               │                                                          │
    ┌──────────▼──────────────┐                        ┌──────────────────▼──┐
    │                         │                        │                     │
    │  DatabaseModule         │                        │  SongModule         │
    │  ┌─────────────────┐    │                        │  ┌──────────────┐   │
    │  │ Exports:        │    │                        │  │ Providers:   │   │
    │  │  - FirestoreProvider                         │  │  - SongRepository
    │  │  - FirestoreUnitOfWork                       │  │  - SongService    │
    │  │  - Interfaces   │    │                        │  │ Controllers: │   │
    │  │  - BaseMapper   │    │                        │  │  - SongController
    │  └─────────────────┘    │                        │  └──────────────┘   │
    │                         │                        │                     │
    └─────────────┬───────────┘                        └─────────────────────┘
                  │
                  ▼
    ┌──────────────────────────────────────────────┐
    │  FirestoreProvider (Singleton)               │
    │                                              │
    │  getFirestore(): Firestore                   │
    │  healthCheck(): Promise<boolean>             │
    │                                              │
    │  - Initializes Firebase Admin SDK once      │
    │  - Reuses connection in serverless           │
    │  - Provides health check for readiness       │
    └──────────────┬───────────────────────────────┘
                   │
                   ▼
    ┌──────────────────────────────────────────────┐
    │  Firestore Instance                          │
    │  (Firebase Admin SDK)                        │
    │                                              │
    │  Collections:                                │
    │  - songs/                                    │
    │  - users/                                    │
    │  - uploads/                                  │
    │  - etc...                                    │
    └──────────────────────────────────────────────┘
```

## Repository Hierarchy

```
┌─────────────────────────────────────────┐
│      IRepository<T> (Interface)         │
│                                         │
│  Defines Contract:                      │
│  - findById(id): Promise<T | null>      │
│  - save(entity): Promise<T>             │
│  - saveBatch(entities): Promise<T[]>    │
│  - delete(id): Promise<boolean>         │
│  - exists(id): Promise<boolean>         │
│  - count(): Promise<number>             │
│                                         │
└─────────────────────────▲───────────────┘
                          │ implements
                          │
┌─────────────────────────┴───────────────┐
│  FirestoreRepository<T> (Base Class)    │
│                                         │
│  Provides Implementation:                │
│  + findWithPagination(params)           │
│  + generateId()                         │
│  + Automatic logging                    │
│  + Error handling                       │
│  + Batch operations (500 limit)         │
│  + Server-side timestamps               │
│                                         │
└─────────────────────────▲───────────────┘
                          │ extends
                ┌─────────┼─────────┬──────────────┐
                │         │         │              │
                ▼         ▼         ▼              ▼
            SongRepository  UserRepository  AudioUploadRepository  etc...
                │         │         │              │
                ├─ findByArtist  ├─ findByEmail    ├─ findByUserId
                ├─ findByGenre   ├─ activate()     ├─ markAsCompleted
                └─ etc...        └─ etc...         └─ etc...
```

## Unit of Work Pattern

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  Service calls: unitOfWork.run(async (repos) => {                │
│                                                                  │
│    ┌──────────────────────────────────────────────────────────┐ │
│    │  Firestore Transaction starts here                       │ │
│    │                                                          │ │
│    │  const user = await repos.userRepository.findById('123')│ │
│    │  user.credits -= 10;                                    │ │
│    │  await repos.userRepository.save(user);                 │ │
│    │                                                          │ │
│    │  const payment = {                                      │ │
│    │    id: 'payment-1',                                     │ │
│    │    amount: 10                                           │ │
│    │  };                                                     │ │
│    │  await repos.paymentRepository.save(payment);           │ │
│    │                                                          │ │
│    └──────────────────────────────────────────────────────────┘ │
│                                                                  │
│    Result:                                                       │
│    ├─ ALL operations commit ✅                                   │
│    └─ OR ALL are rolled back ⚠️  (if any error)                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Mapper Conversion Flow

```
HTTP Request (DTO)
    │
    ▼
Controller creates Domain Entity
    │
    │ Song {
    │   id: '123',
    │   title: 'Hey Jude',
    │   artist: 'The Beatles',
    │   createdAt: Date(2024-02-26)
    │ }
    │
    ▼
Service validates & Repository passes to Mapper.toPersistence()
    │
    │ SongDocument {
    │   id: '123',
    │   title: 'Hey Jude',
    │   artist: 'The Beatles',
    │   createdAt: Timestamp(2024-02-26, 14:30:00) ← Server time
    │ }
    │
    ▼
Firestore stores Document
    │
    ▼
  [Later]
    │
    ▼
Repository fetches from Firestore & passes to Mapper.toDomain()
    │
    │ Song {
    │   id: '123',
    │   title: 'Hey Jude',
    │   artist: 'The Beatles',
    │   createdAt: Date(2024-02-26) ← Converted back
    │ }
    │
    ▼
Service returns to Controller
    │
    ▼
Controller sends to Client (JSON response)
```

## Dependency Injection Flow

```
NestJS Module Resolution:
┌────────────────────────────────────────────────────────────┐
│  1. DatabaseModule provides:                               │
│     ├─ FirestoreProvider (singleton)                       │
│     └─ FirestoreUnitOfWork                                 │
│                                                            │
│  2. SongRepository @Injectable() created:                  │
│     └─ NestJS injects: FirestoreProvider                   │
│                                                            │
│  3. SongService @Injectable() created:                     │
│     └─ NestJS injects: SongRepository + FirestoreUnitOfWork│
│                                                            │
│  4. SongController @Controller() created:                  │
│     └─ NestJS injects: SongService                         │
│                                                            │
└────────────────────────────────────────────────────────────┘

Constructor Chain (resolved bottom-up):
SongController(SongService)
  ← SongService(SongRepository, FirestoreUnitOfWork)
    ← SongRepository(FirestoreProvider)
      ← FirestoreProvider (singleton, created once)
```

---

## File Organization

```
src/infrastructure/
├── index.ts (barrel export)
└── database/
    ├── database.module.ts ← Import in your app module
    ├── interfaces/
    │   ├── repository.interface.ts
    │   ├── unit-of-work.interface.ts
    │   └── index.ts
    ├── firestore/
    │   ├── firestore.provider.ts
    │   ├── firestore-repository.ts
    │   ├── firestore-unit-of-work.ts
    │   └── index.ts
    └── mappers/
        └── mapper.base.ts

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

These diagrams show how all components work together harmoniously! 🎵
