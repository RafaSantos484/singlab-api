import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { credential } from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Firebase Admin SDK provider.
 * Ensures the Admin app is initialized once and reused across requests.
 *
 * Initialization strategy (in priority order):
 * 1. Return cached app instance if already initialized
 * 2. Use existing admin.app() if credentials were initialized elsewhere
 * 3. Load credentials from `credentials.json` and initialize with cert
 * 4. Fall back to Application Default Credentials (ADC) for production environments
 *
 * ADC supports multiple credential sources:
 * - Environment variables (GOOGLE_APPLICATION_CREDENTIALS)
 * - Service account file in well-known paths
 * - Cloud Run/Functions managed identities
 * - Local emulator (when FIREBASE_EMULATOR_HOST is set)
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

    const credentialsPath = resolve('credentials.json');

    try {
      if (existsSync(credentialsPath)) {
        FirebaseAdminProvider.logger.log(
          'Initializing Firebase Admin with credentials.json',
        );
        const credentials: admin.ServiceAccount = JSON.parse(
          readFileSync(credentialsPath, 'utf-8'),
        );

        this.app = admin.initializeApp({
          credential: credential.cert(credentials),
        });

        FirebaseAdminProvider.logger.log(
          'Firebase Admin initialized successfully',
        );

        return this.app;
      }

      FirebaseAdminProvider.logger.log(
        'credentials.json not found, attempting Application Default Credentials',
      );

      this.app = admin.initializeApp({
        credential: credential.applicationDefault(),
      });

      FirebaseAdminProvider.logger.log('Firebase Admin initialized with ADC');

      return this.app;
    } catch (error) {
      FirebaseAdminProvider.logger.error(
        'Firebase Admin initialization failed',
        error instanceof Error ? error.stack : undefined,
      );
      throw new Error(
        'Unable to initialize Firebase Admin. Ensure credentials.json is present or ADC is configured.',
      );
    }
  }

  getAuth(): admin.auth.Auth {
    return admin.auth(this.getApp());
  }
}
