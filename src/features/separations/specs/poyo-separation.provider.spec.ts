import {
  SeparationConfigurationError,
  SeparationConflictError,
  SeparationProviderError,
  SeparationProviderUnavailableError,
} from '../providers/separation-provider.errors';
import { PoyoStemSeparationProvider } from '../providers/poyo-separation.provider';
import {
  SeparationModelName,
  SeparationOutputType,
} from '../providers/separation-provider.types';

describe('PoyoStemSeparationProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      POYO_API_KEY: 'test-api-key',
      POYO_API_BASE_URL: 'https://poyo.example.com',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    (global as unknown as { fetch?: undefined }).fetch = undefined;
  });

  it('should map successful submission', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'task-123',
        status: 'queued',
        created_at: '2026-02-28T00:00:00Z',
      }),
    });
    (global as unknown as { fetch: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;

    const provider = new PoyoStemSeparationProvider();
    const result = await provider.submitTask(
      {
        audioUrl: 'https://audio.example.com/song.mp3',
        title: 'Song Title',
        modelName: SeparationModelName.Base,
        outputType: SeparationOutputType.General,
      },
      { requestId: 'req-1' },
    );

    expect(result).toEqual({
      taskId: 'task-123',
      status: 'queued',
      createdTime: '2026-02-28T00:00:00Z',
      provider: 'poyo',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://poyo.example.com/api/generate/submit',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-api-key',
        }),
      }),
    );
  });

  it('should throw conflict error when provider returns 409', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ message: 'Separation already exists' }),
    });
    (global as unknown as { fetch: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;

    const provider = new PoyoStemSeparationProvider();
    await expect(
      provider.submitTask(
        {
          audioUrl: 'https://audio.example.com/song.mp3',
          modelName: SeparationModelName.Base,
          outputType: SeparationOutputType.General,
        },
        {},
      ),
    ).rejects.toBeInstanceOf(SeparationConflictError);
  });

  it('should surface provider unavailable on 5xx', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ message: 'Service unavailable' }),
    });
    (global as unknown as { fetch: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;

    const provider = new PoyoStemSeparationProvider();
    await expect(
      provider.submitTask(
        {
          audioUrl: 'https://audio.example.com/song.mp3',
          modelName: SeparationModelName.Base,
          outputType: SeparationOutputType.General,
        },
        {},
      ),
    ).rejects.toBeInstanceOf(SeparationProviderUnavailableError);
  });

  it('should map non-5xx failures to provider error', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Bad request' }),
    });
    (global as unknown as { fetch: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;

    const provider = new PoyoStemSeparationProvider();
    await expect(
      provider.submitTask(
        {
          audioUrl: 'https://audio.example.com/song.mp3',
          modelName: SeparationModelName.Base,
          outputType: SeparationOutputType.General,
        },
        {},
      ),
    ).rejects.toBeInstanceOf(SeparationProviderError);
  });

  it('should throw configuration error when API key missing', () => {
    delete process.env.POYO_API_KEY;
    expect(() => new PoyoStemSeparationProvider()).toThrow(
      SeparationConfigurationError,
    );
  });

  it('should treat abort/timeout as provider unavailable', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    const fetchMock = jest.fn().mockRejectedValue(abortError);
    (global as unknown as { fetch: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;

    const provider = new PoyoStemSeparationProvider();
    await expect(
      provider.submitTask(
        {
          audioUrl: 'https://audio.example.com/song.mp3',
          modelName: SeparationModelName.Base,
          outputType: SeparationOutputType.General,
        },
        { requestId: 'req-timeout' },
      ),
    ).rejects.toBeInstanceOf(SeparationProviderUnavailableError);
  });

  it('should reject non-https base urls', () => {
    process.env.POYO_API_BASE_URL = 'http://poyo.example.com';
    expect(() => new PoyoStemSeparationProvider()).toThrow(
      SeparationConfigurationError,
    );
  });
});
