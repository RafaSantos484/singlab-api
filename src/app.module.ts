import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { FirebaseAuthGuard } from './auth/firebase-auth.guard';
import { FirebaseAdminProvider } from './auth/firebase-admin.provider';
import { DatabaseModule } from './infrastructure';
import { SongsModule } from './features/songs/songs.module';

@Module({
  imports: [DatabaseModule, SongsModule],
  controllers: [AppController],
  providers: [FirebaseAdminProvider, FirebaseAuthGuard],
})
export class AppModule {}
