/**
 * Centralized environment variables management
 *
 * Provides typed access with default values for all application configurations,
 * loaded from .env files based on NODE_ENV.
 *
 * Automatic loading:
 * - NODE_ENV=dev  → loads .env.dev
 * - NODE_ENV=prod → loads .env.production
 */

import { config } from 'dotenv';

export type CorsOrigin = '*' | string[];

type BooleanLike = string | undefined;

/**
 * Static class for accessing environment variables.
 * All getters have safe default values for development.
 */
export class Env {
  /**
   * Application execution environment.
   *
   * Common values:
   * - 'dev': Local development
   * - 'production': Production
   * - 'test': Automated tests
   *
   * @returns Value of NODE_ENV or undefined if not set
   */
  static get nodeEnv(): string | undefined {
    return process.env.NODE_ENV;
  }

  /**
   * Flag to disable authentication (dev/test only).
   *
   * WARNING: NEVER set to true in production!
   *
   * @returns true if SKIP_AUTH=true, false otherwise
   * @default false
   */
  static get skipAuth(): boolean {
    return Env.parseBoolean(process.env.SKIP_AUTH, false);
  }

  /**
   * CORS (Cross-Origin Resource Sharing) configuration.
   *
   * Supported formats:
   * - '*': Allow all origins (not recommended in production)
   * - 'http://localhost:3000,https://app.example.com': Comma-separated list
   *
   * @returns '*' or array of allowed URLs
   * @default ['http://localhost:3000']
   */
  static get corsOrigin(): CorsOrigin {
    const raw = process.env.CORS_ORIGIN;
    if (!raw) return ['http://localhost:3000'];

    if (raw.trim() === '*') return '*';

    const items = raw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    return items.length > 0 ? items : ['http://localhost:3000'];
  }

  /**
   * HTTP port for local server execution.
   *
   * Only used in development mode (when NODE_ENV=dev).
   * In production on Firebase Functions, the port is managed automatically.
   *
   * @returns Configured port number
   * @default 5001
   */
  static get port(): number {
    return Env.parseInt(process.env.PORT, 5001);
  }

  /**
   * Converts string to boolean.
   *
   * @param value - Environment variable value
   * @param fallback - Default value if not set
   * @returns true if value='true' (case-insensitive), otherwise fallback
   * @private
   */
  private static parseBoolean(value: BooleanLike, fallback: boolean): boolean {
    if (value === undefined) return fallback;
    return value.trim().toLowerCase() === 'true';
  }

  /**
   * Converts string to positive integer.
   *
   * @param value - Environment variable value
   * @param fallback - Default value if not set or invalid
   * @returns Positive integer or fallback
   * @private
   */
  private static parseInt(value: string | undefined, fallback: number): number {
    if (value === undefined || value.trim() === '') return fallback;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}

// Load environment variables from .env.{NODE_ENV} file if NODE_ENV is set
if (Env.nodeEnv) {
  console.log(
    `Loading environment variables from file: .env.${Env.nodeEnv}`,
  );
  config({ path: `.env.${Env.nodeEnv}` });
}
