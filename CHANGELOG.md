# Changelog

All notable changes to this template will be documented in this file.

## [1.0.0] - 2026-02-15

### Initial Release

#### Features
- ✅ NestJS 11 with Express adapter
- ✅ Firebase Cloud Functions v2 deployment with `onRequest`
- ✅ TypeScript with strict configuration
- ✅ Centralized environment configuration with type-safe `Env` class
- ✅ CORS support with flexible configuration
- ✅ Jest testing framework (unit + e2e tests)
- ✅ ESLint + Prettier for code quality
- ✅ Hot reload development mode
- ✅ Clean build output (dist/ without test files)
- ✅ GitHub Actions CI/CD workflows
- ✅ Comprehensive documentation

#### Structure
- `src/config/` - Centralized configuration layer
- `src/` - Application source code
- `test/` - Unit and e2e tests
- `dist/` - Compiled output (production-ready)

#### Scripts
- `npm run start:dev` - Development with hot reload
- `npm test` - Run all tests
- `npm run build` - Compile to JavaScript
- `npm run serve` - Firebase emulators
- `npm run deploy` - Deploy to Firebase
- `npm run lint` - ESLint
- `npm run format` - Prettier

#### Documentation
- `README.md` - Complete usage guide
- `TEMPLATE_SETUP.md` - Initial setup instructions
- `CONTRIBUTING.md` - Contribution guidelines
- `LICENSE` - MIT License

#### Dependencies
- @nestjs/common: ^11.0.1
- @nestjs/core: ^11.0.1
- @nestjs/platform-express: ^11.0.1
- express: ^4.22.1
- firebase-admin: ^13.6.1
- firebase-functions: ^7.0.5
- TypeScript: ^5.7.3
- Jest: ^30.0.0

---

## Template Guidelines

### Versioning
This template follows [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

### Changelog Format
- Added: New features
- Changed: Changes in existing functionality
- Deprecated: Soon-to-be removed features
- Removed: Removed features
- Fixed: Bug fixes
- Security: Security fixes
