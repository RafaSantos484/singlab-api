import type { Request } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';

/**
 * Express Request object extended with authenticated user info from Firebase.
 *
 * The `user` property contains the decoded Firebase ID token after successful
 * verification by the FirebaseAuthGuard. It includes the user's uid, email,
 * custom claims, and other Firebase authentication metadata.
 *
 * @see {@link FirebaseAuthGuard} - Guard that populates this property
 * @see {@link https://firebase.google.com/docs/auth/admin/verify-id-tokens} - Firebase ID token documentation
 */
export interface AuthenticatedRequest extends Request {
  user: DecodedIdToken;
}
