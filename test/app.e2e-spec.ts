import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseAdminProvider } from '../src/auth/firebase-admin.provider';
import { FirestoreProvider } from '../src/infrastructure/database/firestore/firestore.provider';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = {
      ...originalEnv,
      SKIP_AUTH: 'true',
      POYO_API_KEY: 'test-api-key',
    };
    const mockFirestore = {
      settings: jest.fn(),
      collection: jest.fn().mockReturnThis(),
      doc: jest.fn().mockReturnThis(),
      runTransaction: jest
        .fn()
        .mockImplementation(async (fn: (tx: unknown) => unknown) => fn({})),
    };
    const mockFirestoreProvider = {
      getFirestore: jest.fn().mockReturnValue(mockFirestore),
    };
    const mockFirebaseAdminProvider = {
      getAuth: jest.fn().mockReturnValue({}),
      getBucket: jest.fn().mockReturnValue({}),
    };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FirestoreProvider)
      .useValue(mockFirestoreProvider)
      .overrideProvider(FirebaseAdminProvider)
      .useValue(mockFirebaseAdminProvider)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    process.env = originalEnv;
    if (app) {
      await app.close();
    }
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect({ message: 'Hello World!' });
  });

  it('/ (GET) should return JSON content type', () => {
    return request(app.getHttpServer()).get('/').expect('Content-Type', /json/);
  });
});
