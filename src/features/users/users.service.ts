import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirestoreProvider } from '../../infrastructure/database/firestore/firestore.provider';
import { FirebaseAdminProvider } from '../../auth/firebase-admin.provider';
import { CreateUserDto, CreateUserSchema } from './dtos/create-user.dto';

/**
 * Result returned after successfully creating a user.
 */
export interface CreateUserResult {
  uid: string;
  name: string;
  email: string;
  createdAt: string;
}

/**
 * Service responsible for user creation.
 *
 * Creation strategy (two-phase with rollback):
 * 1. Create the user in Firebase Authentication.
 * 2. Persist the user document in Firestore using the Auth UID as document ID.
 *
 * If step 2 fails, the Auth user is deleted to prevent orphaned accounts.
 * If step 1 fails, no cleanup is required.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly firestore: admin.firestore.Firestore;
  private readonly auth: admin.auth.Auth;

  /** Top-level Firestore collection for users. */
  private static readonly USERS_COLLECTION = 'users';

  constructor(
    firestoreProvider: FirestoreProvider,
    firebaseAdminProvider: FirebaseAdminProvider,
  ) {
    this.firestore = firestoreProvider.getFirestore();
    this.auth = firebaseAdminProvider.getAuth();
  }

  /**
   * Creates a new user in Firebase Authentication and Firestore.
   *
   * Validates the input, creates the Auth account, then persists the
   * profile document. If the Firestore write fails the Auth user is
   * deleted (rollback) to keep both stores consistent.
   *
   * @param body - Raw request body to validate and use for creation
   * @returns Created user data (uid, name, email, createdAt)
   * @throws BadRequestException if validation fails
   * @throws ConflictException if the e-mail is already registered
   * @throws HttpException for unexpected errors
   */
  async createUser(body: Record<string, unknown>): Promise<CreateUserResult> {
    const dto = this.validateInput(body);

    const authUser = await this.createAuthUser(dto);
    const uid = authUser.uid;

    try {
      const createdAt = new Date().toISOString();
      await this.createFirestoreDocument(uid, dto, createdAt);

      this.logger.log(`User created successfully: ${uid}`);

      return { uid, name: dto.name, email: dto.email, createdAt };
    } catch (error) {
      // Firestore write failed — roll back by deleting the Auth user.
      await this.rollbackAuthUser(uid);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Validates the raw input body against the CreateUserSchema.
   *
   * @param body - Raw request body
   * @returns Validated DTO
   * @throws BadRequestException if validation fails
   */
  private validateInput(body: Record<string, unknown>): CreateUserDto {
    const result = CreateUserSchema.safeParse(body);

    if (!result.success) {
      const messages = result.error.issues.map((e) => e.message).join('; ');
      this.logger.debug(`User creation validation failed: ${messages}`);
      throw new BadRequestException(`Invalid user data: ${messages}`);
    }

    return result.data;
  }

  /**
   * Creates the user in Firebase Authentication.
   *
   * @param dto - Validated user data
   * @returns Firebase Auth `UserRecord`
   * @throws ConflictException if the e-mail already exists
   * @throws HttpException for other Auth errors
   */
  private async createAuthUser(
    dto: CreateUserDto,
  ): Promise<admin.auth.UserRecord> {
    try {
      return await this.auth.createUser({
        displayName: dto.name,
        email: dto.email,
        password: dto.password,
      });
    } catch (error) {
      const code = (error as { code?: string }).code;

      if (code === 'auth/email-already-exists') {
        this.logger.debug(
          `User creation failed — e-mail already exists: ${dto.email}`,
        );
        throw new ConflictException('E-mail address is already in use');
      }

      const message =
        error instanceof Error ? error.message : 'Unknown Auth error';
      this.logger.error(
        `Firebase Auth user creation failed for ${dto.email}: ${message}`,
      );
      throw new HttpException(
        'Failed to create user account',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Persists the user profile document in Firestore.
   * The document ID is the Firebase Auth UID.
   *
   * @param uid - Firebase Auth UID
   * @param dto - Validated user data
   * @param createdAt - ISO timestamp of creation
   * @throws HttpException if the write fails
   */
  private async createFirestoreDocument(
    uid: string,
    dto: CreateUserDto,
    createdAt: string,
  ): Promise<void> {
    try {
      await this.firestore
        .collection(UsersService.USERS_COLLECTION)
        .doc(uid)
        .set({
          name: dto.name,
          email: dto.email,
          createdAt,
        });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown Firestore error';
      this.logger.error(
        `Failed to create Firestore document for user ${uid}: ${message}`,
      );
      throw new HttpException(
        'Failed to persist user profile',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Rolls back a Firebase Auth user after a failed Firestore write.
   * Errors during rollback are logged but not re-thrown to avoid masking
   * the original error.
   *
   * @param uid - Firebase Auth UID to delete
   */
  private async rollbackAuthUser(uid: string): Promise<void> {
    try {
      await this.auth.deleteUser(uid);
      this.logger.warn(
        `Rolled back Auth user ${uid} after Firestore write failure`,
      );
    } catch (rollbackError) {
      const message =
        rollbackError instanceof Error
          ? rollbackError.message
          : 'Unknown error';
      this.logger.error(
        `Failed to roll back Auth user ${uid}: ${message}. ` +
          'Manual cleanup may be required.',
      );
    }
  }
}
