import { Injectable, Logger } from '@nestjs/common';
import { Readable } from 'stream';
import type { Bucket, File } from '@google-cloud/storage';
import { FirebaseAdminProvider } from '../../auth/firebase-admin.provider';
import { FFmpegProvider } from './ffmpeg.provider';

/**
 * Supported audio/video formats for conversion.
 * Maps MIME types to file extensions and handles both audio and video containers.
 */
const SUPPORTED_FORMATS_MIME_MAP: Record<string, string> = {
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
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
  'audio/x-m4a': 'm4a',
  'audio/x-ms-wma': 'wma',
  'audio/opus': 'opus',
};

const SUPPORTED_FORMATS = [
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

/**
 * Service for audio conversion and format detection.
 * Handles conversion of various audio/video formats to MP3.
 * Converts to MP3 for universal compatibility and reasonable compression.
 *
 * Features:
 * - Thread-safe FFmpeg initialization
 * - Direct stream-to-storage pipeline (no memory accumulation)
 * - Conversion timeout protection
 * - Comprehensive format detection
 */
@Injectable()
export class AudioConversionService {
  private readonly logger = new Logger(AudioConversionService.name);
  private readonly bucket: Bucket;

  private static readonly OUTPUT_FORMAT = 'mp3';
  private static readonly OUTPUT_EXTENSION = '.mp3';
  private static readonly BITRATE = '128k';
  private static readonly CONVERSION_TIMEOUT_MS = 30000; // 30 seconds

  constructor(firebaseAdminProvider: FirebaseAdminProvider) {
    this.bucket = firebaseAdminProvider.getBucket();
  }

  /**
   * Converts and streams audio/video directly to Cloud Storage.
   * Uses stream pipeline to minimize memory footprint.
   *
   * @param fileBuffer - Original file buffer (video or audio)
   * @param inputFormat - Original file format (e.g., 'mp4', 'wav', 'webm')
   * @param storagePath - Destination path in Cloud Storage
   * @returns File path in storage
   * @throws Error if conversion fails or times out
   */
  async convertAndStreamToStorage(
    fileBuffer: Buffer,
    inputFormat: string,
    storagePath: string,
  ): Promise<{ path: string; extension: string }> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(
        () => reject(new Error('Audio conversion timeout')),
        AudioConversionService.CONVERSION_TIMEOUT_MS,
      );

      try {
        // Create input stream from buffer
        const inputStream = Readable.from(fileBuffer);

        // Create writable stream to storage (no buffering in memory)
        const writeStream = this.bucket
          .file(storagePath)
          .createWriteStream({
            metadata: {
              contentType: 'audio/mpeg',
            },
          });

        // Get FFmpeg instance (thread-safe)
        FFmpegProvider.getInstance()
          .then((ffmpeg) => {
            const command = ffmpeg(inputStream);

            let progressLogged = false;

            command
              .inputFormat(inputFormat.toLowerCase())
              .audioCodec('libmp3lame')
              .audioBitrate(AudioConversionService.BITRATE)
              .audioChannels(2)
              .audioFrequency(44100)
              .format(AudioConversionService.OUTPUT_FORMAT)
              .on('error', (error: Error) => {
                clearTimeout(timeoutId);
                writeStream.destroy();
                this.logger.error(
                  `FFmpeg conversion error: ${error.message}`,
                );
                reject(
                  new Error(`Audio conversion failed: ${error.message}`),
                );
              })
              .on('progress', (progress: { percent?: number }) => {
                if (typeof progress?.percent === 'number') {
                  if (!progressLogged) {
                    this.logger.debug(
                      `Conversion started (format: ${inputFormat})`,
                    );
                    progressLogged = true;
                  }
                }
              })
              .on('end', () => {
                this.logger.debug('FFmpeg conversion completed');
              })
              .pipe(writeStream, { end: true });

            // Handle write stream events
            writeStream.on('finish', () => {
              clearTimeout(timeoutId);
              this.logger.log(
                `File successfully written to storage: ${storagePath}`,
              );
              resolve({
                path: storagePath,
                extension: AudioConversionService.OUTPUT_EXTENSION,
              });
            });

            writeStream.on('error', (error: Error) => {
              clearTimeout(timeoutId);
              this.logger.error(`Storage write error: ${error.message}`);
              reject(new Error(`Failed to write to storage: ${error.message}`));
            });
          })
          .catch((initError: Error) => {
            clearTimeout(timeoutId);
            writeStream.destroy();
            this.logger.error(
              `Failed to initialize FFmpeg: ${initError.message}`,
            );
            reject(initError);
          });
      } catch (error) {
        clearTimeout(timeoutId);
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Conversion setup error: ${errorMsg}`);
        reject(new Error(`Audio conversion setup failed: ${errorMsg}`));
      }
    });
  }

  /**
   * Detects file format from MIME type or filename.
   * Falls back to extension-based detection if MIME type unknown.
   *
   * @param mimetype - MIME type of file
   * @param originalName - Original filename
   * @returns File extension without dot
   */
  getFileFormat(mimetype: string, originalName: string): string {
    // Try MIME type mapping first
    if (SUPPORTED_FORMATS_MIME_MAP[mimetype]) {
      return SUPPORTED_FORMATS_MIME_MAP[mimetype];
    }

    // Fallback: extract from filename
    const parts = originalName.split('.');
    if (parts.length > 1) {
      return parts[parts.length - 1].toLowerCase();
    }

    return 'unknown';
  }

  /**
   * Validates if format is supported for conversion.
   *
   * @param format - File format without dot
   * @returns true if format is supported
   */
  isSupportedFormat(format: string): boolean {
    return SUPPORTED_FORMATS.includes(format.toLowerCase());
  }

  /**
   * Gets all supported formats as comma-separated string.
   * Useful for error messages.
   *
   * @returns Formatted string of supported formats
   */
  getSupportedFormatsString(): string {
    return SUPPORTED_FORMATS.join(', ');
  }
}
