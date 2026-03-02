import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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
   * Registers a new song document.
   *
   * The client must:
   * 1. Pre-generate a `songId` (e.g. a Firestore client-side doc ID).
   * 2. Upload the raw audio file to Cloud Storage at
   *    `users/:userId/songs/:songId/raw.mp3`.
   * 3. Call this endpoint with `{ songId, title, author }`.
   *
   * The API validates the metadata, verifies the raw file exists at the
   * canonical Storage path, then persists the Firestore document.
   *
   * Example request:
   * ```
   * POST /songs/upload
   * Content-Type: application/json
   *
   * { "songId": "abc123", "title": "Song Name", "author": "Artist Name" }
   * ```
   *
   * @param req - Request with authenticated user
   * @param body - JSON body with songId, title and author
   * @returns Song object with ID, metadata, and rawSongInfo
   * @throws BadRequestException if validation fails or raw file is missing
   * @throws HttpException if database operation fails
   */
  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  async uploadSong(
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    if (!body || Object.keys(body).length === 0) {
      throw new BadRequestException(
        'Request body with title and author is required',
      );
    }

    this.logger.log(`Song registration initiated for user: ${req.user.uid}`);

    const data = await this.songsService.uploadSong(req.user.uid, body);
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
