# NestJS Firebase Functions Template

🚀 **Production-ready template** for building TypeScript APIs with NestJS + Express deployed as Firebase Cloud Functions.

## 🎯 Features

- ✅ **NestJS Framework** - Modern, scalable architecture with dependency injection
- ✅ **Firebase Cloud Functions** - Serverless deployment with `onRequest`
- ✅ **TypeScript** - Full type safety and modern ES features
- ✅ **Express Integration** - Compatible with Express middleware ecosystem
- ✅ **Environment Configuration** - Centralized config with type-safe `Env` class
- ✅ **CORS Support** - Configurable cross-origin resource sharing
- ✅ **Hot Reload** - Fast development with watch mode
- ✅ **Testing** - Jest configured for unit and e2e tests
- ✅ **Code Quality** - ESLint + Prettier pre-configured
- ✅ **Production Optimized** - Clean build output, no test files

## 📋 Prerequisites

- Node.js 18+ (Firebase Functions v2 requirement)
- npm or yarn
- Firebase CLI (`npm install -g firebase-tools`)
- Firebase project with Blaze (pay-as-you-go) plan

## 🚀 Quick Start

### 1. Clone & Install

```bash
# Clone this template
git clone <repository-url> my-api
cd my-api

# Install dependencies
npm install
```

### 2. Configure Firebase Project

```bash
# Login to Firebase
firebase login

# Initialize or link to existing project
firebase use --add

# Select your Firebase project and set an alias (e.g., 'default')
```

Update `.firebaserc` with your project ID:
```json
{
  "projects": {
    "default": "your-firebase-project-id"
  }
}
```

### 3. Configure Environment Variables

Copy example file and configure:

```bash
cp .env.dev.example .env.dev
```

Edit `.env.dev`:
```env
PORT=5001
CORS_ORIGIN=*
SKIP_AUTH=true
```

### 4. Run Development Server

```bash
# Local development (TypeScript hot reload)
npm run dev

# Your API will be available at http://localhost:5001
```

## 📦 Available Scripts

### Development
```bash
npm run dev          # Start with hot reload (recommended)
npm run dev:local    # Start with local Firebase emulator
npm run build        # Compile TypeScript to dist/
```

### Testing
```bash
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Generate coverage report
```

### Build & Deploy
```bash
npm run build        # Compile TypeScript to dist/
npm run serve        # Build + run Firebase emulators
npm run deploy       # Deploy to Firebase
npm run logs         # View Firebase function logs
```

### Code Quality
```bash
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
```

## 🏗️ Project Structure

```
.
├── src/
│   ├── config/
│   │   └── env.config.ts       # Centralized environment configuration
│   ├── app.controller.ts        # Example controller
│   ├── app.module.ts            # Root module
│   ├── main.ts                  # Application entry point (Firebase Function)
│   └── utils.ts                 # Utility functions
├── test/
│   ├── config/
│   │   └── env.config.spec.ts  # Env config tests
│   ├── app.controller.spec.ts  # Unit tests
│   └── app.e2e-spec.ts         # End-to-end tests
├── dist/                        # Compiled output (gitignored)
├── .env.dev                     # Development environment vars
├── .env.dev.example             # Development environment template
├── .env.production.example      # Production environment template
├── credentials.json             # Firebase service account (gitignored) ⚠️
├── credentials.json.example     # Firebase credentials template
├── firebase.json                # Firebase configuration
├── .firebaserc                  # Firebase project aliases
├── package.json                 # Dependencies and scripts
└── tsconfig.json                # TypeScript configuration
```

## 🔧 Configuration

### Environment Variables

The template uses a type-safe `Env` class located in `src/config/env.config.ts`.

Available variables:

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PORT` | `number` | `5001` | Server port for local development |
| `CORS_ORIGIN` | `string` or `array` | `*` | Allowed CORS origins (comma-separated) |
| `SKIP_AUTH` | `boolean` | `false` | Skip authentication (dev only) |
| `NODE_ENV` | `string` | - | Environment name |

#### Usage Example:

```typescript
import { Env } from './config/env.config';

const port = Env.port;              // 5001
const origins = Env.corsOrigin;     // '*' or ['http://localhost:3000']
const skipAuth = Env.skipAuth;      // true/false
```

### Adding New Environment Variables

1. Add to `.env.dev.example`:
```env
MY_NEW_VAR=default_value
```

2. Add getter to `src/config/env.config.ts`:
```typescript
static get myNewVar(): string {
  return process.env.MY_NEW_VAR || 'default_value';
}
```

3. Add test in `test/config/env.config.spec.ts`

### CORS Configuration

CORS is configured in `src/main.ts` and supports:

- `*` - Allow all origins (development)
- Single origin: `CORS_ORIGIN=https://example.com`
- Multiple origins: `CORS_ORIGIN=https://app1.com,https://app2.com`

### Firebase Service Account Credentials

If your application needs to interact with Firebase services (Firestore, Authentication, etc.):

1. Generate credentials at [Firebase Console](https://console.firebase.google.com/) → Your Project → Settings ⚙️ → Service Accounts
2. Copy `credentials.json` to project root:
   ```bash
   cp ~/Downloads/credentials.json .
   ```

**⚠️ Security Warning:**
- `credentials.json` is in `.gitignore` - never commit it!
- Only commit `credentials.json.example` with placeholder values
- Rotate credentials regularly in production

See [FIREBASE_CREDENTIALS.md](./FIREBASE_CREDENTIALS.md) for detailed setup and best practices.

## 🚀 Deployment

### Deploy to Firebase

```bash
# Build and deploy
npm run deploy

# Your function will be available at:
# https://REGION-PROJECT_ID.cloudfunctions.net/api
```

### Firebase Function Configuration

The exported function name is `api` (defined in `src/main.ts`).

To change the function name, update the export:
```typescript
export const myFunctionName = onRequest(async (req, res) => {
  // ...
});
```

### Region Configuration

To specify a region, update `src/main.ts`:
```typescript
import { onRequest } from 'firebase-functions/v2/https';

export const api = onRequest(
  { region: 'us-central1' },
  async (req, res) => {
    await createNestApplication();
    expressApp(req, res);
  }
);
```

### Performance Optimization

The template includes:
- **App caching**: NestJS app is initialized only once (cold start optimization)
- **Clean builds**: Only `src/` is compiled to `dist/`
- **Source maps**: Enabled for debugging
- **Tree shaking**: Unused code is removed

## 🔄 CI/CD

The template includes pre-configured GitHub Actions workflows:

### Continuous Integration (CI)

**Workflow**: `.github/workflows/ci.yml`

Runs on **pull requests** to `master` or `develop` branches:

- **Lint** - ESLint code quality checks
- **Test** - Jest unit and e2e tests with coverage reports
- **Build** - TypeScript compilation verification

Features:
- Parallel job execution for faster feedback
- Artifact uploads (coverage reports and build output)
- Concurrency control (cancels outdated runs)

### Continuous Deployment (CD)

**Workflow**: `.github/workflows/deploy.yml`

Automatically deploys to Firebase Functions when code is **pushed to `master`**:

1. Builds the application
2. Creates production environment file from secrets
3. Deploys to Firebase Functions using service account

**Required GitHub Secrets**:
- `FIREBASE_SERVICE_ACCOUNT` - Firebase service account JSON
- `ENV_PROD` - Production environment variables (`.env.prod` content)

### Branch Enforcement

**Workflow**: `.github/workflows/branch-enforcer.yml`

Enforces Git workflow conventions on pull requests:

**For `master` branch:**
- ✅ Only accepts PRs from `develop` or `hotfix/*` branches

**For `develop` branch:**
- ✅ Accepts PRs from feature branches: `feat/*`, `feature/*`, `fix/*`, `chore/*`, `refactor/*`, `style/*`, `ci/*`, `test/*`, `docs/*`, `hotfix/*`
- ✅ Allows back-merges from `master`

### CI/CD Setup

1. **Enable GitHub Actions** in your repository settings

2. **Add required secrets**:
   ```bash
   # GitHub Repository → Settings → Secrets and variables → Actions
   
   # Add FIREBASE_SERVICE_ACCOUNT
   # (Copy content from Firebase Console → Project Settings → Service Accounts)
   
   # Add ENV_PROD
   # Example content:
   PORT=5001
   CORS_ORIGIN=https://yourdomain.com
   SKIP_AUTH=false
   NODE_ENV=production
   ```

3. **Update Firebase project alias**:
   ```bash
   # Edit .firebaserc
   {
     "projects": {
       "prod": "your-firebase-project-id"
     }
   }
   ```

## 🧪 Testing

### Unit Tests

Located in `test/` directory matching `*.spec.ts` pattern.

```bash
npm test -- app.controller.spec.ts  # Run specific test
```

### E2E Tests

Located in `test/` directory matching `*.e2e-spec.ts` pattern.

```typescript
// test/app.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect({ message: 'Hello World!' });
  });
});
```

## 📚 Architecture

### Hexagonal Architecture Ready

The template is prepared for hexagonal (ports and adapters) architecture:

- **Config Layer**: `src/config/` - Infrastructure configuration
- **Controllers**: Entry points for HTTP requests
- **Modules**: Feature organization
- **Services**: Business logic (add in `src/`)
- **Repositories**: Data access (add in `src/`)

### Adding Features

1. Generate module:
```bash
nest generate module users
nest generate controller users
nest generate service users
```

2. Register in `AppModule`:
```typescript
@Module({
  imports: [UsersModule],
  // ...
})
export class AppModule {}
```

## 🛠️ Troubleshooting

### Cold Starts

Firebase Functions may have cold starts. Mitigation:
- Keep functions warm with Cloud Scheduler
- Use minimum instances (costs apply)
- Optimize bundle size

### Environment Variables Not Loading

Ensure you're using the correct `.env` file for your environment:
- Local development: `.env.dev`
- Firebase emulators: `.env.dev` (with local Firebase emulator setup)
- Production: Set in Firebase Console > Functions > Runtime environment variables

### Build Errors

```bash
# Clean and rebuild
npm run clean
npm run build

# Check TypeScript errors
npx tsc --noEmit
```

## 📄 License

MIT License - feel free to use this template for any project.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

- [NestJS Documentation](https://docs.nestjs.com)
- [Firebase Functions Documentation](https://firebase.google.com/docs/functions)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)

---

**Happy coding!** 🎉
