# Contributing to NestJS Firebase Functions Template

Thank you for your interest in contributing! 🎉

## How to Contribute

### Reporting Issues

- Check if the issue already exists
- Provide clear steps to reproduce
- Include relevant logs and error messages
- Specify your environment (Node version, OS, etc.)

### Submitting Pull Requests

1. Fork the repository
2. Create a feature branch following naming conventions (see below)
3. Make your changes
4. Run tests (`npm test`)
5. Run linter (`npm run lint`)
6. Format code (`npm run format`)
7. Commit your changes using conventional commits (see below)
8. Push to the branch
9. Open a Pull Request

#### Branch Naming Conventions

Use descriptive branch names with the following prefixes:

- `feat/` or `feature/` - New features
- `fix/` - Bug fixes
- `chore/` - Maintenance tasks
- `refactor/` - Code refactoring
- `style/` - Code style changes
- `ci/` - CI/CD changes
- `test/` - Test additions or changes
- `docs/` - Documentation updates
- `hotfix/` - Production hotfixes

**Examples**:
- `feat/add-user-authentication`
- `fix/cors-configuration`
- `chore/update-dependencies`
- `docs/improve-readme`

#### Git Workflow

This template follows a **Git Flow** approach:

- **`master`** - Production-ready code (auto-deploys to Firebase)
- **`develop`** - Integration branch for features
- **Feature branches** - Created from `develop`, merged back to `develop`
- **Hotfix branches** - Created from `master`, merged to both `master` and `develop`

**Pull Request Rules** (enforced by GitHub Actions):

To `master`:
- ✅ Only from `develop` (for releases)
- ✅ Only from `hotfix/*` (for urgent fixes)

To `develop`:
- ✅ From feature branches (`feat/*`, `fix/*`, `chore/*`, etc.)
- ✅ From `master` (for back-merges)

#### Commit Message Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>: <description>

[optional body]

[optional footer(s)]
```

**Types**:
- `feat` - New feature
- `fix` - Bug fix
- `chore` - Maintenance tasks
- `docs` - Documentation
- `style` - Code formatting
- `refactor` - Code restructuring
- `test` - Test changes
- `ci` - CI/CD changes

**Examples**:
```bash
feat: add user authentication endpoint
fix: resolve CORS configuration issue
chore: update dependencies to latest versions
docs: improve installation instructions
ci: add branch enforcement workflow
```

**Important**: Do NOT add scopes between type and colon (e.g., ~~`feat(users):`~~)

### Code Style

- Follow existing code style
- Use TypeScript strict mode
- Add tests for new features
- Document public APIs
- Keep commits atomic and well-described

### Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

### Development Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run start:dev

# Run tests
npm test
```

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow

## Questions?

Feel free to open an issue for any questions or discussions!
