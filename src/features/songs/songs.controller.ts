import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  Body,
  UseGuards,
  Req,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SongsService } from './songs.service';
import { FirebaseAuthGuard } from '../../auth/firebase-auth.guard';
import { Express } from 'express';

/**
 * Request object extended with authenticated user info.
 * User ID comes from Firebase Authentication.
 */
interface AuthenticatedRequest extends Express.Request {
  user?: {
    uid: string;
  } | null;
}

/**
 * Songs controller.
 * Handles HTTP requests related to song uploads and retrieval.
 * All routes require Firebase Authentication.
 */
@Controller('songs')
@UseGuards(FirebaseAuthGuard)
export class SongsController {
  private readonly logger = new Logger(SongsController.name);

  constructor(private readonly songsService: SongsService) {}

  /**
   * Uploads a new song.
   *
   * Expects multipart/form-data with:
   * - file: audio or video file (mp3, wav, ogg, webm, mp4, mov, etc.)
   * - metadata: JSON string containing title and author
   *
   * File size limit: 100MB (enforced at interceptor level)
   *
   * Example request:
   * ```
   * POST /songs/upload
   * Content-Type: multipart/form-data
   *
   * file: [binary file content]
   * metadata: {"title": "Song Name", "author": "Artist Name"}
   * ```
   *
   * @param req - Request with authenticated user
   * @param file - Uploaded file
   * @param metadataStr - JSON string with title and author
  * @returns Song object with ID, metadata, rawSongInfo (urlInfo and uploadedAt)
   * @throws BadRequestException if validation fails
   * @throws HttpException if upload/conversion fails
   */
  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
      },
    }),
  )
  async uploadSong(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: any,
    @Body('metadata') metadataStr: string,
  ) {
    // Validate authentication
    if (!req.user?.uid) {
      this.logger.warn('Unauthorized upload attempt without user ID');
      throw new BadRequestException('User authentication required');
    }

    // Validate file presence
    if (!file || typeof file !== 'object') {
      this.logger.debug('Upload attempt without file');
      throw new BadRequestException('File is required');
    }

    // Type guard for file properties
    const uploadedFile = file as {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
      size: number;
    };
    if (
      !uploadedFile.buffer ||
      !uploadedFile.mimetype ||
      !uploadedFile.originalname
    ) {
      throw new BadRequestException('Invalid file format');
    }

    // Validate metadata presence
    if (!metadataStr) {
      this.logger.debug('Upload attempt without metadata');
      throw new BadRequestException('Metadata JSON is required');
    }

    // Parse metadata JSON
    let metadata: Record<string, unknown>;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      metadata = JSON.parse(metadataStr);
    } catch {
      this.logger.debug('Invalid JSON metadata provided');
      throw new BadRequestException(
        'Metadata must be valid JSON with title and author fields',
      );
    }

    this.logger.log(
      `Song upload initiated. File size: ${uploadedFile.size} bytes`,
    );

    // Process upload with audio conversion
    const result = await this.songsService.uploadSong(
      req.user.uid,
      uploadedFile.buffer,
      uploadedFile.mimetype,
      uploadedFile.originalname,
      metadata,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * Retrieves a specific song by ID.
   *
   * @param req - Request with authenticated user
   * @param songId - Song document ID
   * @returns Song object with metadata and storage URL
   * @throws NotFoundException if song not found
   */
  @Get(':songId')
  async getSong(
    @Req() req: AuthenticatedRequest,
    @Param('songId') songId: string,
  ) {
    if (!req.user?.uid) {
      throw new BadRequestException('User authentication required');
    }

    const song = await this.songsService.getSongById(req.user.uid, songId);

    if (!song) {
      throw new NotFoundException('Song not found');
    }

    return {
      success: true,
      data: {
        id: songId,
        ...song,
      },
    };
  }

  /**
   * Lists all songs for the authenticated user.
   *
   * @param req - Request with authenticated user
   * @returns Array of songs with metadata
   */
  @Get()
  async listSongs(@Req() req: AuthenticatedRequest) {
    if (!req.user?.uid) {
      throw new BadRequestException('User authentication required');
    }

    const songs = await this.songsService.listUserSongs(req.user.uid);

    return {
      success: true,
      data: songs,
      total: songs.length,
    };
  }

  /**
   * Retrieves a fresh URL for the raw song file.
   * Automatically refreshes the URL if expired or near expiration.
   *
   * Returns URL valid for 7 days. If existing URL expires in less than
   * 24 hours, generates a new one and updates Firestore.
   *
   * @param req - Request with authenticated user
   * @param songId - Song document ID
   * @returns Object with value (URL), expiresAt (ISO 8601), and refreshed flag
   * @throws NotFoundException if song not found
   */
  @Get(':songId/raw/url')
  async getRawSongUrl(
    @Req() req: AuthenticatedRequest,
    @Param('songId') songId: string,
  ) {
    if (!req.user?.uid) {
      throw new BadRequestException('User authentication required');
    }

    const result = await this.songsService.refreshRawSongUrl(
      req.user.uid,
      songId,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * Deletes a song and its associated storage file.
   *
   * Deletes both the Firestore document and the audio file from Cloud Storage.
   *
   * @param req - Request with authenticated user
   * @param songId - Song document ID
   * @returns Deletion confirmation
   * @throws NotFoundException if song not found
   * @throws HttpException if deletion fails
   */
  @Delete(':songId')
  @HttpCode(HttpStatus.OK)
  async deleteSong(
    @Req() req: AuthenticatedRequest,
    @Param('songId') songId: string,
  ) {
    if (!req.user?.uid) {
      throw new BadRequestException('User authentication required');
    }

    this.logger.log(
      `Delete request for song ${songId} by user ${req.user.uid}`,
    );

    const result = await this.songsService.deleteSong(req.user.uid, songId);

    return {
      success: result.success,
      message: 'Song deleted successfully',
    };
  }
}
