import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { credential } from 'firebase-admin';
import { readFileSync } from 'fs';

/**
 * Firebase Admin SDK provider.
 * Ensures the Admin app is initialized once and reused.
 */
@Injectable()
export class FirebaseAdminProvider {
  private static readonly logger = new Logger(FirebaseAdminProvider.name);
  private app: admin.app.App | null = null;

  getApp(): admin.app.App {
    if (this.app) {
      return this.app;
    }

    if (admin.apps.length > 0) {
      this.app = admin.app();
      return this.app;
    }

    const serviceAccount =
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS;

    try {
      if (serviceAccount) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const credentials: admin.ServiceAccount =
          typeof serviceAccount === 'string'
            ? JSON.parse(readFileSync(serviceAccount, 'utf-8'))
            : JSON.parse(serviceAccount);

        this.app = admin.initializeApp({
          credential: credential.cert(credentials),
        });

        return this.app;
      }

      this.app = admin.initializeApp({
        credential: credential.applicationDefault(),
      });

      return this.app;
    } catch (error) {
      FirebaseAdminProvider.logger.error(
        'Firebase Admin initialization failed',
        error,
      );
      throw new Error('Unable to initialize Firebase Admin');
    }
  }

  getAuth(): admin.auth.Auth {
    return admin.auth(this.getApp());
  }
}
