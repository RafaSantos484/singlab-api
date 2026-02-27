import { Logger } from '@nestjs/common';

/**
 * Type definitions for fluent-ffmpeg
 */
export interface FFmpegCommand {
  inputFormat(format: string): FFmpegCommand;
  audioCodec(codec: string): FFmpegCommand;
  audioBitrate(bitrate: string): FFmpegCommand;
  audioChannels(channels: number): FFmpegCommand;
  audioFrequency(frequency: number): FFmpegCommand;
  format(format: string): FFmpegCommand;
  on(
    event: string,
    callback: (data?: { percent?: number } | Error) => void,
  ): FFmpegCommand;
  pipe(stream: NodeJS.WritableStream, options?: { end: boolean }): FFmpegCommand;
}

export interface FFmpegModule {
  (input: NodeJS.ReadableStream): FFmpegCommand;
  setFfmpegPath(path: string): void;
}

/**
 * Thread-safe FFmpeg provider with lazy initialization.
 * Ensures single instance and prevents race conditions during module loading.
 *
 * Mechanism:
 * - `instance`: Holds the initialized FFmpeg module after first load
 * - `initPromise`: Lock that ensures only one initialization happens
 *
 * Race condition prevention:
 * If two calls to getInstance() happen before first init completes,
 * the second call waits for the first one's promise instead of starting a new init.
 *
 * Example:
 * ```typescript
 * // Both calls wait for same initialization
 * const [ffmpeg1, ffmpeg2] = await Promise.all([
 *   FFmpegProvider.getInstance(),
 *   FFmpegProvider.getInstance(),
 * ]);
 * // ffmpeg1 === ffmpeg2 (same cached instance)
 * ```
 */
export class FFmpegProvider {
  private static instance: FFmpegModule | null = null;
  private static initPromise: Promise<FFmpegModule> | null = null;
  private static readonly logger = new Logger(FFmpegProvider.name);

  /**
   * Gets or initializes the FFmpeg module in a thread-safe manner.
   * Uses Promise-based lock to prevent race conditions during initialization.
   *
   * Thread-safety guarantees:
   * - Only one initialization runs at a time (even with concurrent calls)
   * - Multiple concurrent calls share the same initialization promise
   * - After first successful init, immediately returns cached instance
   *
   * @returns FFmpeg module instance
   * @throws Error if FFmpeg initialization fails
   */
  static async getInstance(): Promise<FFmpegModule> {
    // If already initialized, return immediately
    if (this.instance) {
      return this.instance;
    }

    // If initialization is in progress, wait for it
    if (this.initPromise) {
      return this.initPromise;
    }

    // Start initialization and store the promise to prevent race conditions
    this.initPromise = this.initialize();

    try {
      this.instance = await this.initPromise;
      return this.instance;
    } finally {
      this.initPromise = null;
    }
  }

  /**
   * Performs the actual FFmpeg module initialization.
   *
   * @returns Initialized FFmpeg module
   * @throws Error if initialization fails
   */
  private static async initialize(): Promise<FFmpegModule> {
    return new Promise((resolve, reject) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
        const ffmpegModule = require('fluent-ffmpeg');
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
        const ffmpegStatic = require('ffmpeg-static');

        if (ffmpegStatic) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          ffmpegModule.setFfmpegPath(ffmpegStatic);
          this.logger.debug('FFmpeg path set from ffmpeg-static');
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const instance = ffmpegModule as FFmpegModule;
        this.logger.log('FFmpeg module initialized successfully');
        resolve(instance);
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        const message = `Failed to initialize FFmpeg: ${errorMsg}`;
        this.logger.error(message);
        reject(new Error(message));
      }
    });
  }
}
