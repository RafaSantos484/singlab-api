import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { credential } from 'firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import type { Bucket } from '@google-cloud/storage';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { Env } from '../config/env.config';

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

    try {
      if (existsSync(credentialsPath)) {
        try {
          FirebaseAdminProvider.logger.log(
            `Initializing Firebase Admin with credentials.json`,
          );
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const credentials: admin.ServiceAccount = JSON.parse(
            readFileSync(credentialsPath, 'utf-8'),
          );

          // Get bucket name from environment configuration
          const storageBucket: string = Env.firebaseStorageBucket;
          this.app = admin.initializeApp({
            credential: credential.cert(credentials),
            storageBucket,
          });

          FirebaseAdminProvider.logger.log(
            `Firebase Admin initialized with bucket: ${storageBucket}`,
          );

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
      throw new Error('credentials.json not found in project root');
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

  getBucket(): Bucket {
    return getStorage(this.getApp()).bucket();
  }
}
