import { Module } from '@nestjs/common';
import { SeparationsController } from './separations.controller';
import { SeparationsProxyController } from './separations-proxy.controller';
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
  imports: [SongsModule],
  controllers: [SeparationsController, SeparationsProxyController],
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
