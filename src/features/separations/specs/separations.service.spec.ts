import {
  BadGatewayException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SeparationsService } from '../separations.service';
import {
  SeparationConflictError,
  SeparationProviderError,
  SeparationProviderUnavailableError,
} from '../providers/separation-provider.errors';
import {
  SeparationModelName,
  SeparationOutputType,
} from '../providers/separation-provider.types';

describe('SeparationsService', () => {
  const buildService = (submitImpl: jest.Mock, getSongImpl: jest.Mock) => {
    const provider = {
      name: 'poyo',
      submitTask: submitImpl,
      validateConfiguration: jest.fn(),
    } as const;

    const factory = {
      getProvider: jest.fn().mockReturnValue(provider),
    } as const;

    const songsService = {
      getSongById: getSongImpl,
    } as const;

    return new SeparationsService(
      factory as unknown as any,
      songsService as unknown as any,
    );
  };

  const dto = {
    modelName: SeparationModelName.Base,
    outputType: SeparationOutputType.General,
    title: 'Song',
  };

  const mockSong = {
    title: 'Test Song',
    author: 'Test Artist',
    rawSongInfo: {
      urlInfo: {
        value: 'https://audio.example.com/song.mp3',
        expiresAt: '2026-03-01T00:00:00Z',
      },
      uploadedAt: '2026-02-28T00:00:00Z',
    },
  };

  it('should return task on success', async () => {
    const getSong = jest.fn().mockResolvedValue(mockSong);
    const submitTask = jest.fn().mockResolvedValue({
      taskId: 'task-1',
      status: 'queued',
      provider: 'poyo',
    });
    const service = buildService(submitTask, getSong);

    const result = await service.submitSeparation('song-1', dto, {
      userId: 'user-1',
      requestId: 'req-1',
    });

    expect(result).toEqual({
      taskId: 'task-1',
      status: 'queued',
      provider: 'poyo',
    });
    expect(getSong).toHaveBeenCalledWith('user-1', 'song-1');
    expect(submitTask).toHaveBeenCalledWith(
      expect.objectContaining({
        audioUrl: 'https://audio.example.com/song.mp3',
        title: 'Song',
      }),
      expect.anything(),
    );
  });

  it('should throw NotFoundException when song not found', async () => {
    const getSong = jest.fn().mockResolvedValue(null);
    const submitTask = jest.fn();
    const service = buildService(submitTask, getSong);

    await expect(
      service.submitSeparation('song-1', dto, {
        userId: 'user-1',
        requestId: 'req-2',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should use song title when dto title not provided', async () => {
    const getSong = jest.fn().mockResolvedValue(mockSong);
    const submitTask = jest.fn().mockResolvedValue({
      taskId: 'task-1',
      status: 'queued',
      provider: 'poyo',
    });
    const service = buildService(submitTask, getSong);

    await service.submitSeparation(
      'song-1',
      { modelName: SeparationModelName.Base, outputType: SeparationOutputType.General },
      { userId: 'user-1' },
    );

    expect(submitTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Test Song' }),
      expect.anything(),
    );
  });

  it('should map conflict error to 409', async () => {
    const getSong = jest.fn().mockResolvedValue(mockSong);
    const submitTask = jest
      .fn()
      .mockRejectedValue(new SeparationConflictError('exists'));
    const service = buildService(submitTask, getSong);

    await expect(
      service.submitSeparation('song-1', dto, {
        userId: 'user-1',
        requestId: 'req-3',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('should map provider unavailable to 503', async () => {
    const getSong = jest.fn().mockResolvedValue(mockSong);
    const submitTask = jest
      .fn()
      .mockRejectedValue(new SeparationProviderUnavailableError('unavailable'));
    const service = buildService(submitTask, getSong);

    await expect(
      service.submitSeparation('song-1', dto, {
        userId: 'user-1',
        requestId: 'req-4',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('should map provider errors to 502', async () => {
    const getSong = jest.fn().mockResolvedValue(mockSong);
    const submitTask = jest
      .fn()
      .mockRejectedValue(new SeparationProviderError('provider error'));
    const service = buildService(submitTask, getSong);

    await expect(
      service.submitSeparation('song-1', dto, {
        userId: 'user-1',
        requestId: 'req-5',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('should map unknown errors to 500', async () => {
    const getSong = jest.fn().mockResolvedValue(mockSong);
    const submitTask = jest.fn().mockRejectedValue(new Error('unexpected'));
    const service = buildService(submitTask, getSong);

    await expect(
      service.submitSeparation('song-1', dto, {
        userId: 'user-1',
        requestId: 'req-6',
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
