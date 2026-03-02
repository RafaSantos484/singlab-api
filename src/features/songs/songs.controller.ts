import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
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
import { diskStorage } from 'multer';
import * as os from 'os';
import * as path from 'path';
import { SongsService } from './songs.service';
import { FirebaseAuthGuard } from '../../auth/firebase-auth.guard';
import type { AuthenticatedRequest } from '../../auth/types';

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
   * @returns Song object with ID, metadata, rawSongInfo containing storage path
   * @throws BadRequestException if validation fails
   * @throws HttpException if upload/conversion fails
   */
  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      // Write the uploaded file to /tmp instead of keeping it in memory.
      // This is the primary RAM-saving measure: for a 50 MB WAV file the old
      // MemoryStorage approach held all 50 MB in a Buffer while FFmpeg also
      // processed it, easily pushing a 256 MB Cloud Function over its limit.
      storage: diskStorage({
        destination: os.tmpdir(),
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          const ext = path.extname(file.originalname) || '';
          cb(null, `upload-${unique}${ext}`);
        },
      }),
      limits: {
        fileSize: 100 * 1024 * 1024, // 100 MB
      },
    }),
  )
  async uploadSong(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('metadata') metadataStr: string,
  ) {
    // Validate file presence
    if (!file || typeof file !== 'object') {
      this.logger.debug('Upload attempt without file');
      throw new BadRequestException('File is required');
    }

    if (!file.path || !file.mimetype || !file.originalname) {
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
      metadata = JSON.parse(metadataStr);
    } catch {
      this.logger.debug('Invalid JSON metadata provided');
      throw new BadRequestException(
        'Metadata must be valid JSON with title and author fields',
      );
    }

    this.logger.log(
      `Song upload initiated. File size: ${file.size} bytes, temp path: ${file.path}`,
    );

    // Process upload with audio conversion (file is streamed from disk, low RAM)
    const data = await this.songsService.uploadSong(
      req.user.uid,
      file.path,
      file.mimetype,
      file.originalname,
      metadata,
    );
    return {
      success: true,
      data,
    };
  }

  /**
   * Retrieves a specific song by ID.
   *
   * @param req - Request with authenticated user
   * @param songId - Song document ID
   * @returns Song object with metadata and raw storage path
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
      data: song.toObject(),
    };
  }

  /**
   * Updates a song's metadata (title and/or author).
   * Only the provided fields are updated. File-related inputs are ignored.
   *
   * Request body:
   * ```json
   * {
   *   "title": "New Song Title",
   *   "author": "New Artist Name"
   * }
   * ```
   *
   * At least one field (title or author) must be provided.
   * Both title and author must follow the same validation as upload:
   * - Minimum length: 1 character
   * - Maximum length: 255 characters
   * - String type required
   *
   * @param req - Request with authenticated user
   * @param songId - Song document ID
   * @param body - Update payload with optional title and author
   * @returns Updated song with id, title, and author
   * @throws BadRequestException if validation fails or no fields provided
   * @throws NotFoundException if song not found
   * @throws HttpException if update fails
   */
  @Patch(':songId')
  @HttpCode(HttpStatus.OK)
  async updateSong(
    @Req() req: AuthenticatedRequest,
    @Param('songId') songId: string,
    @Body() body: Record<string, unknown>,
  ) {
    this.logger.log(
      `Update request for song ${songId} by user ${req.user.uid}`,
    );

    await this.songsService.updateSongMetadata(req.user.uid, songId, body);
    return {
      success: true,
      data: null,
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
      data: songs.map((song) => song.toObject()),
      total: songs.length,
    };
  }

  /**
   * Retrieves a fresh URL for the raw song file.
   * Generates a new signed URL on demand without storing expiration metadata.
   *
   * @param req - Request with authenticated user
   * @param songId - Song document ID
   * @returns Object with value (signed URL) and path
   * @throws NotFoundException if song not found
   */
  @Get(':songId/raw/url')
  async getRawSongUrl(
    @Req() req: AuthenticatedRequest,
    @Param('songId') songId: string,
  ) {
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

    await this.songsService.deleteSong(req.user.uid, songId);
    return {
      success: true,
      data: null,
    };
  }
}
