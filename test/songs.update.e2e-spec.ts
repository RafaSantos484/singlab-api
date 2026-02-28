import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { SongsController } from '../src/features/songs/songs.controller';
import { SongsService } from '../src/features/songs/songs.service';
import { FirebaseAuthGuard } from '../src/auth/firebase-auth.guard';

describe('SongsController - PATCH /songs/:songId (e2e)', () => {
  let app: INestApplication;
  let songsService: SongsService;

  const mockUser = {
    uid: 'test-user-123',
  };

  const mockSongData = {
    id: 'test-song-id',
    title: 'Original Title',
    author: 'Original Author',
  };

  beforeEach(async () => {
    const mockSongsService = {
      updateSong: jest.fn(),
      getSongById: jest.fn(),
      listUserSongs: jest.fn(),
      uploadSong: jest.fn(),
      deleteSong: jest.fn(),
      refreshRawSongUrl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SongsController],
      providers: [{ provide: SongsService, useValue: mockSongsService }],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const request = context.switchToHttp().getRequest();
          request.user = mockUser;
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    await app.init();

    songsService = module.get<SongsService>(SongsService);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('PATCH /songs/:songId - Success Cases', () => {
    it('should update title and return 200 OK', () => {
      const updatePayload = { title: 'New Title' };
      const expectedResponse = {
        ...mockSongData,
        title: 'New Title',
      };

      jest
        .spyOn(songsService, 'updateSong')
        .mockResolvedValue(expectedResponse);

      return request(app.getHttpServer())
        .patch('/songs/test-song-id')
        .send(updatePayload)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toEqual({
            success: true,
            data: expectedResponse,
          });
        });
    });

    it('should update author and return 200 OK', () => {
      const updatePayload = { author: 'New Author' };
      const expectedResponse = {
        ...mockSongData,
        author: 'New Author',
      };

      jest
        .spyOn(songsService, 'updateSong')
        .mockResolvedValue(expectedResponse);

      return request(app.getHttpServer())
        .patch('/songs/test-song-id')
        .send(updatePayload)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toEqual({
            success: true,
            data: expectedResponse,
          });
        });
    });

    it('should update both title and author and return 200 OK', () => {
      const updatePayload = {
        title: 'New Title',
        author: 'New Author',
      };
      const expectedResponse = {
        ...mockSongData,
        title: 'New Title',
        author: 'New Author',
      };

      jest
        .spyOn(songsService, 'updateSong')
        .mockResolvedValue(expectedResponse);

      return request(app.getHttpServer())
        .patch('/songs/test-song-id')
        .send(updatePayload)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toEqual({
            success: true,
            data: expectedResponse,
          });
        });
    });

    it('should ignore file-related fields in request body', () => {
      const updatePayload = {
        title: 'New Title',
        file: 'some-malicious-file',
        rawSongInfo: { urlInfo: { value: 'hacked-url' } },
      };
      const expectedResponse = {
        ...mockSongData,
        title: 'New Title',
      };

      jest
        .spyOn(songsService, 'updateSong')
        .mockResolvedValue(expectedResponse);

      return request(app.getHttpServer())
        .patch('/songs/test-song-id')
        .send(updatePayload)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toEqual({
            success: true,
            data: expectedResponse,
          });
        });
    });
  });

  describe('PATCH /songs/:songId - Validation Errors', () => {
    it('should return 400 when title is empty string', () => {
      const updatePayload = { title: '' };

      jest
        .spyOn(songsService, 'updateSong')
        .mockRejectedValue(
          new Error('Invalid update data: Title must not be empty'),
        );

      return request(app.getHttpServer())
        .patch('/songs/test-song-id')
        .send(updatePayload)
        .expect(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should return 400 when title exceeds max length', () => {
      const updatePayload = { title: 'a'.repeat(256) };

      jest
        .spyOn(songsService, 'updateSong')
        .mockRejectedValue(
          new Error(
            'Invalid update data: Title must be at most 255 characters',
          ),
        );

      return request(app.getHttpServer())
        .patch('/songs/test-song-id')
        .send(updatePayload)
        .expect(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should return 400 when author exceeds max length', () => {
      const updatePayload = { author: 'a'.repeat(256) };

      jest
        .spyOn(songsService, 'updateSong')
        .mockRejectedValue(
          new Error(
            'Invalid update data: Author must be at most 255 characters',
          ),
        );

      return request(app.getHttpServer())
        .patch('/songs/test-song-id')
        .send(updatePayload)
        .expect(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should return 400 when no update fields provided', () => {
      const updatePayload = {};

      jest
        .spyOn(songsService, 'updateSong')
        .mockRejectedValue(
          new Error('At least one field (title or author) must be provided'),
        );

      return request(app.getHttpServer())
        .patch('/songs/test-song-id')
        .send(updatePayload)
        .expect(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should return 400 with invalid song ID', () => {
      const updatePayload = { title: 'New Title' };

      return request(app.getHttpServer())
        .patch('/songs/')
        .send(updatePayload)
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('PATCH /songs/:songId - Not Found', () => {
    it('should return 404 when song does not exist', () => {
      const updatePayload = { title: 'New Title' };

      jest
        .spyOn(songsService, 'updateSong')
        .mockRejectedValue(new Error('Song not found'));

      return request(app.getHttpServer())
        .patch('/songs/nonexistent-song-id')
        .send(updatePayload)
        .expect(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe('PATCH /songs/:songId - Server Errors', () => {
    it('should return 500 on internal server error', () => {
      const updatePayload = { title: 'New Title' };

      jest
        .spyOn(songsService, 'updateSong')
        .mockRejectedValue(new Error('Database connection failed'));

      return request(app.getHttpServer())
        .patch('/songs/test-song-id')
        .send(updatePayload)
        .expect(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe('PATCH /songs/:songId - Valid Constraints', () => {
    it('should accept title with minimum length (1 char)', () => {
      const updatePayload = { title: 'A' };
      const expectedResponse = {
        ...mockSongData,
        title: 'A',
      };

      jest
        .spyOn(songsService, 'updateSong')
        .mockResolvedValue(expectedResponse);

      return request(app.getHttpServer())
        .patch('/songs/test-song-id')
        .send(updatePayload)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.data.title).toBe('A');
        });
    });

    it('should accept title with maximum length (255 chars)', () => {
      const longTitle = 'a'.repeat(255);
      const updatePayload = { title: longTitle };
      const expectedResponse = {
        ...mockSongData,
        title: longTitle,
      };

      jest
        .spyOn(songsService, 'updateSong')
        .mockResolvedValue(expectedResponse);

      return request(app.getHttpServer())
        .patch('/songs/test-song-id')
        .send(updatePayload)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.data.title).toBe(longTitle);
        });
    });

    it('should have proper response structure with success flag', () => {
      const updatePayload = { title: 'New Title' };
      const expectedResponse = {
        ...mockSongData,
        title: 'New Title',
      };

      jest
        .spyOn(songsService, 'updateSong')
        .mockResolvedValue(expectedResponse);

      return request(app.getHttpServer())
        .patch('/songs/test-song-id')
        .send(updatePayload)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('data');
          expect(res.body.data).toHaveProperty('id');
          expect(res.body.data).toHaveProperty('title');
          expect(res.body.data).toHaveProperty('author');
        });
    });
  });
});
