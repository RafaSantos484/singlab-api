import { Env } from '../../src/config/env.config';

describe('Env', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('nodeEnv', () => {
    it('should return NODE_ENV value', () => {
      process.env.NODE_ENV = 'production';
      expect(Env.nodeEnv).toBe('production');
    });

    it('should return undefined when not set', () => {
      delete process.env.NODE_ENV;
      expect(Env.nodeEnv).toBeUndefined();
    });
  });

  describe('port', () => {
    it('should return parsed port value', () => {
      process.env.PORT = '3000';
      expect(Env.port).toBe(3000);
    });

    it('should return default port when not set', () => {
      delete process.env.PORT;
      expect(Env.port).toBe(5001);
    });

    it('should return default port when invalid', () => {
      process.env.PORT = 'invalid';
      expect(Env.port).toBe(5001);
    });

    it('should return default port when negative', () => {
      process.env.PORT = '-1';
      expect(Env.port).toBe(5001);
    });
  });

  describe('skipAuth', () => {
    it('should return true when set to "true"', () => {
      process.env.SKIP_AUTH = 'true';
      expect(Env.skipAuth).toBe(true);
    });

    it('should return false when set to "false"', () => {
      process.env.SKIP_AUTH = 'false';
      expect(Env.skipAuth).toBe(false);
    });

    it('should return false by default', () => {
      delete process.env.SKIP_AUTH;
      expect(Env.skipAuth).toBe(false);
    });

    it('should be case insensitive', () => {
      process.env.SKIP_AUTH = 'TRUE';
      expect(Env.skipAuth).toBe(true);
    });
  });

  describe('corsOrigin', () => {
    it('should return "*" when set to "*"', () => {
      process.env.CORS_ORIGIN = '*';
      expect(Env.corsOrigin).toBe('*');
    });

    it('should return array when multiple origins', () => {
      process.env.CORS_ORIGIN = 'http://localhost:3000,https://example.com';
      expect(Env.corsOrigin).toEqual([
        'http://localhost:3000',
        'https://example.com',
      ]);
    });

    it('should trim whitespace from origins', () => {
      process.env.CORS_ORIGIN = ' http://localhost:3000 , https://example.com ';
      expect(Env.corsOrigin).toEqual([
        'http://localhost:3000',
        'https://example.com',
      ]);
    });

    it('should return default when not set', () => {
      delete process.env.CORS_ORIGIN;
      expect(Env.corsOrigin).toEqual(['http://localhost:3000']);
    });

    it('should filter empty values', () => {
      process.env.CORS_ORIGIN = 'http://localhost:3000,,https://example.com';
      expect(Env.corsOrigin).toEqual([
        'http://localhost:3000',
        'https://example.com',
      ]);
    });

    it('should return default when empty string', () => {
      process.env.CORS_ORIGIN = '  ';
      expect(Env.corsOrigin).toEqual(['http://localhost:3000']);
    });
  });

  describe('separationProvider', () => {
    it('should default to poyo when not set', () => {
      delete process.env.SEPARATION_PROVIDER;
      expect(Env.separationProvider).toBe('poyo');
    });

    it('should return lowercased provider value', () => {
      process.env.SEPARATION_PROVIDER = 'PoYo';
      expect(Env.separationProvider).toBe('poyo');
    });
  });

  describe('poyoApiKey', () => {
    it('should return configured API key', () => {
      process.env.POYO_API_KEY = 'test-key';
      expect(Env.poyoApiKey).toBe('test-key');
    });

    it('should throw when API key missing', () => {
      delete process.env.POYO_API_KEY;
      expect(() => Env.poyoApiKey).toThrow(
        'POYO_API_KEY environment variable is required for PoYo separation provider',
      );
    });
  });

  describe('poyoApiBaseUrl', () => {
    it('should return default base url when not set', () => {
      delete process.env.POYO_API_BASE_URL;
      expect(Env.poyoApiBaseUrl).toBe('https://app.poyoclub.com');
    });

    it('should return configured base url', () => {
      process.env.POYO_API_BASE_URL = 'https://poyo.example.com';
      expect(Env.poyoApiBaseUrl).toBe('https://poyo.example.com');
    });
  });
});
