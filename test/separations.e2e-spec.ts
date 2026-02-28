import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { SeparationsModule } from '../src/features/separations/separations.module';
import { FirebaseAuthGuard } from '../src/auth/firebase-auth.guard';
import { SongsService } from '../src/features/songs/songs.service';
import { GlobalExceptionFilter } from '../src/common/filters';

describe('Separations E2E (POST /songs/:songId/separations)', () => {
  let app: INestApplication;
  let songsService: SongsService;

  const mockUser = { uid: 'test-user-123' };
  const mockSong = {
    title: 'Test Song',
    author: 'Test Artist',
    rawSongInfo: {
      urlInfo: {
        value: 'https://storage.example.com/song.mp3',
        expiresAt: '2026-03-01T00:00:00Z',
      },
      uploadedAt: '2026-02-28T00:00:00Z',
    },
  };

  beforeEach(async () => {
    process.env.POYO_API_KEY = 'test-api-key';

    const mockSongsService = {
      getSongById: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SeparationsModule],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          req.user = mockUser;
          return true;
        },
      })
      .overrideProvider(SongsService)
      .useValue(mockSongsService)
      .compile();

    songsService = moduleFixture.get<SongsService>(SongsService);

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Success Cases', () => {
    it('should return 202 with task metadata when song exists', async () => {
      jest.spyOn(songsService, 'getSongById').mockResolvedValue(mockSong);

      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'task-abc-123',
          status: 'queued',
          created_at: '2026-02-28T10:00:00Z',
        }),
      });
      (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

      const response = await request(app.getHttpServer())
        .post('/songs/song-123/separations')
        .send({
          modelName: 'base',
          outputType: 'general',
        })
        .expect(HttpStatus.ACCEPTED);

      expect(response.body).toEqual({
        success: true,
        data: {
          taskId: 'task-abc-123',
          status: 'queued',
          createdTime: '2026-02-28T10:00:00Z',
          provider: 'poyo',
        },
      });

      expect(songsService.getSongById).toHaveBeenCalledWith(
        'test-user-123',
        'song-123',
      );

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/generate/submit'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(mockSong.rawSongInfo.urlInfo.value),
        }),
      );
    });

    it('should use song title when no title provided in body', async () => {
      jest.spyOn(songsService, 'getSongById').mockResolvedValue(mockSong);

      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'task-456',
          status: 'queued',
        }),
      });
      (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

      await request(app.getHttpServer())
        .post('/songs/song-123/separations')
        .send({})
        .expect(HttpStatus.ACCEPTED);

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.input.title).toBe('Test Song');
    });

    it('should use custom title when provided', async () => {
      jest.spyOn(songsService, 'getSongById').mockResolvedValue(mockSong);

      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'task-789',
          status: 'queued',
        }),
      });
      (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

      await request(app.getHttpServer())
        .post('/songs/song-123/separations')
        .send({ title: 'Custom Title' })
        .expect(HttpStatus.ACCEPTED);

      const callBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(callBody.input.title).toBe('Custom Title');
    });
  });

  describe('Error Cases', () => {
    it('should return 404 when song not found', async () => {
      jest.spyOn(songsService, 'getSongById').mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .post('/songs/nonexistent-song/separations')
        .send({})
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          statusCode: 404,
          message: expect.stringContaining('not found'),
        },
      });
    });

    it('should return 409 when separation already exists', async () => {
      jest.spyOn(songsService, 'getSongById').mockResolvedValue(mockSong);

      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ message: 'Already exists' }),
      });
      (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

      const response = await request(app.getHttpServer())
        .post('/songs/song-123/separations')
        .send({})
        .expect(HttpStatus.CONFLICT);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          statusCode: 409,
        },
      });
    });

    it('should return 503 when provider unavailable', async () => {
      jest.spyOn(songsService, 'getSongById').mockResolvedValue(mockSong);

      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({}),
      });
      (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

      await request(app.getHttpServer())
        .post('/songs/song-123/separations')
        .send({})
        .expect(HttpStatus.SERVICE_UNAVAILABLE);
    });
  });
});
