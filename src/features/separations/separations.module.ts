import { Module } from '@nestjs/common';
import { SeparationsController } from './separations.controller';
import { SeparationsService } from './separations.service';
import { StemSeparationProviderFactory } from './providers/stem-separation-provider.factory';
import { PoyoStemSeparationProvider } from './providers/poyo/poyo-separation.provider';
import { FirebaseAuthGuard } from '../../auth/firebase-auth.guard';
import { FirebaseAdminProvider } from '../../auth/firebase-admin.provider';

/**
 * Module for stem separation operations.
 *
 * Acts as a stateless mediator between the frontend and external
 * separation providers. No Firestore or Storage dependencies.
 */
@Module({
  controllers: [SeparationsController],
  providers: [
    FirebaseAdminProvider,
    FirebaseAuthGuard,
    SeparationsService,
    StemSeparationProviderFactory,
    PoyoStemSeparationProvider,
  ],
  exports: [SeparationsService],
})
export class SeparationsModule {}
