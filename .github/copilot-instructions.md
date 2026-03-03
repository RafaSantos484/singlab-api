# GitHub Copilot Instructions

## 🔥 Critical Rules (MUST ALWAYS FOLLOW)

1. **TypeScript strict mode** - Always enabled, never use `any`
2. **Dependency Injection** - Never instantiate services with `new`, always inject
3. **English only** - All code, comments, docs, commits must be in English
4. **No commit scopes** - Use `feat:`, `fix:`, `chore:` only (no parentheses)
5. **Explicit commit control** - Only commit when explicitly instructed in current message
6. **Return types** - Always specify return types on all methods
7. **Environment variables** - Use `Env.variableName`, never `process.env` directly
8. **Firebase serverless** - App instance is cached in `main.ts`, never recreate
9. **Atomic commits** - Prefer multiple small commits over single large commits
10. **Documentation sync** - Update related docs when modifying code

## Project Context

**SingLab API**: NestJS + Firebase Cloud Functions backend acting as a
**stateless gateway** between the frontend and external AI services (e.g.
PoYo stem separation). The API does **not** access Firestore or Cloud
Storage — all Firebase data and file operations are handled by the frontend.

**Stack**: NestJS v11+, TypeScript 5.7+, Firebase Functions v2, Jest, ESLint + Prettier

**Key Paths**:
- Entry: `src/main.ts` (Express + NestJS, cached for serverless)
- Config: `src/config/env.config.ts` (static `Env` class)
- Features: `src/features/separations/` (only feature module)
- Tests: `test/` (`.spec.ts` for unit, `.e2e-spec.ts` for integration)

**API Endpoints** (only 2 routes + health check):
- `POST /separations/submit` — Forward separation request to provider
- `GET /separations/status` — Fetch task status from provider
- `GET /` — Health check

## Code Style Rules

### TypeScript
- Strict mode always enabled
- Explicit types, never `any`
- Interfaces for DTOs and public APIs
- Enums for fixed value sets
- Leverage generics for type-safe reusable functions

### NestJS Patterns
- Use NestJS decorators: `@Controller`, `@Get`, `@Post`, `@Inject`
- Injectable services only (via providers)
- Feature modules pattern: `src/features/<feature>/<feature>.module.ts`
- Always specify return types on controller/service methods
- Use `@HttpCode()` for non-200 responses
- Throw `HttpException` for errors

### Naming Conventions
- Controllers: `*.controller.ts`
- Services: `*.service.ts`
- Guards: `*.guard.ts`
- Interceptors: `*.interceptor.ts`
- Modules: `*.module.ts`
- Tests: `*.spec.ts` (unit), `*.e2e-spec.ts` (integration)

### Formatting (Prettier + ESLint)
- Line width: 80 chars
- Indentation: 2 spaces
- Single quotes
- Semicolons required
- Trailing commas: ES5 style

### Documentation
- JSDoc for public APIs with `@param`, `@returns`, `@throws`
- Document environment variables and complex logic
- Keep comments concise and clear

### Language Policy
- **All code, comments, docs, and commits MUST be in English**
- Exception: Only if explicitly requested in current message
- Applies to: variable names, JSDoc, commit messages, error logs, PR descriptions

## Development Guidelines

### Environment Configuration
- Development: `NODE_ENV=dev` → `.env.dev`
- Production: `NODE_ENV=production` → `.env.production`
- Testing: `NODE_ENV=test` → `.env.test`
- Access via `Env.variableName` static getters only

### Firebase Specifics
- App instance cached in `main.ts` for serverless optimization
- Firebase Admin SDK used **only for ID token verification** (Auth)
- No Firestore or Cloud Storage access from the backend
- Region: `southamerica-east1`
- CORS preconfigured via `CORS_ORIGIN` env var
- HTTP triggers use `onRequest` from `firebase-functions/v2/https`
- Middleware order: CORS → JSON parser → URL-encoded → body trimmer

### Adding External API Integrations
- Create provider modules under `src/features/separations/providers/`
- Keep services stateless — no Firestore reads/writes
- Return raw provider responses to the frontend
- Add config to `src/config/env.config.ts`
- Add integration tests in `test/`

## Testing Patterns

### Unit Tests (`.spec.ts`)
- Test single class/function in isolation
- Mock external dependencies
- Use Jest: `describe()`, `it()`, `beforeEach()`, `expect()`

### E2E Tests (`.e2e-spec.ts`)
- Test complete request/response flow
- Use NestJS Testing Module with full ApplicationContext
- Import actual module being tested

### Test Structure Template
```typescript
describe('AppController', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  describe('GET /', () => {
    it('should return hello message', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect({ message: 'Hello World!' });
    });
  });
});
```

### Running Tests
- `npm test` - Run all tests
- `npm run test:watch` - Watch mode
- `npm run test:coverage` - Coverage report

## Git Workflow & Commits

### ⚠️ Critical: When to Commit

**Only commit if the current chat message explicitly instructs you to do so.** Previous messages asking to commit do NOT apply to the current message. Always verify the user's explicit intention in the latest request before making any git commits.

### Analyzing Changes Before Committing

Always verify and review the changes before committing:

```bash
# Check status of all modified files
git status

# View detailed differences of unstaged files
git diff

# View differences of staged files (in staging area)
git diff --staged

# Check changes of a specific file
git diff src/app.controller.ts

# View summary of changes before making multiple commits
git log -1 --name-status
```

### Commit Strategy

**Prefer smaller, atomic commits over single large commits.** Each commit should represent a single logical unit of work that can be reviewed and understood independently.

**Benefits of atomic commits:**
- Easier code review and understanding of changes
- Simpler git history for debugging and bisecting
- Better for reverting specific features without affecting others
- Clearer project history and commit messages

**When to split into multiple commits:**
- Different features or fixes should be separate commits
- Infrastructure/setup changes separate from business logic
- Documentation updates separate from code changes
- Test additions can be separate from implementation if large

**Example strategy:** For a feature with implementation, tests, and docs:
```bash
git add src/features/separations/providers/...
git commit -m "feat: add new separation provider integration"

git add test/...
git commit -m "test: add integration tests for new provider"

git add docs/
git commit -m "docs: document new provider configuration"
```

This creates a clean, reviewable history instead of one monolithic commit.

### Pull Request Title & Description

When asked to generate a pull request title or description, **analyze git context** to ensure accuracy:

```bash
# Get current branch name
git branch --show-current

# View commits on this branch (not on develop)
git log develop..HEAD --oneline

# View full commit details for context
git log develop..HEAD --format="%B"

# Compare changes with develop
git diff develop... --stat
```

**Important**: Use the branch name and commit history as context, not just current session information. This ensures the PR title/description accurately reflects what was actually implemented in the branch.

### Formatting for PR Descriptions and Commit Comments

When providing a PR description or commit comments, always output the response
as a Markdown code block.

### Rich PR Formatting Requirement

When asked to generate a PR title/description for the current branch, return a
well-structured Markdown response (inside a code block) that uses formatting to
enhance readability and clarity. Enrich the output using:
- Headings and subheadings (e.g., `#`, `##`, `###`) for sections
- Emphasis for key terms (bold, italics) and optional underline via HTML tags
- Task lists with checkboxes for tests, verification, or follow-ups
- Short, scannable bullet lists for changes and impacts
- Optional callouts (blockquotes) for important notes or risks

The goal is a polished, review-friendly PR description that highlights scope,
tests, and notable changes without being verbose.

### Branch Naming Convention
- `feat/` - New features (e.g., `feat/add-user-auth`)
- `fix/` - Bug fixes (e.g., `fix/cors-headers`)
- `chore/` - Dependencies, maintenance (e.g., `chore/update-nest`)
- `refactor/` - Code restructuring (e.g., `refactor/extract-service`)
- `style/` - Formatting, no logic changes
- `test/` - Test additions/modifications
- `docs/` - Documentation updates
- `ci/` - CI/CD configuration changes
- `hotfix/` - Production emergency fixes

### Conventional Commits Pattern

**IMPORTANT RULE**: Do not use optional scopes between the type and ':'. Use only the commit type.

**Base Format**:
```
type: description

[optional body]

[optional footer]
```

**Commit Types**:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code changes that don't affect logic (formatting, Prettier, ESLint)
- `refactor:` - Code change that neither adds feature nor fixes bug
- `perf:` - Performance improvements
- `test:` - Test additions or modifications
- `chore:` - Dependency, configuration, build changes, etc

**Correct Examples**:
```
feat: add JWT authentication to middleware
fix: correct CORS headers for local development
docs: improve Firebase setup instructions
style: format code with Prettier
refactor: extract validation logic to service
test: add integration tests for POST /users
chore: upgrade NestJS to v11.1.0
perf: optimize Firestore queries
```

**Incorrect Examples** (do not use):
```
❌ feat(auth): add JWT authentication
❌ fix(cors): correct CORS headers
❌ chore(deps): upgrade NestJS
```

### Pre-commit Checklist

Before committing, ensure:
1. ✅ `npm run lint` passes without errors
2. ✅ `npm run format` has been executed
3. ✅ `npm test` passes (or skip specific tests if documented)
4. ✅ TypeScript compiles: `tsc --noEmit`
5. ✅ Reviewed changes with `git diff` or `git diff --staged`
6. ✅ Commit message follows Conventional Commits (no scopes)
7. ✅ Changes are atomic (one topic per commit)
8. ✅ Commit message is clear and descriptive

## Common Patterns & Best Practices

### Adding a New Feature
1. Create feature module in `src/features/<feature>/<feature>.module.ts`
2. Create controller with `@Controller()` decorator
3. Create injectable service with `@Injectable()` decorator
4. Register module in `AppModule` imports

### Error Handling

Use **domain-level errors** for business logic failures. Define custom error classes extending `DomainError` in `src/common/errors/domain-error.ts`. The global exception filter automatically translates domain errors to HTTP responses with proper status codes.

**Domain errors** (preferred for domain-level failures):
```typescript
import { SeparationConflictError } from '@/common/errors';

if (isConflict) {
  throw new SeparationConflictError('Task already in progress', { taskId });
}
```

**HttpException** (for low-level validation/NestJS errors):
```typescript
import { HttpException, HttpStatus } from '@nestjs/common';

if (!audioUrl) throw new HttpException('audioUrl is required', HttpStatus.BAD_REQUEST);
```

### Input Validation
Use class-validator decorators on DTOs:
```typescript
export class CreateUserDto {
  @IsString() @MinLength(2) name: string;
  @IsEmail() email: string;
}
```

### Custom Decorators
Use `createParamDecorator` from `@nestjs/common` to extract request data.

## Build & Deployment

### Commands
- `npm run dev` - Hot reload (port 5001)
- `npm run build` - Compile to `dist/`
- `npm run lint` / `npm run format` - Code quality
- `npm run deploy` - Deploy to Firebase
- `npm run serve` - Local Firebase emulator
- `npm run logs` - View Firebase logs

### Build Output
Entry point: `dist/main.js` (Firebase Function)

## Important Notes for Code Generation

1. Always use TypeScript strict mode - enable all strict checks
2. Return explicit types - never implicit `any` on methods
3. Use dependency injection - never instantiate with `new`
4. Handle async/await properly - controllers/services are async
5. Use `Env` class for environment vars - never `process.env` directly
6. Firebase app instance cached in `main.ts` - don't recreate
7. Respect `CORS_ORIGIN` configuration
8. Use `DomainError` for business logic failures - domain errors abstract HTTP concerns
9. Keep services **stateless** - no Firestore/Storage access
10. Test isolation - tests independent, no order dependency
11. Use NestJS logger - no `console.log` in production
12. Keep docs in sync - update related docs when modifying code

## Related Configuration Files
- `tsconfig.json` - TypeScript strict mode
- `eslint.config.mjs` - ESLint + Prettier rules
- `firebase.json` / `.firebaserc` - Firebase deployment
- `nest-cli.json` - NestJS CLI configuration
