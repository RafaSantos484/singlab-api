import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { FirebaseAuthGuard } from './auth/firebase-auth.guard';
import { FirebaseAdminProvider } from './auth/firebase-admin.provider';
import { DatabaseModule } from './infrastructure';
import { SongsModule } from './features/songs/songs.module';
import { UsersModule } from './features/users/users.module';

@Module({
  imports: [DatabaseModule, SongsModule, UsersModule],
  controllers: [AppController],
  providers: [FirebaseAdminProvider, FirebaseAuthGuard],
})
export class AppModule {}
