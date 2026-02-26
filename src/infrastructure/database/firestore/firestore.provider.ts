import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { credential } from 'firebase-admin';
import { readFileSync } from 'fs';

/**
 * Firestore provider factory.
 * Initializes Firebase Admin SDK and provides Firestore instance.
 * Singleton pattern ensures only one connection to Firestore.
 */
@Injectable()
export class FirestoreProvider {
  private static readonly logger = new Logger(FirestoreProvider.name);
  private firestore: admin.firestore.Firestore | null = null;

  /**
   * Gets or initializes the Firestore instance.
   * Checks if Firebase is already initialized to avoid duplicate initialization.
   *
   * @returns Firestore database instance
   * @throws Error if Firebase initialization fails
   */
  getFirestore(): admin.firestore.Firestore {
    if (this.firestore) {
      return this.firestore;
    }

    try {
      // Check if Firebase is already initialized
      const app = admin.apps.length ? admin.app() : this.initializeFirebase();

      this.firestore = admin.firestore(app);

      // Optional: Set Firestore settings for performance
      // Only set settings on first initialization
      try {
        this.firestore.settings({
          ignoreUndefinedProperties: true,
        });
      } catch {
        // Settings already configured, ignore error
        FirestoreProvider.logger.debug('Firestore settings already configured');
      }

      FirestoreProvider.logger.log('Firestore instance initialized');

      return this.firestore;
    } catch (error) {
      FirestoreProvider.logger.error('Failed to initialize Firestore', error);
      throw new Error('Firestore initialization failed');
    }
  }

  /**
   * Initializes Firebase Admin SDK.
   * Uses credentials from environment or Firebase CLI defaults.
   *
   * @returns Initialized Firebase app instance
   * @throws Error if initialization fails
   */
  private initializeFirebase(): admin.app.App {
    try {
      // Try to use service account from environment first
      const serviceAccount =
        process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
        process.env.GOOGLE_APPLICATION_CREDENTIALS;

      if (serviceAccount) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const credentials: admin.ServiceAccount =
          typeof serviceAccount === 'string'
            ? JSON.parse(readFileSync(serviceAccount, 'utf-8'))
            : JSON.parse(serviceAccount);

        return admin.initializeApp({
          credential: credential.cert(credentials),
        });
      }

      // Fallback to default credentials (works in Firebase Functions)
      return admin.initializeApp({
        credential: credential.applicationDefault(),
      });
    } catch (error) {
      FirestoreProvider.logger.error('Firebase initialization error', error);
      throw new Error('Unable to initialize Firebase');
    }
  }

  /**
   * Health check method to verify Firestore connection.
   * Useful for readiness probes in Kubernetes or health checks.
   *
   * @returns true if Firestore is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      const db = this.getFirestore();
      // Perform a simple read to verify connection
      await db.collection('_health').doc('check').get();
      return true;
    } catch (error) {
      FirestoreProvider.logger.error('Firestore health check failed', error);
      return false;
    }
  }
}
