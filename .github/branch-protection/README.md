# 🔒 Branch Protection Rules

This directory contains the definitions of **Branch Protection Rules** that must be applied to the GitHub repository to ensure security, code quality and compliance with the development workflow.

**Note:** GitHub Actions triggers are configured broadly; job execution is gated by base branch checks (default branch or `develop`). This keeps status check names stable without hard-coding the default branch name.

## 📋 Files

- **[develop.json](develop.json)** - Rules for `develop` branch
- **[default-branch.json](default-branch.json)** - Rules for the default branch (production)

---

## 🎯 Overview of Rules

### 👉 Branch `develop`

**Purpose:** Feature development & integration branch

| Rule | Status | Description |
|------|--------|-----------|
| Prevent deletion | ✅ Active | Prevents accidental deletion |
| Prevent force push | ✅ Active | Keeps history linearized |
| Prevent direct creation | ✅ Active | Forces PRs with named branches |
| Require PR | ✅ Active | All changes via PR |
| CI Checks | ✅ Active | lint, type-check, test, build |
| Code Review | ⚠️ Optional | 0 approvals by default |

**Required Status Checks:**
```
✓ Branch Validation / check-source-branch-develop
✓ CI / lint
✓ CI / type-check    (new on 2026-02-26)
✓ CI / test
✓ CI / build
```

### 👉 Default branch (production)

**Purpose:** Production release branch (default branch)

| Rule | Status | Description |
|------|--------|-----------|
| Prevent force push | ✅ Active | Keeps release history |
| Require PR | ✅ Active | All changes via PR |
| **Min 1 Review** | ✅ Active | **Requires approval** |
| Dismiss stale reviews | ✅ Active | Obsolete reviews don't count |
| Resolve discussions | ✅ Active | **All comments must be resolved** |
| Strict status | ✅ Active | Rebase requires new CI pass |
| Creation block | ✅ Active | Cannot create branch from the default branch |
| Deletion block | ✅ Active | Cannot delete the default branch |
| CI Checks | ✅ Active | lint, type-check, test, build |

**Required Status Checks:**
```
✓ Branch Validation / check-source-branch-default
✓ CI / lint
✓ CI / type-check    (new on 2026-02-26)
✓ CI / test
✓ CI / build
```

---

## 🚀 How to Apply the Rules

### Option 1: Web Interface (Recommended for Initial Setup)

#### Step 1: Open Repository Settings
```
GitHub → Your repository → Settings → Branches
```

#### Step 2: Add Rule for `develop`
1. Click "Add rule"
2. Pattern: `develop`
3. Configure each section according to [develop.json](develop.json):

**Protect matching branches:**
- ✅ Require a pull request before merging
- ✅ Require status checks to pass
  - ✓ require branches to be up to date (strict mode)
  - ✓ Select status checks:
    - Branch Validation / check-source-branch-develop
    - CI / lint
    - CI / type-check
    - CI / test
    - CI / build
- ✅ Dismiss pull request reviews when new commits are pushed
- ✅ Restrict who can push to matching branches

**Other restrictions:**
- ✅ Allow force pushes: **None**
- ✅ Allow deletions: **None**
- ✅ Require signed commits: Optional

4. **Save changes**

#### Step 3: Add Rule for the default branch
1. Click "Add rule"
2. Pattern: `~DEFAULT_BRANCH`
3. Configure each section according to [default-branch.json](default-branch.json):

**Protect matching branches:**
- ✅ Require a pull request before merging
  - **1 or more** reviewers
  - ✅ Require review from Code Owners (optional)
  - ✅ Require approval of the most recent reviewers
  - ✅ Require status checks to pass
    - ✓ **require branches to be up to date (strict mode)**
    - ✓ Select status checks:
      - Branch Validation / check-source-branch-default
      - CI / lint
      - CI / type-check
      - CI / test
      - CI / build
  - ✅ Dismiss stale pull request approvals when new commits are pushed
  - ✅ Require status checks to pass before merging (strict)
  - ✅ Require conversation resolution before merging
  - ✅ Restrict who can push to matching branches

**Other restrictions:**
- ✅ Allow force pushes: **None**
- ✅ Allow deletions: **None**

4. **Save changes**

---

### Option 2: GitHub CLI

#### Installation
```bash
# macOS
brew install gh

# Linux (apt)
sudo apt install gh

# Other systems
# https://github.com/cli/cli#installation
```

#### Authentication
```bash
gh auth login

# Follow the interactive instructions
```

#### Apply the Rules

**For `develop`:**
```bash
gh api -H "X-GitHub-Api-Version:2022-11-28" \
  repos/YOUR_OWNER/YOUR_REPO/rules \
  -F name="develop" \
  -F target="branch" \
  -f conditions='{"ref_name":{"include":["refs/heads/develop"]}}' \
  -f enforcement="active" \
  --input develop.json
```

**For the default branch:**
```bash
gh api -H "X-GitHub-Api-Version:2022-11-28" \
  repos/YOUR_OWNER/YOUR_REPO/rules \
  -F name="default-branch" \
  -F target="branch" \
  -f conditions='{"ref_name":{"include":["~DEFAULT_BRANCH"]}}' \
  -f enforcement="active" \
  --input default-branch.json
```

---

## 🔐 Verify Applied Rules

### Via GitHub Web
```
Settings → Branches → See rules listed
```

### Via GitHub CLI
```bash
# List all rules
gh api repos/YOUR_OWNER/YOUR_REPO/rules --paginate

# See specific rule
gh api repos/YOUR_OWNER/YOUR_REPO/rules/13272495

# See rules on specific branch
gh api repos/YOUR_OWNER/YOUR_REPO/rules \
  -f ref_name=refs/heads/develop
```

### Via cURL
```bash
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/YOUR_OWNER/YOUR_REPO/rules

# Pretty print
curl -s -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/YOUR_OWNER/YOUR_REPO/rules | jq .
```

---

## 🧪 Test the Rules

### Test 1: Branch Naming (develop)
```bash
# Try creating PR with invalid name
git checkout -b invalid-name develop
git push origin invalid-name

# Expected result: ❌ Branch Validation fails
```

### Test 2: CI Checks (develop)
```bash
# Create PR and break a test
git checkout -b feat/test-ci develop
echo "invalid code" >> src/main.ts
git push origin feat/test-ci

# Expected result: ❌ CI fails
```

### Test 3: Forced Push (default branch)
```bash
# Try to force push
git push --force origin DEFAULT_BRANCH

# Expected result: ❌ Access denied
```

### Test 4: Deletion (default branch)
```bash
# Try to delete the default branch
git push origin --delete DEFAULT_BRANCH

# Expected result: ❌ Access denied
```

---

## 📊 Structure of JSONs

### Main Fields

```json
{
  "id": 13272495,                    // Unique rule ID (auto)
  "name": "develop",                 // Rule name
  "description": "...",              // Human-readable description
  "target": "branch",                // Target type
  "enforcement": "active",           // Status: active|evaluate
  
  "conditions": {
    "ref_name": {
      "include": ["refs/heads/develop"],
      "exclude": []
    }
  },
  
  "rules": [
    {
      "type": "deletion",            // Rule type
      "description": "..."           // Description
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          {
            "context": "CI / lint",
            "integration_id": 15368,
            "description": "..."
          }
        ]
      }
    }
  ],
  
  "bypass_actors": []               // Exceptions (can admins bypass?)
}
```

### Rule Types

| Type | Description |
|------|-----------|
| `deletion` | Prevents branch deletion |
| `non_fast_forward` | Prevents force push |
| `creation` | Prevents direct branch creation |
| `pull_request` | Requires PR for changes |
| `required_status_checks` | Requires CI/CD checks to pass |
| `update` | Restricts direct updates |

---

## ⚙️ Sync with Workflows

The rules reference these status checks from workflows:

| Workflow | Job | Status Check |
|----------|-----|--------------|
| branch-enforcer.yml | check-source-branch-develop | Branch Validation / check-source-branch-develop |
| branch-enforcer.yml | check-source-branch-default | Branch Validation / check-source-branch-default |
| ci.yml | lint | CI / lint |
| ci.yml | type-check | CI / type-check |
| ci.yml | test | CI / test |
| ci.yml | build | CI / build |

**Important:** The job names in the YAML must match the `context` in the JSONs!

---

## 🆘 Troubleshooting

### "Required status check not found"
```
Problem: The workflow job doesn't exist or has a different name
Solution: Verify the job was created and the name matches exactly
```

### "Cannot merge - missing required reviews"
```
Problem: Missing approvals
Solution: Add an approval via GitHub UI before merging
```

### "Base branch is out of date"
```
Problem: Strict mode requires rebase
Solution: git rebase DEFAULT_BRANCH develop && git push
```

### "Rule creation failed"
```
Problem: Invalid JSON or insufficient permissions
Solution: Check:
  - Token has repo:status scope
  - JSON syntax is valid (use jq to validate)
  - Repo belongs to your user/org
```

---

## 📚 References

- [GitHub Branch Protection API](https://docs.github.com/en/rest/repos/rules)
- [Branch Protection Settings](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches)
- [Required Status Checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-a-branch-protection-rule/managing-required-status-checks)
- [GitHub CLI Docs](https://cli.github.com/manual)

---

## 📝 Changelog

| Date | Version | Change |
|------|--------|---------|
| 2026-02-26 | 1.0 | Initial creation with type-check support |
| 2026-02-26 | 1.1 | Added default-branch.json with review requirements |
