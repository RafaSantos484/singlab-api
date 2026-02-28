import {
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  Param,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../../auth/firebase-auth.guard';
import type { AuthenticatedRequest } from '../../auth/types';
import { SeparationsService } from './separations.service';

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
    @Param('songId') songId: string,
    @Query('provider') provider?: string,
  ) {
    const task = await this.separationsService.submitSeparation(
      req.user.uid,
      songId,
      provider,
    );

    return {
      success: true,
      data: task || null,
    };
  }
}
