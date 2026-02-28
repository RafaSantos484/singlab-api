import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { SongsService } from '../../songs.service';
import { FirestoreProvider } from '../../../../infrastructure/database/firestore/firestore.provider';
import { FirebaseAdminProvider } from '../../../../auth/firebase-admin.provider';
import { AudioConversionService } from '../../../audio/audio-conversion.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
describe('SongsService - updateSong', () => {
  let service: SongsService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockFirestore: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockBucket: any;

  const userId = 'test-user-id';
  const songId = 'test-song-id';
  const existingSong = {
    title: 'Old Title',
    author: 'Old Author',
    rawSongInfo: {
      urlInfo: {
        value: 'https://storage.example.com/song.mp3',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      uploadedAt: new Date().toISOString(),
    },
  };

  beforeEach(async () => {
    // Mock Firestore
    mockFirestore = {
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          collection: jest.fn().mockReturnValue({
            doc: jest.fn().mockReturnValue({
              get: jest.fn(),
              update: jest.fn(),
            }),
          }),
        }),
      }),
    };

    // Mock Bucket
    mockBucket = {
      file: jest.fn(),
    };

    // Mock providers
    const mockFirestoreProvider = {
      getFirestore: jest.fn().mockReturnValue(mockFirestore),
    };

    const mockFirebaseAdminProvider = {
      getBucket: jest.fn().mockReturnValue(mockBucket),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockAudioConversionService: any = {
      getFileFormat: jest.fn(),
      isSupportedFormat: jest.fn(),
      getSupportedFormatsString: jest.fn(),
      convertAndStreamToStorage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SongsService,
        { provide: FirestoreProvider, useValue: mockFirestoreProvider },
        { provide: FirebaseAdminProvider, useValue: mockFirebaseAdminProvider },
        {
          provide: AudioConversionService,
          useValue: mockAudioConversionService,
        },
      ],
    }).compile();

    service = module.get<SongsService>(SongsService);
  });

  describe('updateSong - Success Cases', () => {
    it('should update title only', async () => {
      const updateData = { title: 'New Title' };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const songDocRef = mockFirestore
        .collection('users')
        .doc(userId)
        .collection('songs')
        .doc(songId);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      songDocRef.get.mockResolvedValue({
        exists: true,
        data: () => existingSong,
      });

      const result = await service.updateSong(userId, songId, updateData);

      expect(result).toEqual({
        id: songId,
        title: 'New Title',
        author: 'Old Author',
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(songDocRef.update).toHaveBeenCalledWith({
        title: 'New Title',
      });
    });

    it('should update author only', async () => {
      const updateData = { author: 'New Author' };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const songDocRef = mockFirestore
        .collection('users')
        .doc(userId)
        .collection('songs')
        .doc(songId);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      songDocRef.get.mockResolvedValue({
        exists: true,
        data: () => existingSong,
      });

      const result = await service.updateSong(userId, songId, updateData);

      expect(result).toEqual({
        id: songId,
        title: 'Old Title',
        author: 'New Author',
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(songDocRef.update).toHaveBeenCalledWith({
        author: 'New Author',
      });
    });

    it('should update both title and author', async () => {
      const updateData = { title: 'New Title', author: 'New Author' };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const songDocRef = mockFirestore
        .collection('users')
        .doc(userId)
        .collection('songs')
        .doc(songId);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      songDocRef.get.mockResolvedValue({
        exists: true,
        data: () => existingSong,
      });

      const result = await service.updateSong(userId, songId, updateData);

      expect(result).toEqual({
        id: songId,
        title: 'New Title',
        author: 'New Author',
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(songDocRef.update).toHaveBeenCalledWith({
        title: 'New Title',
        author: 'New Author',
      });
    });

    it('should ignore file-related fields in update payload', async () => {
      const updateData = {
        title: 'New Title',
        file: 'some-file',
        rawSongInfo: { urlInfo: { value: 'hacked-url' } },
      };

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const songDocRef = mockFirestore
        .collection('users')
        .doc(userId)
        .collection('songs')
        .doc(songId);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      songDocRef.get.mockResolvedValue({
        exists: true,
        data: () => existingSong,
      });

      const result = await service.updateSong(userId, songId, updateData);

      expect(result).toEqual({
        id: songId,
        title: 'New Title',
        author: 'Old Author',
      });

      // Should only update title, not the other fields
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(songDocRef.update).toHaveBeenCalledWith({
        title: 'New Title',
      });
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  describe('updateSong - Validation Errors', () => {
    it('should throw error when title is empty string', async () => {
      const updateData = { title: '' };

      await expect(
        service.updateSong(userId, songId, updateData),
      ).rejects.toThrow('Invalid update data');
    });

    it('should throw error when title exceeds max length', async () => {
      const updateData = { title: 'a'.repeat(256) };

      await expect(
        service.updateSong(userId, songId, updateData),
      ).rejects.toThrow('Invalid update data');
    });

    it('should throw error when author exceeds max length', async () => {
      const updateData = { author: 'a'.repeat(256) };

      await expect(
        service.updateSong(userId, songId, updateData),
      ).rejects.toThrow('Invalid update data');
    });

    it('should throw error when title is not a string', async () => {
      const updateData = { title: 123 };

      await expect(
        service.updateSong(userId, songId, updateData),
      ).rejects.toThrow('Invalid update data');
    });

    it('should throw error when no fields provided', async () => {
      const updateData = {};
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const songDocRef = mockFirestore
        .collection('users')
        .doc(userId)
        .collection('songs')
        .doc(songId);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      songDocRef.get.mockResolvedValue({
        exists: true,
        data: () => existingSong,
      });

      await expect(
        service.updateSong(userId, songId, updateData),
      ).rejects.toThrow(
        'At least one field (title or author) must be provided',
      );
    });

    it('should throw error when only file field provided', async () => {
      const updateData = { file: 'some-file' };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const songDocRef = mockFirestore
        .collection('users')
        .doc(userId)
        .collection('songs')
        .doc(songId);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      songDocRef.get.mockResolvedValue({
        exists: true,
        data: () => existingSong,
      });

      await expect(
        service.updateSong(userId, songId, updateData),
      ).rejects.toThrow(
        'At least one field (title or author) must be provided',
      );
    });
  });

  describe('updateSong - Song Not Found', () => {
    it('should throw NotFoundException when song does not exist', async () => {
      const updateData = { title: 'New Title' };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const songDocRef = mockFirestore
        .collection('users')
        .doc(userId)
        .collection('songs')
        .doc(songId);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      songDocRef.get.mockResolvedValue({
        exists: false,
      });

      await expect(
        service.updateSong(userId, songId, updateData),
      ).rejects.toThrow(
        new HttpException('Song not found', HttpStatus.NOT_FOUND),
      );

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(songDocRef.update).not.toHaveBeenCalled();
    });
  });

  describe('updateSong - Database Errors', () => {
    it('should throw InternalServerError on Firestore get failure', async () => {
      const updateData = { title: 'New Title' };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const songDocRef = mockFirestore
        .collection('users')
        .doc(userId)
        .collection('songs')
        .doc(songId);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      songDocRef.get.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        service.updateSong(userId, songId, updateData),
      ).rejects.toThrow(
        new HttpException(
          'Failed to update song',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });

    it('should throw InternalServerError on Firestore update failure', async () => {
      const updateData = { title: 'New Title' };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const songDocRef = mockFirestore
        .collection('users')
        .doc(userId)
        .collection('songs')
        .doc(songId);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      songDocRef.get.mockResolvedValue({
        exists: true,
        data: () => existingSong,
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      songDocRef.update.mockRejectedValue(new Error('Write failed'));

      await expect(
        service.updateSong(userId, songId, updateData),
      ).rejects.toThrow(
        new HttpException(
          'Failed to update song',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });

  describe('updateSong - Validation Rules', () => {
    it('should accept valid title with min length (1 char)', async () => {
      const updateData = { title: 'A' };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const songDocRef = mockFirestore
        .collection('users')
        .doc(userId)
        .collection('songs')
        .doc(songId);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      songDocRef.get.mockResolvedValue({
        exists: true,
        data: () => existingSong,
      });

      const result = await service.updateSong(userId, songId, updateData);

      expect(result.title).toBe('A');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(songDocRef.update).toHaveBeenCalledWith({ title: 'A' });
    });

    it('should accept valid title with max length (255 chars)', async () => {
      const longTitle = 'a'.repeat(255);
      const updateData = { title: longTitle };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const songDocRef = mockFirestore
        .collection('users')
        .doc(userId)
        .collection('songs')
        .doc(songId);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      songDocRef.get.mockResolvedValue({
        exists: true,
        data: () => existingSong,
      });

      const result = await service.updateSong(userId, songId, updateData);

      expect(result.title).toBe(longTitle);
    });
  });
});
