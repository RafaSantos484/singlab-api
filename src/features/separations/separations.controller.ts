import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  Param,
  UseGuards,
  Patch,
  Body,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { FirebaseAuthGuard } from '../../auth/firebase-auth.guard';
import type { AuthenticatedRequest } from '../../auth/types';
import { SeparationsService } from './separations.service';
import {
  SeparationProviderQueryDto,
  SeparationSongParamsDto,
} from './dtos/separation-requests.dto';

@Controller('songs')
@UseGuards(FirebaseAuthGuard)
export class SeparationsController {
  private readonly logger = new Logger(SeparationsController.name);

  constructor(private readonly separationsService: SeparationsService) {}

  /**
   * Submit a stem separation task for a song.
   *
   * Validates song ownership and submits separation request to the configured provider.
   * The audio URL and title are automatically extracted from the song document.
   * Separation parameters (model, output type) are hardcoded in the provider.
   *
   * @param req - Authenticated request containing user information
   * @param songId - ID of the song to separate
   * @param provider - Optional provider name (defaults to first available)
   * @returns Task metadata from the provider
   * @throws {NotFoundException} Song not found or doesn't belong to user
   * @throws {ConflictException} Separation already exists with provider
   * @throws {ServiceUnavailableException} Provider temporarily unavailable
   * @throws {BadGatewayException} Provider returned an error
   */
  @Post(':songId/separations')
  @HttpCode(HttpStatus.ACCEPTED)
  async submitSeparation(
    @Req() req: AuthenticatedRequest,
    @Param() params: SeparationSongParamsDto,
    @Query() query: SeparationProviderQueryDto,
  ) {
    const task = await this.separationsService.submitSeparation(
      req.user.uid,
      params.songId,
      query.provider,
    );

    return {
      success: true,
      data: task || null,
    };
  }

  @Get(':songId/separations/status')
  async refreshSeparationStatus(
    @Req() req: AuthenticatedRequest,
    @Param() params: SeparationSongParamsDto,
    @Query() query: SeparationProviderQueryDto,
  ) {
    const detail = await this.separationsService.refreshSeparationStatus(
      req.user.uid,
      params.songId,
      query.provider,
    );

    return {
      success: true,
      data: detail,
    };
  }

  /**
   * Update the stems for a completed separation task.
   *
   * The client uploads stems to Firebase Storage and sends this request with
   * the storage paths. The API persists the stem paths to the song document
   * for later retrieval.
   *
   * @param req - Authenticated request containing user information
   * @param songId - ID of the song
   * @param body - Payload with stem paths (Record<stemName, storagePath>)
   * @param provider - Optional provider name (defaults to first available)
   * @returns Confirmation message
   * @throws {BadRequestException} Invalid stem paths
   * @throws {NotFoundException} Song not found or no separation exists
   */
  @Patch(':songId/separations/stems')
  @HttpCode(HttpStatus.OK)
  async updateSeparationStems(
    @Req() req: AuthenticatedRequest,
    @Param() params: SeparationSongParamsDto,
    @Query() query: SeparationProviderQueryDto,
    @Body() body: Record<string, unknown>,
  ) {
    if (!body || !body.stems || typeof body.stems !== 'object') {
      throw new BadRequestException(
        'Request body must contain a "stems" object with stem paths',
      );
    }

    await this.separationsService.updateSeparationStems(
      req.user.uid,
      params.songId,
      body.stems as Record<string, string>,
      query.provider,
    );

    return {
      success: true,
      message: 'Separation stems updated successfully',
    };
  }
}
