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
}
