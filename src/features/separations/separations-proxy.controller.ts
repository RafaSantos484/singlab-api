import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../../auth/firebase-auth.guard';
import { SeparationsService } from './separations.service';
import { SeparationProviderQueryDto } from './dtos/separation-requests.dto';

/**
 * Stateless proxy controller for stem separation requests.
 *
 * This controller acts as a gateway to external stem separation providers
 * (e.g. PoYo). It does NOT persist data to Firestore — that is the
 * frontend's responsibility.
 *
 * Design Pattern:
 * 1. Frontend submits audioUrl + title + provider
 * 2. Backend forwards to provider
 * 3. Backend returns provider response (task metadata)
 * 4. Frontend persists results to Firestore
 *
 * This separation of concerns ensures the backend remains stateless and
 * allows frontend control over data persistence.
 */
@Controller('separations')
@UseGuards(FirebaseAuthGuard)
export class SeparationsProxyController {
  constructor(private readonly separationsService: SeparationsService) {}

  /**
   * Submit a stem separation request to the configured provider.
   *
   * The frontend provides the audio URL and title directly.
   * The backend forwards the request to the provider and returns
   * the raw task metadata (task_id, status, etc.).
   *
   * After receiving the response, the frontend is responsible for
   * persisting the task data to the song's Firestore document.
   *
   * @param audioUrl - Public URL of the audio file to separate
   * @param title - Song title for provider metadata
   * @param query - Query parameters including optional provider
   * @returns Task metadata from the provider
   * @throws {BadRequestException} Missing audioUrl or title
   * @throws {ServiceUnavailableException} Provider temporarily unavailable
   * @throws {BadGatewayException} Provider returned an error
   */
  @Post('submit')
  @HttpCode(HttpStatus.ACCEPTED)
  async submitSeparation(
    @Body('audioUrl') audioUrl: string,
    @Body('title') title: string,
    @Query() query: SeparationProviderQueryDto,
  ) {
    if (!audioUrl || !title) {
      throw new BadRequestException(
        'Missing required fields: audioUrl and title',
      );
    }

    const task = await this.separationsService.submitSeparationProxy(
      audioUrl,
      title,
      query.provider,
    );

    return {
      success: true,
      data: task || null,
    };
  }

  /**
   * Retrieve the current status of a separation task from the provider.
   *
   * The frontend provides the task ID. The backend fetches the latest
   * detail from the provider and returns it as-is.
   *
   * After receiving the response, the frontend is responsible for
   * updating the song's Firestore document with the new provider data.
   *
   * @param taskId - Provider-specific task identifier
   * @param query - Query parameters including optional provider
   * @returns Task detail from the provider including status and stem URLs
   * @throws {BadRequestException} Missing taskId
   * @throws {ServiceUnavailableException} Provider temporarily unavailable
   * @throws {BadGatewayException} Provider returned an error
   */
  @Get('status')
  async refreshSeparationStatus(
    @Query('taskId') taskId: string,
    @Query() query: SeparationProviderQueryDto,
  ) {
    if (!taskId) {
      throw new BadRequestException('Missing required query parameter: taskId');
    }

    const detail = await this.separationsService.refreshSeparationStatusProxy(
      taskId,
      query.provider,
    );

    return {
      success: true,
      data: detail,
    };
  }
}
