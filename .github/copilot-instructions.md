# GitHub Copilot Instructions

## Project Overview

This is a **NestJS + Firebase Cloud Functions** production template for building TypeScript REST APIs. The project combines modern NestJS architecture with serverless Firebase deployment.

### Key Technologies
- **Framework**: NestJS v11+ with Express adapter
- **Deployment**: Firebase Cloud Functions v2 (HTTP triggers)
- **Language**: TypeScript 5.7+
- **Testing**: Jest with ts-jest
- **Code Quality**: ESLint + Prettier + TypeScript strict mode

## Architecture & Structure

### Core Application Flow

1. **Entry Point** (`src/main.ts`):
   - Creates Express app with middleware (CORS, JSON parser, body trimmer)
   - Initializes NestJS with cached instance for serverless optimization
   - Exports `api` Firebase Function handler
   - Supports local development and Firebase Functions deployment

2. **Module System** (`src/app.module.ts`):
   - Root NestJS module with dependency injection
   - Centralized configuration and provider management
   - Import shared utilities, guards, interceptors here

3. **Controllers** (`src/*.controller.ts`):
   - NestJS controllers handle HTTP routes
   - Use decorators: `@Controller()`, `@Get()`, `@Post()`, etc.
   - Return typed objects (interfaces/classes)

4. **Configuration** (`src/config/env.config.ts`):
   - Static `Env` class for all environment variables
   - Type-safe getters with safe defaults
   - Supports `.env.dev` and `.env.production` files
   - Variables: `nodeEnv`, `skipAuth`, `corsOrigin`, `port`

### Directory Structure

```
src/
├── app.controller.ts      # HTTP route handlers
├── app.module.ts          # NestJS root module
├── main.ts                # Application entry & Firebase export
├── utils.ts               # Static utility functions
└── config/
    └── env.config.ts      # Environment configuration

test/
├── app.controller.spec.ts # Unit tests
├── app.e2e-spec.ts        # E2E integration tests
└── config/
    └── env.config.spec.ts # Config tests
```

## Code Style & Conventions

### TypeScript
- **Strict Mode**: Always enabled (`strict: true` in tsconfig.json)
- **Type Safety**: Prefer explicit types over `any`
- **Interfaces**: Use for public APIs and DTOs
- **Enums**: Use for fixed sets of values (auth states, environments)
- **Generics**: Leverage for reusable type-safe functions

### NestJS Patterns
- **Decorators**: Use NestJS decorators (`@Controller`, `@Get`, `@Inject`, etc.)
- **Dependency Injection**: All services must be injectable via NestJS providers
- **Module Pattern**: Organize features into feature modules
- **Return Types**: Always specify return types on controller methods
- **HTTP Status**: Use NestJS `HttpCode` decorator for non-200 responses
- **Error Handling**: Use NestJS exception filters and HttpException

### Class & File Naming
- **Controllers**: `*.controller.ts` (e.g., `user.controller.ts`)
- **Services**: `*.service.ts` (e.g., `user.service.ts`)
- **Guards**: `*.guard.ts` (e.g., `auth.guard.ts`)
- **Interceptors**: `*.interceptor.ts` (e.g., `logging.interceptor.ts`)
- **Modules**: `*.module.ts` (e.g., `user.module.ts`)
- **Tests**: `*.spec.ts` for unit tests, `*.e2e-spec.ts` for E2E tests

### Formatting
- **Code Formatter**: Prettier (automatic on save via eslint)
- **Line Width**: 80 characters (configured in eslint.config.mjs)
- **Indentation**: 2 spaces
- **Quotes**: Single quotes for strings (ESLint rule)
- **Semicolons**: Always include
- **Trailing Commas**: ES5 style (in objects/arrays, not function params)

### Documentation
- Use JSDoc comments for public APIs:
  ```typescript
  /**
   * Fetches user profile by ID.
   * Returns cached data if available.
   *
   * @param userId - The unique user identifier
   * @returns Promise resolving to user profile
   * @throws HttpException if user not found (404)
   */
  async getUserProfile(userId: string): Promise<UserDto> { }
  ```
- Document environment variables, configuration, and complex logic
- Keep comments concise and use @param @returns @throws tags

### Language Policy
- **Default Language**: All code, documentation, comments, and messages must be in **English**
- **Exception**: Only if explicitly requested by the user in the current message, generate content in Portuguese or other languages
- **Applies to**:
  - Code comments and JSDoc
  - Variable/function/class names (always English)
  - Git commit messages (must follow Conventional Commits in English)
  - Documentation files (README.md, guides, etc.)
  - Workflow file names and comments
  - Error messages and logs
  - All GitHub Issues and PR descriptions
- **Example**:
  ```typescript
  // ✅ CORRECT
  /**
   * Calculates user's total purchases
   */
  function calculateTotalPurchases(userId: string) { }
  
  // ❌ WRONG
  /**
   * Calcula o total de compras do usuário
   */
  function calculateTotalPurchases(userId: string) { }
  ```

## Development Guidelines

### Environment Configuration
- **Development**: `NODE_ENV=dev` → uses `.env.dev`
- **Production**: `NODE_ENV=production` → uses `.env.production`
- **Testing**: `NODE_ENV=test` → uses `.env.test` (if exists)
- Access via `Env.variableName` static getters

### Firebase Functions Specifics
- Application instance is **cached** for performance (serverless optimization)
- Supports both local Express and Firebase Cloud Functions
- CORS is preconfigured, can be overridden via `CORS_ORIGIN` env var
- Region: `southamerica-east1` (change in `src/main.ts` if needed)
- HTTP triggers use `onRequest` handler from `firebase-functions/v2/https`

### Middleware Order (in `src/main.ts`)
1. CORS middleware
2. JSON parser
3. URL-encoded parser
4. Custom body trimmer (removes whitespace from string fields)

### Database Integration
When adding database support (Firestore, MongoDB, Postgres):
- Create feature modules under `src/features/`
- Use NestJS services with dependency injection
- Add configuration to `src/config/env.config.ts`
- Follow Repository pattern for data access
- Add integration tests in `test/`

## Testing Patterns

### Unit Tests (`.spec.ts`)
- Test single class/function in isolation
- Mock external dependencies
- Use Jest utilities: `describe()`, `it()`, `beforeEach(), `expect()`

### E2E Tests (`.e2e-spec.ts`)
- Test complete request/response flow
- Use NestJS Testing Module with full ApplicationContext
- Import the actual module being tested

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

### Pull Request Title & Description

When asked to generate a pull request title or description, **analyze git context** to ensure accuracy:

```bash
# Get current branch name
git branch --show-current

# View commits on this branch (not on main/master)
git log main..HEAD --oneline

# View full commit details for context
git log main..HEAD --format="%B"

# Compare changes with main/master
git diff main... --stat
```

**Important**: Use the branch name and commit history as context, not just current session information. This ensures the PR title/description accurately reflects what was actually implemented in the branch.

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

1. **Create Feature Module**:
   ```typescript
   // src/features/user/user.module.ts
   import { Module } from '@nestjs/common';
   import { UserController } from './user.controller';
   import { UserService } from './user.service';

   @Module({
     controllers: [UserController],
     providers: [UserService],
     exports: [UserService],
   })
   export class UserModule {}
   ```

2. **Create Controller**:
   ```typescript
   // src/features/user/user.controller.ts
   import { Controller, Get, Param } from '@nestjs/common';
   import { UserService } from './user.service';

   @Controller('users')
   export class UserController {
     constructor(private readonly userService: UserService) {}

     @Get(':id')
     async getUser(@Param('id') id: string) {
       return this.userService.findById(id);
     }
   }
   ```

3. **Create Service**:
   ```typescript
   // src/features/user/user.service.ts
   import { Injectable } from '@nestjs/common';

   @Injectable()
   export class UserService {
     async findById(id: string) {
       // Business logic here
       return { id, name: 'Example' };
     }
   }
   ```

4. **Register in AppModule**:
   ```typescript
   import { UserModule } from './features/user/user.module';

   @Module({
     imports: [UserModule],
   })
   export class AppModule {}
   ```

### Error Handling
```typescript
import { HttpException, HttpStatus } from '@nestjs/common';

throw new HttpException(
  { message: 'User not found', statusCode: 404 },
  HttpStatus.NOT_FOUND,
);
```

### Input Validation (class-validator + class-transformer)
```typescript
import { IsString, IsEmail, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;
}

// In controller:
@Post()
async create(@Body() createUserDto: CreateUserDto) {
  // NestJS validates automatically via ValidationPipe
}
```

### Custom Decorators
```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

// Usage:
@Get('profile')
async getProfile(@CurrentUser() user: UserPayload) { }
```

## Build & Deployment

### Local Development
```bash
npm run dev        # Hot reload on port 5001
npm run build      # Compile to dist/
npm run lint       # Check code quality
npm run format     # Auto-format code
```

### Firebase Deployment
```bash
npm run deploy     # Deploy to Firebase (prod alias)
npm run serve      # Local Firebase emulator
npm run logs       # View Firebase Function logs
```

### Build Output
- TypeScript compiles to `dist/` directory
- Only production code, no tests or configs
- Entry point: `dist/main.js` (the Firebase Function)

## Important Notes for Code Generation

1. **Always use TypeScript strict mode** - Enable all strict checks
2. **Return explicit types** - Never use implicit `any` returns on controller methods
3. **Use dependency injection** - Never instantiate services with `new`, inject them
4. **Handle async/await properly** - Controllers and services are async
5. **Env configuration** - Always use `Env` class for environment variables, don't use `process.env` directly
6. **Firebase caching** - The app instance is cached in `main.ts` - don't recreate it
7. **CORS aware** - Respect the `CORS_ORIGIN` configuration
8. **Error responses** - Use NestJS `HttpException` for consistent error handling
9. **Test isolation** - Each test should be independent and not rely on test order
10. **No console.log in production** - Use proper NestJS logger or structured logging

## Related Configuration Files
- `tsconfig.json` - TypeScript configuration (strict mode enabled)
- `jest.config.js` (in package.json) - Jest testing configuration
- `eslint.config.mjs` - ESLint rules and formatter settings
- `.firebaserc` - Firebase project configuration
- `firebase.json` - Firebase deployment configuration
- `nest-cli.json` - NestJS CLI configuration
