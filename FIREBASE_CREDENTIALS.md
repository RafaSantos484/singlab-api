# Firebase Service Account Credentials

This guide explains how to set up and configure Firebase service account
credentials for the SingLab API.

## Overview

The `credentials.json` file contains Firebase service account credentials used to authenticate your application with Google Cloud services. This is required for:

- Firebase Admin SDK operations
- Firestore access
- Authentication management
- Cloud Storage access
- Other Firebase services

## Security Important

Never commit `credentials.json` to version control.

- Add `credentials.json` to `.gitignore` (already done)
- Only commit `credentials.json.example` with placeholder values
- Keep secrets secure and rotate regularly
- Use environment variables or secret managers in production

## Setup Steps

### 1. Generate Service Account Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Settings** (⚙️ icon) → **Service Accounts**
4. Click **"Generate New Private Key"**
5. A JSON file will be downloaded

### 2. Copy Credentials to Project

```bash
# Copy the downloaded credentials.json to your project root
cp ~/Downloads/credentials.json .

# Do not commit this file (already in .gitignore)
```

### 3. Update credentials.json.example

Update `credentials.json.example` as a template (with placeholder values):

```json
{
  "type": "service_account",
  "project_id": "your-firebase-project-id",
  "private_key_id": "key_id_here",
  "private_key": "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com",
  "client_id": "client_id_here",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxx%40your-project.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
}
```

## Usage in Application

### Initialize Firebase Admin SDK

The application uses `FirebaseAdminProvider` to centralize Firebase initialization:

```typescript
// In src/auth/firebase-admin.provider.ts
import * as admin from 'firebase-admin';
import { credential } from 'firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import { Env } from '../config/env.config';

@Injectable()
export class FirebaseAdminProvider {
  private app: admin.app.App | null = null;

  getApp(): admin.app.App {
    if (this.app) return this.app;

    const credentialsPath = resolve('credentials.json');
    const credentials: admin.ServiceAccount = JSON.parse(
      readFileSync(credentialsPath, 'utf-8')
    );

    // Get storage bucket from environment
    const storageBucket: string = Env.firebaseStorageBucket;

    this.app = admin.initializeApp({
      credential: credential.cert(credentials),
      storageBucket,
    });

    return this.app;
  }

  getAuth(): admin.auth.Auth {
    return admin.auth(this.getApp());
  }

  getBucket(): Bucket {
    return getStorage(this.getApp()).bucket();
  }
}
```

### Environment Configuration

**Required environment variables:**

```env
# .env.dev or .env.production
APP_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
```

Place `credentials.json` in the project root directory (not committed to version control).

### Access Firestore and Storage

```typescript
// In services/controllers
constructor(
  firestoreProvider: FirestoreProvider,
  firebaseAdminProvider: FirebaseAdminProvider,
) {
  this.firestore = firestoreProvider.getFirestore();
  this.bucket = firebaseAdminProvider.getBucket();
}

// Use Firestore
const doc = await this.firestore.collection('users').doc(userId).get();

// Use Storage
const file = this.bucket.file('path/to/file.txt');
await file.save(buffer);
```

### Environment-Based Credentials

For different environments (dev, staging, production), use different Firebase projects:

```env
# .env.dev (local development)
NODE_ENV=dev
APP_FIREBASE_STORAGE_BUCKET=dev-project.appspot.com

# .env.production (production)
NODE_ENV=production
APP_FIREBASE_STORAGE_BUCKET=prod-project.appspot.com
```

Each environment should have its own `credentials.json` with the appropriate service account.

## Production Deployment

### Option 1: Firebase Functions (Recommended)

Firebase Functions automatically use the service account:
- No need to upload `credentials.json`
- Credentials are securely stored by Firebase
- Deploy with: `firebase deploy --only functions`

### Option 2: Cloud Run / Docker

```dockerfile
# Copy credentials during build (use Docker secrets if possible)
COPY credentials.json .
ENV FIREBASE_CREDENTIALS_PATH=/app/credentials.json
```

Or use Google Cloud Secret Manager:

```bash
gcloud secrets create firebase-credentials --data-file=./credentials.json
```

### Option 3: Environment Variable

```bash
# Export as base64
export FIREBASE_CREDENTIALS=$(base64 credentials.json)
```

## File Structure

```
.
├── credentials.json           # Actual credentials (gitignored)
├── credentials.json.example   # Template for reference
├── .gitignore                 # Includes credentials.json
└── src/
  └── config/
    └── firebase.config.ts # Firebase initialization
```

## Troubleshooting

### "Cannot find credentials.json"

```bash
# Ensure the file exists
ls -la credentials.json
```

### "Permission Denied" Error

Credentials may not have sufficient permissions:

1. Go to Firebase Console → Service Accounts
2. Find your service account
3. Open in Google Cloud Console
4. Go to **IAM & Admin**
5. Grant required roles:
   - `Editor` (for full access)
   - `Cloud Datastore User` (for Firestore)
   - `Cloud Functions Admin` (for Cloud Functions)

### "Invalid Private Key"

Ensure the private key format is correct:
- Starts with `-----BEGIN PRIVATE KEY-----`
- Ends with `-----END PRIVATE KEY-----`
- Newlines are escaped as `\n`

## Best Practices

Do:
- Store credentials securely (use secret managers)
- Rotate credentials regularly
- Use different credentials per environment
- Add `credentials.json` to `.gitignore`
- Document setup in `credentials.json.example`
- Use environment variables in production

Do not:
- Commit `credentials.json` to Git
- Hardcode credentials in source code
- Share credentials via email/chat
- Use the same credentials across all environments
- Log or expose credentials in error messages

## Learn More

- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/database/admin/start)
- [Service Account Documentation](https://cloud.google.com/docs/authentication/production)
- [Firebase Security Rules](https://firebase.google.com/docs/database/security)
