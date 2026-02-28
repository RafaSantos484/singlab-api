import { StemSeparationProviderFactory } from '../providers/stem-separation-provider.factory';
import { SeparationConfigurationError } from '../providers/separation-provider.errors';
import { PoyoStemSeparationProvider } from '../providers/poyo-separation.provider';

describe('StemSeparationProviderFactory', () => {
  const originalEnv = process.env;
  const poyoProvider = {
    name: 'poyo',
    submitTask: jest.fn(),
    validateConfiguration: jest.fn(),
  } as unknown as PoyoStemSeparationProvider;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return PoYo provider when configured', () => {
    process.env = { ...originalEnv, SEPARATION_PROVIDER: 'poyo' };
    const factory = new StemSeparationProviderFactory(poyoProvider);

    expect(factory.getProvider()).toBe(poyoProvider);
  });

  it('should throw when provider unsupported', () => {
    process.env = { ...originalEnv, SEPARATION_PROVIDER: 'unknown' };
    expect(() => new StemSeparationProviderFactory(poyoProvider)).toThrow(
      SeparationConfigurationError,
    );
  });
});
