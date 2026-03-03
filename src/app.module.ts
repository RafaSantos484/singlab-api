import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { FirebaseAuthGuard } from './auth/firebase-auth.guard';
import { FirebaseAdminProvider } from './auth/firebase-admin.provider';
import { SeparationsModule } from './features/separations/separations.module';

@Module({
  imports: [SeparationsModule],
  controllers: [AppController],
  providers: [FirebaseAdminProvider, FirebaseAuthGuard],
})
export class AppModule {}
