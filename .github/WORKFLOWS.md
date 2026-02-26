# GitHub Actions Workflows

This document describes the CI/CD workflow improvements implemented according to industry best practices.

## 📋 Workflows Overview

The project uses three main workflows to ensure code quality, reliability, and security:

1. **Branch Validation** - Enforces branch naming conventions
2. **CI** - Runs linting, type-checking, tests and build
3. **Deploy** - Performs deployment to Firebase Functions in production

---

## 1️⃣ Branch Validation (`branch-enforcer.yml`)

### 📝 Objective
Enforce branch naming conventions and merge rules to maintain the integrity of the Git Flow strategy.

### ✨ Implemented Improvements

#### Security
- `permissions`: Defined with minimum necessary read (`contents: read`, `statuses: write`, `pull-requests: read`)
- `set -euo pipefail`: Ensures error if any command fails or variable is undefined

#### Observability
- Structured messages with `::error::`, `::notice::` for better visibility in GitHub UI
- Clear information about allowed vs received branches
- 5-minute timeout to prevent stuck jobs

#### Branch Rules

**For production branches (`main` or `master`):**
- ✅ PRs only from `develop` or `hotfix/*`
- ❌ Rejects direct branches or other types
- ✅ All changes must be via Pull Request with approval

**For `develop`**:
- ✅ `feat/*`, `feature/*`, `fix/*`, `chore/*`, `refactor/*`, `style/*`, `ci/*`, `test/*`, `docs/*`, `hotfix/*`
- ✅ Back-merges from `main` or `master` allowed
- ❌ Rejects random branches

---

## 2️⃣ Continuous Integration (`ci.yml`)

### 📝 Objective
Validate code in pull requests and push to `develop` branch with multiple parallel checks.

### ✨ Implemented Improvements

#### Security & Permissions
- Granular permissions: `contents: read`, `statuses: write`, `checks: write`, `pull-requests: write`
- No `write` permission on source code (read-only)

#### Concurrency & Performance
- `concurrency` configured to cancel previous runs on the same branch
- `npm` cache shared between jobs
- `--prefer-offline` in `npm ci` for better performance
- Timeouts defined for each job (10-15 min)

#### Parallel Jobs

**1. Lint** (10 min)
```yaml
- npm run lint      # ESLint + Prettier
- Fails fast if there are formatting/style errors
```

**2. Type-Check** (10 min) - **NEW**
```yaml
- npx tsc --noEmit  # Compile without generating files
- Detects type errors before tests/build
```

**3. Test** (15 min)
```yaml
- npm run test:coverage   # Jest with coverage
- Codecov integration      # Coverage upload
- Artifact preservation   # Report for 7 days
```

**4. Build** (15 min) - Depends on [lint, type-check, test]
```yaml
- npm run build
- Validates that dist/main.js was created
- Upload artifacts for 7 days
```

#### Coverage & Artifacts
- **Codecov** integration to track coverage over time
- Coverage reports preserved for 7 days for debugging
- Build artifacts stored for reuse in deploy

#### Observability
- Structured outputs (::error::, ::notice::)
- Build output verification (dist/main.js mandatory)
- Always-run artifacts for debugging on failures

---

## 3️⃣ Deploy to Production (`deploy.yml`)

### 📝 Objective
Secure and validated deployment only to production branches (`main` or `master`) with multiple layers of protection.

### ✨ Implemented Improvements

#### Security & Credentials
- Temporary files with restricted permissions (`chmod 600`)
- Credentials stored in `${{ runner.temp }}/secrets/`
- JSON validation before using Firebase key
- No secret exposure in logs
- `GOOGLE_APPLICATION_CREDENTIALS` only during deploy

#### Deployment Control

**Concurrency**
- `cancel-in-progress: false` → Does not cancel ongoing deploys
- Prevents conflicts and ensures sequential deploys

**Separate Validation** (Job: `validate`)
- Runs complete CI pipeline (lint + type-check + tests + build)
- Fails early if any validation fails
- Outputs `should-deploy` to condition deploy job

**Environment Protection**
```yaml
environment:
  name: production
  url: https://firebase.google.com/...
```
- Enables manual approval if configured in GitHub Settings
- Audit trail of who did the deployment

#### Deployment Flow

1. **Validate** (15 min)
   - TypeScript compilation
   - Linting
   - Tests with coverage
   - Build verification

2. **Deploy** (20 min) - Conditional on Validate success
   - Credentials preparation with validation
   - Environment variables preparation
   - Firebase config verification
   - Deploy with `--force --non-interactive`
   - Post-deploy verification

3. **Notify** (5 min) - Always runs
   - Final deployment status
   - Success/failure summary

#### Credentials Preparation
```yaml
# Isolated directory with restricted permissions
mkdir -p "${{ runner.temp }}/secrets"
echo '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}' > "${{ runner.temp }}/secrets/gcp-key.json"
chmod 600 "${{ runner.temp }}/secrets/gcp-key.json"

# JSON validation before using
python3 -m json.tool "${{ runner.temp }}/secrets/gcp-key.json" > /dev/null
```

#### Required Secrets

| Secret | Description |
|--------|-----------|
| `FIREBASE_SERVICE_ACCOUNT` | Firebase JWT key (JSON) |
| `FIREBASE_CI_TOKEN` | Firebase CLI CI token |
| `FIREBASE_ENV_PROD` | Complete `.env.prod` file |

#### Required Variables

| Variable | Description |
|----------|-----------|
| `FIREBASE_PROJECT_ID` | Firebase project ID |

---

## 🔒 Security Checklist

- ✅ Granular permissions (principle of least privilege)
- ✅ Secrets isolated in temporary directories
- ✅ Credential validation before using
- ✅ No commit of sensitive files
- ✅ Credentials automatically removed after runner
- ✅ Timeouts on all jobs
- ✅ Fast fail with validations
- ✅ Deployment conditional on CI passing
- ✅ Environment protection for production

---

## 📊 Workflow Triggers

### Branch Validation
```yaml
on:
  pull_request:
```
- Runs on PRs to any branch, with job-level gating for production branches (`main`/`master`) or `develop`

### CI
```yaml
on:
  pull_request:
  push:
    branches: [develop]
```
- PRs on any branch, with job-level gating for production branches (`main`/`master`) or `develop`
- Direct push to `develop` (after merge)

### Deploy
```yaml
on:
  push:
    branches: ['**']
```
- Only pushes to production branches (`main` or `master`) proceed, enforced via job-level condition

---

## 🚀 How to Use

### 1. Initial Setup

Add the following secrets to GitHub (Settings → Secrets and variables → Actions):

```bash
# Firebase service account (JSON)
FIREBASE_SERVICE_ACCOUNT = {...}

# Firebase CLI token
FIREBASE_CI_TOKEN = <token>

# Production environment
FIREBASE_ENV_PROD = NODE_ENV=production\nPORT=5001\n...
```

Add the following variables:

```bash
# Firebase project ID
FIREBASE_PROJECT_ID = my-firebase-project
```

### 2. Development Workflow

```bash
# Create feature branch
git checkout -b feat/my-feature develop

# Develop and commit
git add .
git commit -m "feat: feature description"

# Push
git push origin feat/my-feature

# PR to develop
# GitHub Actions will run: Branch Validation, CI (lint, type-check, test, build)
# After merge to develop: CI will run again

# PR to production branches (main or master) (via develop or hotfix)
# Only if it came from develop or hotfix/*
# After merge to production branch: Deploy to production
```

### 3. Monitoring

- **Actions Tab**: See detailed logs of each workflow
- **Codecov**: Track coverage over time
- **Deployments**: See deployment history to production

---

## 🐛 Troubleshooting

### Build fails with "dist/main.js not found"
```bash
# Verify that package.json has:
npm run build
# Should compile TypeScript to dist/

# Verify tsconfig.json:
{
  "compilerOptions": {
    "outDir": "./dist",
    ...
  }
}
```

### Firebase Deploy fails
1. Verify that `FIREBASE_SERVICE_ACCOUNT` is valid JSON
2. Check that `FIREBASE_CI_TOKEN` is current
3. Verify `FIREBASE_PROJECT_ID` is correct
4. See logs in: GitHub Actions UI → Deploy job

### Coverage upload fails
- Codecov Integration is `fail_ci_if_error: false` (does not block deploy)
- See details at: https://codecov.io

---

## 📚 References

- [GitHub Actions Security](https://docs.github.com/en/actions/security-for-github-actions)
- [Best Practices for Secrets](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments)
- [Firebase CLI Documentation](https://firebase.google.com/docs/cli)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Flow Workflow](https://nvie.com/posts/a-successful-git-branching-model/)
