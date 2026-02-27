import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import type { Bucket } from '@google-cloud/storage';
import { FirestoreProvider } from '../../infrastructure/database/firestore/firestore.provider';
import { FirebaseAdminProvider } from '../../auth/firebase-admin.provider';
import { AudioConversionService } from '../audio/audio-conversion.service';
import { UploadSongDto, UploadSongSchema } from './dtos/upload-song.dto';

/**
 * Interface for raw song storage metadata.
 * Stores signed URL info with expiration for client caching.
 */
export interface RawSongInfo {
  urlInfo: {
    value: string;
    expiresAt: string;
  };
  uploadedAt: string;
}

/**
 * Service for managing song uploads and access.
 * Responsibilities:
 * - Metadata validation
 * - Audio conversion
 * - Storage upload
 * - Firestore persistence
 * - URL refresh management (automatic renewal when expiring)
 *
 * Uses two-phase approach for uploads:
 * 1. Convert audio and upload to Storage (can be rolled back by deletion)
 * 2. Persist metadata to Firestore
 *
 * URL Management Strategy:
 * - Generates signed URLs valid for 7 days
 * - Automatically refreshes URLs when <24h remaining (via refreshRawSongUrl)
 * - Stores expiration time for client-side caching optimization
 */
@Injectable()
export class SongsService {
  private readonly logger = new Logger(SongsService.name);
  private readonly firestore: admin.firestore.Firestore;
  private readonly bucket: Bucket;

  private static readonly SIGNED_URL_EXPIRY_DAYS = 7;
  private static readonly SIGNED_URL_EXPIRY_MS =
    SongsService.SIGNED_URL_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  // Refresh URL if less than 1 day remaining (safety margin)
  private static readonly REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000;

  constructor(
    firestoreProvider: FirestoreProvider,
    firebaseAdminProvider: FirebaseAdminProvider,
    private readonly audioConversionService: AudioConversionService,
  ) {
    this.firestore = firestoreProvider.getFirestore();
    this.bucket = firebaseAdminProvider.getBucket();
  }

  /**
   * Main upload orchestration method.
   * Coordinates validation, conversion, storage, and persistence.
   *
   * @param userId - User ID from Firebase Auth
   * @param fileBuffer - File content as buffer
   * @param mimetype - MIME type of uploaded file
   * @param originalName - Original filename
   * @param metadata - Song metadata (title, author)
   * @returns Upload result with song ID and URLs
   * @throws BadRequestException for validation errors
   * @throws HttpException for storage/database errors
   */
  async uploadSong(
    userId: string,
    fileBuffer: Buffer,
    mimetype: string,
    originalName: string,
    metadata: Record<string, unknown>,
  ): Promise<{
    songId: string;
    title: string;
    author: string;
    rawSongInfo: RawSongInfo;
  }> {
    try {
      // 1. Validate metadata
      const validatedData = this.validateMetadata(metadata);

      // 2. Detect and validate file format
      const fileFormat = this.audioConversionService.getFileFormat(
        mimetype,
        originalName,
      );
      this.validateFileFormat(fileFormat);

      // 3. Generate document reference and storage path
      const songDocRef = this.generateSongDocReference(userId);
      const storagePath = this.buildStoragePath(userId, songDocRef.id);

      // 4. Convert and upload to storage
      const uploadedPath = await this.convertAndUploadAudio(
        userId,
        fileBuffer,
        fileFormat,
        storagePath,
      );

      // 5. Generate signed URL
      const signedUrl = await this.generateSignedUrl(uploadedPath);
      const urlExpiresAt = new Date(
        Date.now() + SongsService.SIGNED_URL_EXPIRY_MS,
      ).toISOString();

      // 6. Persist metadata to Firestore
      const rawSongInfo: RawSongInfo = {
        urlInfo: {
          value: signedUrl,
          expiresAt: urlExpiresAt,
        },
        uploadedAt: new Date().toISOString(),
      };

      await this.persistSongMetadata(songDocRef, validatedData, rawSongInfo);

      this.logger.log(
        `Song uploaded successfully for user: ${userId}, song ID: ${songDocRef.id}`,
      );

      return {
        songId: songDocRef.id,
        title: validatedData.title,
        author: validatedData.author,
        rawSongInfo,
      };
    } catch (error) {
      // Re-throw validation and HTTP exceptions
      if (
        error instanceof BadRequestException ||
        error instanceof HttpException
      ) {
        throw error;
      }

      // Log and throw generic error
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Song upload failed for user ${userId}: ${errorMsg}`);

      throw new HttpException(
        'Failed to upload song',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Validates song metadata against schema.
   *
   * @param metadata - Raw metadata object
   * @returns Validated metadata
   * @throws BadRequestException if validation fails
   */
  private validateMetadata(metadata: Record<string, unknown>): UploadSongDto {
    try {
      return UploadSongSchema.parse(metadata);
    } catch (error) {
      const zodError = error as { errors?: Array<{ message: string }> };
      const messages =
        zodError.errors?.map((e) => e.message).join('; ') ||
        'Validation failed';
      this.logger.debug(`Metadata validation failed: ${messages}`);
      throw new BadRequestException(`Invalid song data: ${messages}`);
    }
  }

  /**
   * Validates if file format is supported.
   *
   * @param fileFormat - File format string
   * @throws BadRequestException if format is not supported or unknown
   */
  private validateFileFormat(fileFormat: string): void {
    if (fileFormat === 'unknown') {
      throw new BadRequestException(
        'Unable to detect file format. Please ensure the file has a valid extension.',
      );
    }

    if (!this.audioConversionService.isSupportedFormat(fileFormat)) {
      const supported = this.audioConversionService.getSupportedFormatsString();
      throw new BadRequestException(
        `Unsupported file format: ${fileFormat}. Supported: ${supported}`,
      );
    }
  }

  /**
   * Generates a new Firestore document reference for song.
   *
   * @param userId - User ID
   * @returns Firestore document reference
   */
  private generateSongDocReference(
    userId: string,
  ): admin.firestore.DocumentReference {
    return this.firestore
      .collection('users')
      .doc(userId)
      .collection('songs')
      .doc();
  }

  /**
   * Builds storage path for the converted audio file.
     * Uses a canonical path format for reliable cleanup and URL refresh.
   *
   * @param userId - User ID
   * @param songId - Song document ID
     * @returns Storage path
   */
  private buildStoragePath(userId: string, songId: string): string {
    return `users/${userId}/songs/${songId}/raw.mp3`;
  }

  /**
   * Converts audio and uploads to Cloud Storage.
   *
   * @param userId - User ID (for logging)
   * @param fileBuffer - File content
   * @param fileFormat - Detected format
   * @param storagePath - Target storage path
   * @returns Path where file was stored
   * @throws Error if conversion or upload fails
   */
  private async convertAndUploadAudio(
    userId: string,
    fileBuffer: Buffer,
    fileFormat: string,
    storagePath: string,
  ): Promise<string> {
    try {
      this.logger.debug(
        `Converting audio format ${fileFormat} to MP3 for user ${userId}`,
      );

      const result =
        await this.audioConversionService.convertAndStreamToStorage(
          fileBuffer,
          fileFormat,
          storagePath,
        );

      return result.path;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Audio conversion/upload failed for user ${userId}: ${errorMsg}`,
      );
      throw new Error(`Audio conversion failed: ${errorMsg}`);
    }
  }

  /**
   * Generates a signed URL for accessing the uploaded file.
   * URL valid for 7 days.
   *
   * @param storagePath - Path of file in storage
   * @returns Signed URL
   * @throws Error if URL generation fails
   */
  private async generateSignedUrl(storagePath: string): Promise<string> {
    try {
      const file = this.bucket.file(storagePath);
      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + SongsService.SIGNED_URL_EXPIRY_MS,
      });
      return url;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to generate signed URL: ${errorMsg}`);
      throw new Error(`Failed to generate storage URL: ${errorMsg}`);
    }
  }

  /**
  * Persists song metadata to Firestore.
   * On failure, does NOT attempt cleanup (caller responsibility).
   *
   * @param docRef - Firestore document reference
   * @param metadata - Song metadata
   * @param rawSongInfo - Storage info (path and URL) to be persisted
   * @throws Error if persistence fails
   */
  private async persistSongMetadata(
    docRef: admin.firestore.DocumentReference,
    metadata: UploadSongDto,
    rawSongInfo: RawSongInfo,
  ): Promise<void> {
    try {
      const songData = {
        title: metadata.title,
        author: metadata.author,
        rawSongInfo: {
          urlInfo: {
            value: rawSongInfo.urlInfo.value,
            expiresAt: rawSongInfo.urlInfo.expiresAt,
          },
          uploadedAt: rawSongInfo.uploadedAt,
        },
      };

      await docRef.set(songData);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create Firestore document: ${errorMsg}`);
      throw new Error(`Failed to persist song metadata: ${errorMsg}`);
    }
  }

  /**
   * Retrieves a user's song by ID.
   *
   * @param userId - User ID
   * @param songId - Song ID
   * @returns Song document data or null if not found
   */
  async getSongById(
    userId: string,
    songId: string,
  ): Promise<admin.firestore.DocumentData | null> {
    try {
      const doc = await this.firestore
        .collection('users')
        .doc(userId)
        .collection('songs')
        .doc(songId)
        .get();

      if (!doc.exists) {
        return null;
      }

      return doc.data() || null;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to fetch song ${songId}: ${errorMsg}`);
      throw new HttpException(
        'Failed to fetch song',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Lists all songs for a user.
   *
   * @param userId - User ID
   * @param limit - Maximum number of songs to return (default: 50)
   * @returns Array of songs
   */
  async listUserSongs(
    userId: string,
    limit: number = 50,
  ): Promise<Array<{ id: string } & admin.firestore.DocumentData>> {
    try {
      const snapshot = await this.firestore
        .collection('users')
        .doc(userId)
        .collection('songs')
        .limit(limit)
        .get();

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to list songs for user ${userId}: ${errorMsg}`);
      throw new HttpException(
        'Failed to list songs',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
  * Deletes a song and its associated storage file.
  * Uses the canonical storage path format for cleanup.
   *
   * Strategy:
  * 1. Fetch song document to confirm it exists
  * 2. Delete file from Cloud Storage
  * 3. Delete Firestore document
   *
   * @param userId - User ID
   * @param songId - Song ID
   * @returns Success confirmation
   * @throws HttpException if song not found or deletion fails
   */
  async deleteSong(
    userId: string,
    songId: string,
  ): Promise<{ success: boolean }> {
    try {
      // 1. Fetch song document to get storage path
      const songDocRef = this.firestore
        .collection('users')
        .doc(userId)
        .collection('songs')
        .doc(songId);

      const docSnapshot = await songDocRef.get();

      if (!docSnapshot.exists) {
        this.logger.warn(
          `Attempted to delete non-existent song ${songId} for user ${userId}`,
        );
        throw new HttpException('Song not found', HttpStatus.NOT_FOUND);
      }

      // 2. Build storage path for cleanup
      const storagePath = this.buildStoragePath(userId, songId);

      // 3. Delete file from Cloud Storage
      try {
        await this.bucket.file(storagePath).delete();
        this.logger.debug(`Deleted storage file: ${storagePath}`);
      } catch (storageError) {
        // Log but don't fail if file doesn't exist
        if (
          storageError instanceof Error &&
          !storageError.message.includes('not found')
        ) {
          this.logger.warn(`Could not delete storage file ${storagePath}`);
        }
      }

      // 4. Delete Firestore document
      await songDocRef.delete();
      this.logger.log(`Deleted song ${songId} for user ${userId}`);

      return { success: true };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to delete song ${songId}: ${errorMsg}`);
      throw new HttpException(
        'Failed to delete song',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
  * Refreshes raw song URL if expired or near expiration.
  * Checks urlInfo.expiresAt and generates new signed URL if needed.
   *
   * @param userId - User ID
   * @param songId - Song ID
   * @returns Current or refreshed URL with expiration info
   * @throws HttpException if song not found or refresh fails
   */
  async refreshRawSongUrl(
    userId: string,
    songId: string,
  ): Promise<{
    value: string;
    expiresAt: string;
    refreshed: boolean;
  }> {
    try {
      const songDocRef = this.firestore
        .collection('users')
        .doc(userId)
        .collection('songs')
        .doc(songId);

      const docSnapshot = await songDocRef.get();

      if (!docSnapshot.exists) {
        throw new HttpException('Song not found', HttpStatus.NOT_FOUND);
      }

      const songData = docSnapshot.data() as
        | { rawSongInfo?: RawSongInfo }
        | undefined;
      if (!songData?.rawSongInfo?.urlInfo) {
        throw new HttpException(
          'Song has no raw audio info',
          HttpStatus.NOT_FOUND,
        );
      }

      const { value, expiresAt } = songData.rawSongInfo.urlInfo;

      // Check if URL needs refresh (expired or within threshold)
      const expirationTime = new Date(expiresAt).getTime();
      const now = Date.now();
      const needsRefresh =
        expirationTime - now < SongsService.REFRESH_THRESHOLD_MS;

      if (!needsRefresh) {
        // URL still valid, return as-is
        return { value, expiresAt, refreshed: false };
      }

      // Generate new signed URL
      this.logger.debug(
        `Refreshing expired URL for song ${songId}, user ${userId}`,
      );

      const storagePath = this.buildStoragePath(userId, songId);
      const newSignedUrl = await this.generateSignedUrl(storagePath);
      const newUrlExpiresAt = new Date(
        Date.now() + SongsService.SIGNED_URL_EXPIRY_MS,
      ).toISOString();

      // Update Firestore with new URL
      await songDocRef.update({
        'rawSongInfo.urlInfo.value': newSignedUrl,
        'rawSongInfo.urlInfo.expiresAt': newUrlExpiresAt,
      });

      this.logger.log(
        `Refreshed raw song URL for song ${songId}, user ${userId}`,
      );

      return {
        value: newSignedUrl,
        expiresAt: newUrlExpiresAt,
        refreshed: true,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to refresh URL for song ${songId}: ${errorMsg}`,
      );
      throw new HttpException(
        'Failed to refresh song URL',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
