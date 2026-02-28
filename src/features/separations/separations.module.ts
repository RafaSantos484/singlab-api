import { Module } from '@nestjs/common';
import { SeparationsController } from './separations.controller';
import { SeparationsService } from './separations.service';
import { StemSeparationProviderFactory } from './providers/stem-separation-provider.factory';
import { PoyoStemSeparationProvider } from './providers/poyo/poyo-separation.provider';
import { FirebaseAdminProvider } from '../../auth/firebase-admin.provider';
import { SongsModule } from '../songs/songs.module';

@Module({
  imports: [SongsModule],
  controllers: [SeparationsController],
  providers: [
    SeparationsService,
    StemSeparationProviderFactory,
    PoyoStemSeparationProvider,
    FirebaseAdminProvider,
  ],
  exports: [SeparationsService],
})
export class SeparationsModule {}
