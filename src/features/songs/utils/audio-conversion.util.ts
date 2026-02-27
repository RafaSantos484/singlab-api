import { Logger } from '@nestjs/common';
import { PassThrough, Readable } from 'stream';

// Type definitions for fluent-ffmpeg
interface FFmpegCommand {
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
  pipe(stream: PassThrough, options?: { end: boolean }): FFmpegCommand;
}

let ffmpeg: ((input: Readable) => FFmpegCommand) | null = null;

// Lazy initialization of ffmpeg
function getFFmpegFn(): (input: Readable) => FFmpegCommand {
  if (!ffmpeg) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
      const ffmpegModule = require('fluent-ffmpeg');
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
      const ffmpegStatic = require('ffmpeg-static');

      if (ffmpegStatic) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        ffmpegModule.setFfmpegPath(ffmpegStatic);
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      ffmpeg = ffmpegModule;
    } catch (error) {
      throw new Error(
        `Failed to initialize FFmpeg: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  return ffmpeg as (input: Readable) => FFmpegCommand;
}

/**
 * Audio conversion utility.
 * Handles conversion of various audio/video formats to MP3 (standard format).
 * Using MP3 because it's widely supported and has good compression.
 */
export class AudioConversionUtil {
  private static readonly logger = new Logger(AudioConversionUtil.name);
  private static readonly OUTPUT_FORMAT = 'mp3';
  private static readonly OUTPUT_EXTENSION = '.mp3';
  private static readonly BITRATE = '128k'; // Reasonable quality vs file size tradeoff

  /**
   * Converts audio/video buffer to MP3 format.
   *
   * @param fileBuffer - Original file buffer (video or audio)
   * @param inputFormat - Original file format (e.g., 'mp4', 'wav', 'webm')
   * @returns Promise resolving to MP3 buffer and extension
   * @throws Error if conversion fails
   */
  static async convertToMp3(
    fileBuffer: Buffer,
    inputFormat: string,
  ): Promise<{ buffer: Buffer; extension: string }> {
    return new Promise((resolve, reject) => {
      try {
        // Create input and output streams
        const inputStream = Readable.from(fileBuffer);
        const outputStream = new PassThrough();
        const chunks: Buffer[] = [];

        // Collect output data
        outputStream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        outputStream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          AudioConversionUtil.logger.log(
            `Successfully converted to MP3 (${buffer.length} bytes)`,
          );
          resolve({
            buffer,
            extension: AudioConversionUtil.OUTPUT_EXTENSION,
          });
        });

        outputStream.on('error', (error: Error) => {
          AudioConversionUtil.logger.error(
            `Output stream error: ${error.message}`,
          );
          reject(error);
        });

        // Get FFmpeg function and configure conversion
        const ffmpegFn = getFFmpegFn();
        const ffmpegCommand = ffmpegFn(inputStream);

        ffmpegCommand
          .inputFormat(inputFormat.toLowerCase())
          .audioCodec('libmp3lame')
          .audioBitrate(AudioConversionUtil.BITRATE)
          .audioChannels(2)
          .audioFrequency(44100)
          .format(AudioConversionUtil.OUTPUT_FORMAT)
          .on('error', (error: Error) => {
            AudioConversionUtil.logger.error(
              `FFmpeg conversion error: ${error.message}`,
            );
            reject(new Error(`Audio conversion failed: ${error.message}`));
          })
          .on('progress', (progress: { percent?: number }) => {
            if (
              typeof progress?.percent === 'number' &&
              Number.isFinite(progress.percent)
            ) {
              const percent = progress.percent.toFixed(2);
              AudioConversionUtil.logger.debug(
                `Conversion progress: ${percent}%`,
              );
            }
          })
          .pipe(outputStream, { end: true });
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        AudioConversionUtil.logger.error(`Conversion setup error: ${errorMsg}`);
        reject(new Error(`Audio conversion setup failed: ${errorMsg}`));
      }
    });
  }

  /**
   * Gets the file extension from MIME type or file name.
   *
   * @param mimetype - MIME type of the file (e.g., 'audio/mpeg', 'video/mp4')
   * @param originalName - Original file name
   * @returns File extension without the dot
   */
  static getFileFormat(mimetype: string, originalName: string): string {
    // Try to extract from MIME type first
    const mimeMap: Record<string, string> = {
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/x-wav': 'wav',
      'audio/ogg': 'ogg',
      'audio/webm': 'webm',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/quicktime': 'mov',
      'audio/aac': 'aac',
      'audio/mp4': 'mp4',
    };

    if (mimeMap[mimetype]) {
      return mimeMap[mimetype];
    }

    // Fallback: extract from file name
    const parts = originalName.split('.');
    if (parts.length > 1) {
      return parts[parts.length - 1].toLowerCase();
    }

    return 'unknown';
  }

  /**
   * Validates if a file format is supported for conversion.
   * Currently supports common audio and video formats.
   *
   * @param format - File format (without dot)
   * @returns true if format is supported
   */
  static isSupportedFormat(format: string): boolean {
    const supported = [
      'mp3',
      'wav',
      'ogg',
      'webm',
      'mp4',
      'mov',
      'aac',
      'flac',
      'm4a',
      'wma',
      'opus',
    ];
    return supported.includes(format.toLowerCase());
  }
}
