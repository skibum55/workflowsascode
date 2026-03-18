# n8n Workflow Promotion Pipeline

A secure, PR-driven CI/CD system for promoting n8n workflows from development to production using Git as the single source of truth. This pipeline enforces validation, peer review, and idempotent deployments while abstracting instance-specific IDs and credentials.

---

## 📁 Repository Structure
```
.
├── .github/
│   ├── workflows/
│   │   └── n8n-promotion.yml          # CI/CD pipeline definition
│   └── PULL_REQUEST_TEMPLATE/
│       └── n8n-promotion.md           # Standardized PR template
├── scripts/
│   ├── validate-workflows.js          # Pre-merge schema & policy checks
│   └── deploy-workflows.js            # Post-merge idempotent deployment
├── workflows/                         # Version-controlled workflow JSONs
│   ├── nexuspostmsgtest.json
│   └── nexuspostmsgtestauth.json
├── mapping.yaml                       # Registry mapping names → files → dev IDs
├── package.json                       # Node.js dependencies
└── README.md                          # This document
```

---

## ⚙️ Initial Setup

### 1. GitHub Configuration
| Setting | Value | Notes |
|---------|-------|-------|
| **Branches** | `develop` (active sync), `production` (promotion target) | Keep `production` clean; never commit directly |
| **Secrets** | `N8N_PROD_API_KEY` | Production n8n API key (Settings → Secrets → Actions) |
| **Variables** | `N8N_PROD_URL` | e.g., `https://prod-n8n.yourcompany.com` (Settings → Variables → Actions) |
| **Environment** | `production` | Enable `Required reviewers` + optional wait timer |
| **Branch Protection** (`production`) | Require PR, 1+ reviewer, `validate` check, block force pushes | Settings → Branches → Add rule |

### 2. Local Setup
```bash
npm install
git checkout develop
# Ensure workflows/ and mapping.yaml are synced from your dev instance
```

---

## 🔄 Promotion Process

1. **Develop & Sync**  
   Workflows are pulled into `workflows/` on the `develop` branch. `mapping.yaml` tracks dev instance IDs.

2. **Prepare Promotion**  
   - Update `mapping.yaml` with `active: true/false` per workflow
   - Commit changes to `develop`

3. **Open PR**  
   Create a PR from `develop` → `production`. GitHub auto-applies the `n8n-promotion.md` template.

4. **Automated Validation**  
   The `validate` job runs automatically:
   - YAML/JSON syntax & structure
   - n8n schema compliance
   - Credential reference warnings
   - Activation policy verification
   - *Blocks merge if any check fails*

5. **Peer Review**  
   Reviewers verify logic, credential readiness, activation intent, and rollback feasibility using the PR checklist.

6. **Merge & Deploy**  
   - Approved PR is merged into `production`
   - `deploy` job triggers automatically
   - Only changed workflows are pushed to prod
   - IDs resolved by `name`; instance fields stripped
   - Activation state applied per `mapping.yaml`

7. **Verify**  
   Check prod n8n UI or execution logs. Deployment status appears in GitHub PR + Deployments tab.

---

## 📖 Usage Guidelines

### Adding a New Workflow
1. Sync workflow JSON to `workflows/` on `develop`
2. Add entry to `mapping.yaml`:
   ```yaml
   - name: MyNewWorkflow
     source_id: <dev-instance-id>
     file: mynewworkflow.json
     active: false
   ```
3. Commit, open PR, follow promotion process

### Updating an Existing Workflow
1. Modify JSON in `workflows/` on `develop`
2. Commit & open PR
3. Pipeline detects diff → updates existing prod workflow by name

### Controlling Activation
- Default: `active: false` (safety-first)
- Override per workflow in `mapping.yaml`
- Activation is applied **after** successful deployment

### Handling Credentials
- Credentials are **never** stored in Git
- Reference credential names in workflow JSONs
- Ensure matching credentials exist in prod n8n before merge
- Validation step warns if credentials are referenced

### Rollback Procedure
```bash
git revert <merge-commit-sha>
git push origin develop
# Open PR to production → merge → auto-deploys previous state
```

---

## 🔧 Configuration Reference

### `mapping.yaml` Schema
```yaml
source_instance: https://oauth2test.manageddeployment.com
last_sync: '2026-03-17T23:19:12.977Z'
workflows:
  - name: string          # Human-readable name (used for prod ID resolution)
    source_id: string     # Dev instance ID (ignored in prod)
    file: string          # Path relative to workflows/
    active: boolean       # Optional. Default: false
```

### Environment Variables & Secrets
| Name | Type | Purpose |
|------|------|---------|
| `N8N_PROD_URL` | Variable | Base URL of production n8n instance |
| `N8N_PROD_API_KEY` | Secret | API key with workflow read/write permissions |
| `GITHUB_SHA` / `GITHUB_BEFORE` | Auto | Used for diff detection (no action needed) |

---

## 🛡️ Compliance & Audit

| Requirement | Implementation |
|-------------|----------------|
| Change Control | All prod changes require PR + approval |
| Audit Trail | PR history + GitHub Checks + Deployments tab + commit log |
| Credential Security | Never versioned; validated against allowlist |
| Idempotency | Instance fields stripped; updates by name; safe re-runs |
| Rollback Capability | Git-native revert triggers automated rollback deployment |
| Environment Isolation | `production` environment gates + separate secrets |

---

## 🚨 Troubleshooting

| Symptom | Likely Cause | Resolution |
|---------|--------------|------------|
| `validate` check fails | Missing file, invalid JSON, or schema mismatch | Fix syntax, ensure `file:` matches actual path |
| `deploy` fails with `401/403` | Invalid/expired API key or wrong URL | Verify `N8N_PROD_API_KEY` & `N8N_PROD_URL` in GitHub settings |
| Workflow not updating | Name mismatch between mapping and prod | Ensure `name:` exactly matches prod workflow name |
| Credentials error in prod | Credential not provisioned in prod n8n | Create credential in prod UI with identical name |
| Manual prod edits overwritten | Git is source of truth | Never edit workflows directly in prod UI; promote via PR |

> ⚠️ **Policy Recommendation:** Enforce "Git-only production changes" via team agreement. Manual UI edits will be overwritten on next promotion.

---

## ✅ First-Run Checklist

- [ ] `develop` and `production` branches exist
- [ ] `N8N_PROD_URL` (variable) & `N8N_PROD_API_KEY` (secret) configured
- [ ] `production` GitHub Environment created with required reviewers
- [ ] Branch protection enabled on `production`
- [ ] `npm install` run locally; dependencies committed
- [ ] `mapping.yaml` follows schema; all `file:` paths exist
- [ ] Test PR opened & merged to verify pipeline end-to-end
- [ ] Team trained on PR template & rollback procedure

---

## 📞 Support & Extensions

This pipeline is designed to be extended. Common additions:
- Slack/Teams deployment notifications
- Automated credential mapping registry
- Workflow execution smoke tests post-deploy
- Multi-environment promotion (`staging` → `production`)
- Drift detection alerts for manual prod changes

For modifications or advanced integrations, reference the inline comments in `scripts/` and `.github/workflows/n8n-promotion.yml`.
