import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  Param,
  UseGuards,
  UsePipes,
  ValidationPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../../auth/firebase-auth.guard';
import type { AuthenticatedRequest } from '../../auth/types';
import { SeparationsService } from './separations.service';
import { SubmitSeparationDto } from './dto/submit-separation.dto';
import { Env } from '../../config/env.config';

@Controller('songs')
@UseGuards(FirebaseAuthGuard)
export class SeparationsController {
  private readonly logger = new Logger(SeparationsController.name);

  constructor(private readonly separationsService: SeparationsService) {}

  @Post(':songId/separations')
  @HttpCode(HttpStatus.ACCEPTED)
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async submitSeparation(
    @Req() req: AuthenticatedRequest,
    @Param('songId') songId: string,
    @Body() body: SubmitSeparationDto,
  ) {
    if (!req.user?.uid && !Env.skipAuth) {
      this.logger.warn('Unauthorized separation submission attempt');
      throw new UnauthorizedException('User authentication required');
    }

    const requestIdHeader = req.headers['x-request-id'];
    const requestId = Array.isArray(requestIdHeader)
      ? requestIdHeader[0]
      : requestIdHeader;

    const task = await this.separationsService.submitSeparation(songId, body, {
      userId: req.user?.uid,
      requestId,
    });

    return {
      success: true,
      data: {
        taskId: task.taskId,
        status: task.status,
        createdTime: task.createdTime,
        provider: task.provider,
      },
    };
  }
}
