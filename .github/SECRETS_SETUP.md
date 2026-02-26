# 🔐 GitHub Actions Secrets & Variables Setup

This document explains how to configure the necessary secrets and variables for the workflows to work correctly.

## 📍 Location on GitHub

```
Repository → Settings → Secrets and variables → Actions
```

---

## 🔑 Secrets (Sensitive Information)

### 1. `FIREBASE_SERVICE_ACCOUNT`

**What is it?** Firebase private key JSON for deployment authentication.

**How to obtain?**
```bash
# Via Firebase Console
1. Access https://console.firebase.google.com/project/YOUR_PROJECT/settings/serviceaccounts/adminsdk
2. Click "Generate New Private Key"
3. Save the JSON file
4. Copy ALL the JSON content
```

**Example content:**
```json
{
  "type": "service_account",
  "project_id": "your-project-1234",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-abc@your-project.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-abc%40your-project.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
}
```

**On GitHub:**
1. Settings → Secrets and variables → Actions
2. New repository secret
3. Name: `FIREBASE_SERVICE_ACCOUNT`
4. Value: Paste ALL of the JSON (multi-line is OK)
5. Add secret

⚠️ **NEVER** commit this file!

---

### 2. `FIREBASE_CI_TOKEN`

**What is it?** Authentication token for Firebase CLI (alternative to private key).

**How to obtain?**
```bash
# Via Firebase CLI
firebase login:ci

# Or via Google Cloud
gcloud auth application-default print-access-token
```

**Process:**
```bash
# In your local terminal
firebase login:ci

# You will be directed to sign in on the browser
# A token will be generated and displayed
# Copy the full token
```

**On GitHub:**
1. Settings → Secrets and variables → Actions
2. New repository secret
3. Name: `FIREBASE_CI_TOKEN`
4. Value: Paste the token
5. Add secret

**Example token:**
```
ya29.a0AfH6SMBj...ZpjMq2KL...
```

💡 **Tip:** This token expires, you may need to regenerate it periodically.

---

### 3. `FIREBASE_ENV_PROD`

**What is it?** `.env.prod` file with production environment variables.

**Expected content:**
```
NODE_ENV=production
PORT=5001
CORS_ORIGIN=https://your-domain.com
LOG_LEVEL=info
```

**How to create:**
```bash
# Create a .env.prod file with your variables
cat > .env.prod << 'EOF'
NODE_ENV=production
PORT=5001
CORS_ORIGIN=https://your-domain.com
LOG_LEVEL=info
EOF

# Copy the content
cat .env.prod
```

**On GitHub:**
1. Settings → Secrets and variables → Actions
2. New repository secret
3. Name: `FIREBASE_ENV_PROD`
4. Value: Paste the multi-line content
5. Add secret

⚠️ **NEVER** commit `.env.prod` in the repo!

---

## 📋 Variables (Public Information)

### 1. `FIREBASE_PROJECT_ID`

**What is it?** Public ID of your Firebase project.

**How to obtain?**
```bash
# Via Firebase Console
https://console.firebase.google.com/project/YOUR_PROJECT_ID/overview

# ID is visible in:
# - Browser URL
# - Project settings

# Via Firebase CLI
firebase projects:list
```

**Example:**
```
your-project-1234
my-app-firebase-abc123
```

**On GitHub:**
1. Settings → Secrets and variables → Actions
2. Variables (different tab from Secrets!)
3. New repository variable
4. Name: `FIREBASE_PROJECT_ID`
5. Value: `your-project-1234`
6. Add variable

---

## ✅ Configuration Checklist

```bash
# 1. Generate Firebase key
[ ] FIREBASE_SERVICE_ACCOUNT - JSON key from Firebase
    - File: .github/secrets/.example (do not commit real JSON!)

# 2. Generate CI token
[ ] FIREBASE_CI_TOKEN - Firebase CLI token
    - firebase login:ci

# 3. Prepare production env
[ ] FIREBASE_ENV_PROD - Variables from .env.prod
    - NODE_ENV=production
    - PORT=5001
    - CORS_ORIGIN=...

# 4. Configure project ID
[ ] FIREBASE_PROJECT_ID - Project ID
    - Visible in Firebase Console

# 5. Test workflows
[ ] Create PR to develop → Branch Validation + CI
[ ] Merge to develop → CI again
[ ] Merge to master (via PR) → Automatic deploy
```

---

## 🧪 Validating Secrets Locally

### Test Firebase Key
```bash
# Install gcloud if you don't have it
gcloud auth activate-service-account --key-file=/path/to/gcp-key.json

# Test access
gcloud projects describe YOUR_PROJECT_ID
```

### Test Firebase Token
```bash
# Install firebase-tools if you don't have it
npm install -g firebase-tools

# Use the token
FIREBASE_TOKEN=your_token firebase deploy --only functions --dry-run
```

### Test Environment Variables
```bash
# Create a .env.prod.test file
NODE_ENV=production PORT=5001

# Validate that it can be parsed
node -e "require('dotenv').config({ path: '.env.prod.test' }); console.log(process.env)"
```

---

## 🔒 Security Best Practices

### ✅ Do
- ✅ Regenerate tokens routinely (every 3-6 months)
- ✅ Use separate secrets for dev, staging, prod
- ✅ Audit access to secrets (Settings → Secrets → View access)
- ✅ Archive old tokens in safe location (backup)
- ✅ Rotate credentials if you suspect exposure

### ❌ Don't
- ❌ NEVER commit secrets in the repo (`.env.prod`, JSON keys)
- ❌ NEVER put secrets in comments or issues
- ❌ NEVER share tokens via Slack/Teams/Email
- ❌ NEVER commit `.env.*` files
- ❌ NEVER use secrets in public workflows without protection

### 🔐 `.gitignore` File (Make sure)
```
# Environment variables
.env
.env.*.local
.env.prod
.env.dev
.env.test

# Firebase keys
**/gcp-key.json
**/*-key.json
credentials.json
service-account*.json

# IDE secrets
.idea/**/*.xml
.vscode/settings.json
```

---

## 🚨 If You Suspect Exposure

**If a secret was accidentally committed:**

1. **Revoke immediately:**
   ```bash
   # Firebase
   firebase use prod
   firebase deploy --only functions
   
   # Gcloud
   gcloud iam service-accounts keys delete <KEY_ID>
   ```

2. **Delete from GitHub:**
   ```bash
   # Remove from history (git-filter-repo)
   git filter-repo --path gcp-key.json --invert-paths
   git push origin --force-with-lease
   ```

3. **Regenerate secrets:**
   - Create new key in Firebase Console
   - Update `FIREBASE_SERVICE_ACCOUNT`
   - Create new token: `firebase login:ci`
   - Update `FIREBASE_CI_TOKEN`

4. **Audit logs:**
   - GitHub Settings → Audit log
   - Firebase Security Center

---

## 📖 View Configured Secrets

```bash
# Via GitHub CLI (installed?)
gh secret list

# Example output:
# FIREBASE_CI_TOKEN
# FIREBASE_ENV_PROD
# FIREBASE_SERVICE_ACCOUNT

# To check values (will ask for confirmation)
gh secret view FIREBASE_PROJECT_ID
```

---

## 🔗 Useful References

- [Firebase Service Accounts](https://firebase.google.com/docs/admin/setup)
- [Firebase CLI Authentication](https://firebase.google.com/docs/cli#sign-in-non-interactively)
- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-for-github-actions/encrypted-secrets)
- [Google Cloud Service Accounts](https://cloud.google.com/iam/docs/service-accounts)

---

## 💬 Troubleshooting

### "Invalid service account JSON"
```
Solution: Copy ALL of the JSON file, not just parts
Check: Starts with { and ends with }
```

### "Authentication failed"
```
Solution: Token expired, regenerate with: firebase login:ci
Every 1-2 years tokens expire
```

### "Project not found"
```
Solution: Verify FIREBASE_PROJECT_ID is correct
Correct: your-project-1234 (not URL)
```

### "Deploy blocked by permissions"
```
Solution: Verify service account has roles:
- roles/firebase.admin
- roles/firebase.serviceAgent
```

---

## 📞 Support

For questions about:
- **Workflows**: See `.github/WORKFLOWS.md`
- **Security**: See `.github/IMPROVEMENTS.md`
- **Firebase**: [Firebase Documentation](https://firebase.google.com/docs)
- **GitHub Actions**: [GitHub Actions Docs](https://docs.github.com/en/actions)
