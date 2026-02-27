import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { credential } from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

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

    const credentialsPath = resolve('credentials.json');
    const envServiceAccount =
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS;

    try {
      // Priority 1: credentials.json in root directory
      if (existsSync(credentialsPath)) {
        try {
          FirebaseAdminProvider.logger.log(
            `Initializing Firebase Admin with credentials.json`,
          );
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const credentials: admin.ServiceAccount = JSON.parse(
            readFileSync(credentialsPath, 'utf-8'),
          );

          this.app = admin.initializeApp({
            credential: credential.cert(credentials),
          });

          return this.app;
        } catch (error) {
          // If app already initialized, retrieve it (assume it's with correct credentials)
          if (
            (error as Error).message.includes('already') ||
            admin.apps.length > 0
          ) {
            FirebaseAdminProvider.logger.log(
              `Using existing Firebase Admin app (credentials.json)`,
            );
            this.app = admin.app();
            return this.app;
          }
          throw error;
        }
      }

      // Priority 2: Environment variables
      if (envServiceAccount) {
        try {
          FirebaseAdminProvider.logger.log(
            `Initializing Firebase Admin with environment variables`,
          );
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const credentials: admin.ServiceAccount =
            typeof envServiceAccount === 'string'
              ? JSON.parse(envServiceAccount)
              : envServiceAccount;

          this.app = admin.initializeApp({
            credential: credential.cert(credentials),
          });

          return this.app;
        } catch (error) {
          // If app already initialized, retrieve it
          if (
            (error as Error).message.includes('already') ||
            admin.apps.length > 0
          ) {
            FirebaseAdminProvider.logger.log(
              `Using existing Firebase Admin app (environment variables)`,
            );
            this.app = admin.app();
            return this.app;
          }
          throw error;
        }
      }

      // Priority 3: Application default credentials (GOOGLE_APPLICATION_CREDENTIALS env)
      try {
        FirebaseAdminProvider.logger.log(
          `Initializing Firebase Admin with application default credentials`,
        );
        this.app = admin.initializeApp({
          credential: credential.applicationDefault(),
        });

        return this.app;
      } catch (error) {
        // If app already initialized, retrieve it
        if (
          (error as Error).message.includes('already') ||
          admin.apps.length > 0
        ) {
          FirebaseAdminProvider.logger.log(
            `Using existing Firebase Admin app (application default)`,
          );
          this.app = admin.app();
          return this.app;
        }
        throw error;
      }
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
