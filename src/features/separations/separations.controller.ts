import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../../auth/firebase-auth.guard';
import { SeparationsService } from './separations.service';
import {
  SubmitSeparationDto,
  SeparationStatusQueryDto,
} from './dtos/separation-requests.dto';

/**
 * Controller for stem separation operations.
 *
 * Acts as a mediator between the frontend and external separation
 * providers (e.g. PoYo). No Firestore or Storage interaction — the
 * frontend is responsible for persisting results.
 */
@Controller('separations')
@UseGuards(FirebaseAuthGuard)
export class SeparationsController {
  private readonly logger = new Logger(SeparationsController.name);

  constructor(private readonly separationsService: SeparationsService) {}

  /**
   * Submit a stem separation task to the configured provider.
   *
   * The frontend provides the audio URL and song title directly.
   * The backend forwards the request to the provider and returns
   * the raw task metadata (task_id, status, etc.).
   *
   * @param body - Audio URL, song title, and optional provider name.
   * @returns Provider-specific task metadata.
   * @throws {ServiceUnavailableException} Provider temporarily unavailable.
   * @throws {BadGatewayException} Provider returned an error.
   */
  @Post('submit')
  @HttpCode(HttpStatus.ACCEPTED)
  async submitSeparation(
    @Body() body: SubmitSeparationDto,
  ): Promise<{ success: true; data: unknown }> {
    this.logger.log(
      `Separation submission requested (provider=${body.provider ?? 'default'})`,
    );

    const task = await this.separationsService.submitSeparation(
      body.audioUrl,
      body.title,
      body.provider,
    );

    return {
      success: true,
      data: task,
    };
  }

  /**
   * Retrieve the current status of a separation task.
   *
   * The frontend provides the provider task ID. The backend fetches
   * the latest detail from the provider and returns it as-is.
   *
   * @param query - Task ID and optional provider name.
   * @returns Provider-specific task detail.
   * @throws {NotFoundException} Task not found.
   * @throws {ServiceUnavailableException} Provider temporarily unavailable.
   */
  @Get('status')
  async getSeparationStatus(
    @Query() query: SeparationStatusQueryDto,
  ): Promise<{ success: true; data: unknown }> {
    const detail = await this.separationsService.getSeparationStatus(
      query.taskId,
      query.provider,
    );

    return {
      success: true,
      data: detail,
    };
  }
}
