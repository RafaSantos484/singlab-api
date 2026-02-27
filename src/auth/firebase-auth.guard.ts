import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { Env } from '../config/env.config';
import { FirebaseAdminProvider } from './firebase-admin.provider';

/**
 * Verifies Firebase Authentication bearer tokens for all HTTP routes.
 */
@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly firebaseAdmin: FirebaseAdminProvider) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (Env.skipAuth) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.get('authorization');

    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      throw new UnauthorizedException('Invalid Authorization header format');
    }

    const token = match[1].trim();
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const decodedToken = await this.firebaseAdmin
        .getAuth()
        .verifyIdToken(token);

      if (!decodedToken.email_verified) {
        throw new UnauthorizedException('Email not verified');
      }

      request.user = decodedToken;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
