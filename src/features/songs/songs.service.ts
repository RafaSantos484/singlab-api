import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import type { Bucket } from '@google-cloud/storage';
import { FirestoreProvider } from '../../infrastructure/database/firestore/firestore.provider';
import { FirebaseAdminProvider } from '../../auth/firebase-admin.provider';
import { AudioConversionService } from '../audio/audio-conversion.service';
import { UploadSongDto, UploadSongSchema } from './dtos/upload-song.dto';
import { UpdateSongDto, UpdateSongSchema } from './dtos/update-song.dto';
import { DocumentReference, DocumentSnapshot } from 'firebase-admin/firestore';

// Song URL configuration constants
export const SIGNED_URL_EXPIRY_DAYS = 7;
export const SIGNED_URL_EXPIRY_MS =
  SIGNED_URL_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

const generateSignedUrlForPath = async (
  bucket: Bucket,
  path: string,
): Promise<string> => {
  const file = bucket.file(path);
  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + SIGNED_URL_EXPIRY_MS,
  });

  return url;
};

/**
 * Raw song information stored in Firestore.
 * Contains only the storage path. URLs are generated dynamically.
 */
export interface RawSongInfo {
  path: string;
  uploadedAt: string;
}

/**
 * Stems storage metadata with upload timestamp and file paths.
 */
export interface SeparatedSongStems {
  uploadedAt: string;
  paths: Record<string, string>;
}

/**
 * Separated song information stored in Firestore.
 * Contains provider name, provider-specific separation data, and stem paths.
 */
export interface SeparatedSongInfo {
  provider: string;
  providerData: unknown;
  stems: SeparatedSongStems | null;
}

type SongObject = {
  title: string;
  author: string;
  rawSongInfo: RawSongInfo;
  separatedSongInfo: SeparatedSongInfo | null;
};

/**
 * Song entity with type-safe access to properties.
 *
 * Represents a fully validated song document from Firestore. Raw storage
 * paths are persisted, while signed URLs are generated on demand when the
 * caller requests access. All properties are immutable via private attributes
 * and getter methods, with separation metadata updated through explicit
 * methods.
 */
export class Song {
  private readonly _ref: DocumentReference;
  private readonly _title: string;
  private readonly _author: string;
  private readonly _rawSongInfo: RawSongInfo;
  private _separatedSongInfo: SeparatedSongInfo | null;

  constructor(
    ref: DocumentReference,
    title: string,
    author: string,
    rawSongInfo: RawSongInfo,
    separatedSongInfo: SeparatedSongInfo | null,
  ) {
    this._ref = ref;
    this._title = title;
    this._author = author;
    this._rawSongInfo = rawSongInfo;
    this._separatedSongInfo = separatedSongInfo;
  }

  get ref(): DocumentReference {
    return this._ref;
  }

  get title(): string {
    return this._title;
  }

  get author(): string {
    return this._author;
  }

  get rawSongInfo(): RawSongInfo {
    return this._rawSongInfo;
  }

  get separatedSongInfo(): SeparatedSongInfo | null {
    return this._separatedSongInfo;
  }

  get userId(): string {
    const parts = this._ref.path.split('/');
    if (parts.length >= 2) {
      return parts[1];
    }
    return '';
  }
  get songId(): string {
    const parts = this._ref.path.split('/');
    if (parts.length >= 4) {
      return parts[3];
    }
    return '';
  }

  toObject(): SongObject {
    return {
      title: this._title,
      author: this._author,
      rawSongInfo: this._rawSongInfo,
      separatedSongInfo: this._separatedSongInfo,
    };
  }

  async getRawSongUrl(
    bucket: Bucket,
  ): Promise<{ value: string; path: string }> {
    const value = await generateSignedUrlForPath(
      bucket,
      this._rawSongInfo.path,
    );
    return { value, path: this._rawSongInfo.path };
  }

  async updateSongMetadata(title?: string, author?: string): Promise<void> {
    if (!title && !author) {
      throw new BadRequestException(
        'At least one of title or author must be provided',
      );
    }

    const updateData: Record<string, unknown> = {};
    if (title) {
      updateData.title = title;
    }
    if (author) {
      updateData.author = author;
    }

    await this._ref.update(updateData);
  }

  async updateSeparatedSongInfo(update: {
    provider: string;
    providerData?: unknown;
    stems?: SeparatedSongStems | null;
  }): Promise<void> {
    const separatedSongInfo: SeparatedSongInfo = {
      provider: update.provider,
      providerData:
        update.providerData ?? this._separatedSongInfo?.providerData ?? null,
      stems: update.stems ?? this._separatedSongInfo?.stems ?? null,
    };

    await this._ref.update({
      separatedSongInfo,
    });

    this._separatedSongInfo = separatedSongInfo;
  }
}

/**
 * Service for managing song uploads and access.
 * Responsibilities:
 * - Metadata validation
 * - Audio conversion
 * - Storage upload
 * - Firestore persistence
 * - On-demand signed URL generation for stored paths
 *
 * Uses two-phase approach for uploads:
 * 1. Convert audio and upload to Storage (can be rolled back by deletion)
 * 2. Persist metadata to Firestore
 *
 * URL Management Strategy:
 * - Generates signed URLs valid for 7 days based on stored paths
 * - Does not persist expiration metadata; clients request fresh URLs when needed
 */
@Injectable()
export class SongsService {
  private readonly logger = new Logger(SongsService.name);
  private readonly firestore: admin.firestore.Firestore;
  private readonly bucket: Bucket;

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

      // 5. Persist metadata to Firestore (store only the path)
      const rawSongInfo: RawSongInfo = {
        path: uploadedPath,
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

  async createSignedUrlForPath(path: string): Promise<string> {
    try {
      return await generateSignedUrlForPath(this.bucket, path);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to generate signed URL for path ${path}: ${errorMsg}`,
      );
      throw new HttpException(
        'Failed to generate song URL',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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
        rawSongInfo,
        separatedSongInfo: null,
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
  async getSongById(userId: string, songId: string): Promise<Song | null> {
    try {
      const snapshot = await this.firestore
        .collection('users')
        .doc(userId)
        .collection('songs')
        .doc(songId)
        .get();

      if (!snapshot.exists) {
        return null;
      }

      return this.toSong(snapshot);
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
   * Convert Firestore document data to validated Song object.
   *
   * Performs runtime validation of song document structure to ensure
   * type safety. Returns null if any required field is missing or has
   * incorrect type.
   *
   * Validates:
   * - title, author are strings
   * - rawSongInfo exists with path string
   * - separatedSongInfo (optional) with provider, providerData, and stems
   *
   * @param data - Raw Firestore document data
   * @returns Validated Song instance or null if validation fails
   */
  private toSong(snapshot: DocumentSnapshot): Song | null {
    const data = snapshot.data() as SongObject | undefined;
    if (!data) {
      return null;
    }

    if (!data.rawSongInfo?.path || typeof data.rawSongInfo.path !== 'string') {
      return null;
    }

    const separatedSongInfo = this.normalizeSeparatedSongInfo(
      data.separatedSongInfo,
    );

    return new Song(
      snapshot.ref,
      data.title,
      data.author,
      data.rawSongInfo,
      separatedSongInfo,
    );
  }

  private normalizeSeparatedSongInfo(
    separatedSongInfo: (SeparatedSongInfo & { data?: unknown }) | null,
  ): SeparatedSongInfo | null {
    if (!separatedSongInfo) {
      return null;
    }

    const providerData =
      separatedSongInfo.providerData ?? separatedSongInfo.data ?? null;

    const hasValidStemsStructure =
      separatedSongInfo.stems !== null &&
      typeof separatedSongInfo.stems === 'object' &&
      typeof separatedSongInfo.stems?.uploadedAt === 'string' &&
      typeof separatedSongInfo.stems?.paths === 'object';

    const stems = hasValidStemsStructure
      ? {
          uploadedAt: separatedSongInfo.stems?.uploadedAt as string,
          paths: separatedSongInfo.stems?.paths as Record<string, string>,
        }
      : null;

    return {
      provider: separatedSongInfo.provider,
      providerData,
      stems,
    };
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
  ): Promise<Array<Song>> {
    try {
      const snapshot = await this.firestore
        .collection('users')
        .doc(userId)
        .collection('songs')
        .limit(limit)
        .get();

      return snapshot.docs
        .map((doc) => this.toSong(doc))
        .filter((song): song is Song => song !== null);
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
  async deleteSong(userId: string, songId: string): Promise<null> {
    // 1. Fetch song document to get storage path
    const song = await this.getSongById(userId, songId);
    if (!song) {
      this.logger.warn(
        `Attempted to delete non-existent song ${songId} for user ${userId}`,
      );
      throw new NotFoundException('Song not found');
    }

    try {
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
      await song.ref.delete();
      this.logger.log(`Deleted song ${songId} for user ${userId}`);

      return null;
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
   * Updates a song's metadata (title and/or author).
   * Only updates the provided fields, ignoring any file-related inputs.
   *
   * @param userId - User ID
   * @param songId - Song ID
   * @param updateData - Partial update data (title, author)
   * @returns Updated song with id, title, and author
   * @throws BadRequestException if validation fails or no fields to update
   * @throws NotFoundException if song not found
   * @throws HttpException if update fails
   */
  async updateSongMetadata(
    userId: string,
    songId: string,
    updateData: Record<string, unknown>,
  ): Promise<null> {
    try {
      // 1. Validate update data - only allow title and author
      const validatedData = this.validateUpdateMetadata(updateData);
      const song = await this.getSongById(userId, songId);

      if (!song) {
        this.logger.warn(
          `Attempted to update non-existent song ${songId} for user ${userId}`,
        );
        throw new HttpException('Song not found', HttpStatus.NOT_FOUND);
      }

      // 2. Update Firestore document with new metadata
      await song.updateSongMetadata(validatedData.title, validatedData.author);

      this.logger.log(`Updated song ${songId} for user ${userId}`);
      return null;
    } catch (error) {
      // Re-throw validation and HTTP exceptions
      if (
        error instanceof BadRequestException ||
        error instanceof HttpException
      ) {
        throw error;
      }

      let errorMsg = 'Unknown error';
      if (error instanceof Error) {
        errorMsg = error.message;
      }

      this.logger.error(`Failed to update song ${songId}: ${errorMsg}`);
      throw new HttpException(
        'Failed to update song',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Validates song metadata for update (partial).
   * Only allows title and author fields, filters out everything else.
   * Does not throw on extra fields (simply ignores them).
   *
   * @param updateData - Raw update data
   * @returns Validated metadata with only allowed fields
   * @throws BadRequestException if validation fails
   */
  private validateUpdateMetadata(
    updateData: Record<string, unknown>,
  ): UpdateSongDto {
    try {
      return UpdateSongSchema.parse(updateData);
    } catch (error) {
      const zodError = error as { errors?: Array<{ message: string }> };
      const messages =
        zodError.errors?.map((e) => e.message).join('; ') ||
        'Validation failed';
      this.logger.debug(`Update metadata validation failed: ${messages}`);
      throw new BadRequestException(`Invalid update data: ${messages}`);
    }
  }

  /**
   * Generates a signed URL for the stored raw song path.
   * No expiration metadata is stored in Firestore; URLs are generated
   * on-demand to reflect the current storage state.
   *
   * @param userId - User ID
   * @param songId - Song ID
   * @returns Signed URL and storage path
   * @throws HttpException if song not found or generation fails
   */
  async refreshRawSongUrl(
    userId: string,
    songId: string,
  ): Promise<{
    value: string;
    path: string;
  }> {
    const song = await this.getSongById(userId, songId);

    if (!song) {
      this.logger.warn(
        `Attempted to refresh URL for non-existent song ${songId} and user ${userId}`,
      );
      throw new NotFoundException(`Song with ID ${songId} not found`);
    }

    try {
      return await song.getRawSongUrl(this.bucket);
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
