import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseAdminProvider } from '../../../auth/firebase-admin.provider';

/**
 * Firestore provider factory.
 * Provides Firestore instance using centralized Firebase initialization.
 * Delegates Firebase Admin SDK initialization to FirebaseAdminProvider.
 * Singleton pattern ensures only one connection to Firestore.
 */
@Injectable()
export class FirestoreProvider {
  private static readonly logger = new Logger(FirestoreProvider.name);
  private firestore: admin.firestore.Firestore | null = null;

  constructor(private readonly firebaseAdminProvider: FirebaseAdminProvider) {}

  /**
   * Gets or initializes the Firestore instance.
   * Uses centralized Firebase initialization from FirebaseAdminProvider.
   *
   * @returns Firestore database instance
   * @throws Error if Firebase initialization fails
   */
  getFirestore(): admin.firestore.Firestore {
    if (this.firestore) {
      return this.firestore;
    }

    try {
      // Get Firebase Admin app from centralized provider
      const app = this.firebaseAdminProvider.getApp();

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
