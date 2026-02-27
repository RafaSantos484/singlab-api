import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import type { Bucket, File } from '@google-cloud/storage';
import { FirestoreProvider } from '../../infrastructure/database/firestore/firestore.provider';
import { FirebaseAdminProvider } from '../../auth/firebase-admin.provider';
import { UploadSongDto, UploadSongSchema } from './dtos/upload-song.dto';
import { AudioConversionUtil } from './utils/audio-conversion.util';

/**
 * Service for managing song uploads.
 * Handles validation, audio conversion, file storage, and metadata persistence.
 * Uses Firestore transactions to ensure data consistency.
 */
@Injectable()
export class SongsService {
  private readonly logger = new Logger(SongsService.name);
  private readonly firestore: admin.firestore.Firestore;
  private readonly bucket: Bucket;

  constructor(
    firestoreProvider: FirestoreProvider,
    firebaseAdminProvider: FirebaseAdminProvider,
  ) {
    this.firestore = firestoreProvider.getFirestore();
    this.bucket = firebaseAdminProvider.getBucket();
  }

  /**
   * Uploads a song with audio conversion and metadata persistence.
   * Performs atomic operations using Firestore transactions:
   * 1. Validates input data
   * 2. Converts audio to MP3 format
   * 3. Creates document in Firestore
   * 4. Uploads file to Storage
   * 5. Updates document with storage URL
   *
   * If any step fails, the entire operation is rolled back.
   *
   * @param userId - User ID (from Firebase Auth)
   * @param fileBuffer - File content as buffer
   * @param mimetype - MIME type of uploaded file
   * @param originalName - Original file name
   * @param metadata - Song metadata (title, author)
   * @returns Song document with ID and storage URL
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
    rawSongInfo: {
      url: string;
      uploadedAt: string;
    };
  }> {
    try {
      // 1. Validate metadata using zod schema
      let validatedData: UploadSongDto;
      try {
        validatedData = UploadSongSchema.parse(metadata);
      } catch (error) {
        const zodError = error as { errors?: Array<{ message: string }> };
        const messages =
          zodError.errors?.map((e) => e.message).join('; ') ||
          'Validation failed';
        this.logger.warn(`Validation error for user ${userId}: ${messages}`);
        throw new BadRequestException(`Invalid song data: ${messages}`);
      }

      // 2. Validate file format and convert to MP3
      const fileFormat = AudioConversionUtil.getFileFormat(
        mimetype,
        originalName,
      );
      if (!AudioConversionUtil.isSupportedFormat(fileFormat)) {
        throw new BadRequestException(
          `Unsupported file format: ${fileFormat}. Supported formats: audio (mp3, wav, ogg, webm, aac, flac, m4a, wma, opus) and video (mp4, webm, mov)`,
        );
      }

      this.logger.log(
        `Converting audio (${fileFormat}) to MP3 for user ${userId}`,
      );
      const { buffer: mp3Buffer, extension: mp3Extension } =
        await AudioConversionUtil.convertToMp3(fileBuffer, fileFormat);

      // 3. Create document and upload file using transaction
      const result = await this.firestore.runTransaction(
        async (transaction) => {
          // Create document reference with auto-generated ID
          const songsCollectionRef = this.firestore
            .collection('users')
            .doc(userId)
            .collection('songs');
          const songDocRef = songsCollectionRef.doc();

          // 3a. Create the document with metadata and placeholder URL
          const songData = {
            title: validatedData.title,
            author: validatedData.author,
            rawSongInfo: {
              url: '',
              uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            status: 'processing',
            format: 'mp3',
          };

          transaction.set(songDocRef, songData);

          // 3b. Upload file to Storage
          const storagePath = `users/${userId}/songs/${songDocRef.id}/raw${mp3Extension}`;
          const file: File = this.bucket.file(storagePath);

          try {
            await file.save(mp3Buffer, {
              metadata: {
                contentType: 'audio/mpeg',
                custom_metadata: {
                  userId,
                  songId: songDocRef.id,
                  originalFileName: originalName,
                },
              },
            });

            this.logger.log(`File uploaded to ${storagePath}`);
          } catch (storageError) {
            const errorMsg =
              storageError instanceof Error
                ? storageError.message
                : 'Unknown error';
            this.logger.error(`Storage upload failed: ${errorMsg}`);
            throw new Error(`Failed to upload file to storage: ${errorMsg}`);
          }

          // 3c. Get signed URL for the uploaded file (valid for 7 days)
          let rawSongUrl: string;
          try {
            const [url] = await file.getSignedUrl({
              version: 'v4',
              action: 'read',
              expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
            });
            rawSongUrl = url;
          } catch (urlError) {
            const errorMsg =
              urlError instanceof Error ? urlError.message : 'Unknown error';
            this.logger.error(`Failed to generate signed URL: ${errorMsg}`);
            throw new Error(`Failed to generate storage URL: ${errorMsg}`);
          }

          // 3d. Update document with storage URL and set status to complete
          transaction.update(songDocRef, {
            'rawSongInfo.url': rawSongUrl,
            status: 'ready',
          });

          return {
            songId: songDocRef.id,
            title: validatedData.title,
            author: validatedData.author,
            rawSongInfo: {
              url: rawSongUrl,
              uploadedAt: new Date().toISOString(),
            },
          };
        },
      );

      this.logger.log(
        `Song uploaded successfully. User: ${userId}, Song ID: ${result.songId}`,
      );
      return result;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Song upload failed for user ${userId}: ${errorMsg}`);

      // If it's already an HttpException, re-throw it
      if (error instanceof HttpException) {
        throw error;
      }

      // Otherwise, throw a generic internal server error
      throw new HttpException(
        `Failed to upload song: ${errorMsg}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
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
   *
   * Performs atomic operations:
   * 1. Validates song exists
   * 2. Deletes file from Cloud Storage
   * 3. Deletes Firestore document
   *
   * @param userId - User ID
   * @param songId - Song ID
   * @returns Success confirmation
   * @throws NotFoundException if song not found
   * @throws HttpException if deletion fails
   */
  async deleteSong(
    userId: string,
    songId: string,
  ): Promise<{ success: boolean }> {
    try {
      // 1. Verify song exists
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

      // 2. Delete file from Cloud Storage
      const storagePath = `users/${userId}/songs/${songId}/raw.mp3`;
      try {
        await this.bucket.file(storagePath).delete();
        this.logger.log(`Deleted file from storage: ${storagePath}`);
      } catch (storageError) {
        // Log but don't fail if file doesn't exist (it might have been deleted manually)
        if (
          storageError instanceof Error &&
          !storageError.message.includes('not found')
        ) {
          this.logger.warn(
            `Could not delete storage file ${storagePath}: ${storageError.message}`,
          );
        }
      }

      // 3. Delete Firestore document
      await songDocRef.delete();
      this.logger.log(
        `Deleted song ${songId} for user ${userId} (document and storage file)`,
      );

      return { success: true };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to delete song ${songId} for user ${userId}: ${errorMsg}`,
      );
      throw new HttpException(
        'Failed to delete song',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
