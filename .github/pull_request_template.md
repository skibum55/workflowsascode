---
name: n8n Workflow Promotion
about: Promote n8n workflows from develop to production
title: 'promote: <workflow-name(s)> | <brief description>'
labels: ['n8n/workflow', 'env:production', 'promotion']
assignees: ''
---

## 📋 Summary
<!-- Briefly describe what workflows are being promoted and why -->
- **Purpose:** 
- **Related Issue/Ticket:** 

## 🔄 Workflows Being Promoted
| Workflow Name | File Path | Action | Prod Activation |
|---------------|-----------|--------|-----------------|
| `name`        | `workflows/file.json` | New / Update | `true` / `false` |

## ✅ Author Checklist
_Complete before requesting review_
- [ ] Workflows tested and validated in `develop` environment
- [ ] `mapping.yml` updated and matches `workflows/` directory
- [ ] All referenced credentials are pre-provisioned in production
- [ ] No hardcoded secrets, URLs, or environment-specific values (relies on CI/CD env vars)
- [ ] CI validation checks (schema, lint, dry-run) are passing
- [ ] Activation state explicitly defined per workflow
- [ ] Cross-workflow dependencies or triggers documented (if applicable)

## 🔧 n8n-Specific Details
- **Credentials Required:** <!-- List credential names expected in prod -->
- **Node Version Compatibility:** <!-- Confirm compatibility with prod n8n version -->
- **External Dependencies:** <!-- APIs, webhooks, databases, rate limits, etc. -->
- **Known Risks/Limitations:** <!-- Breaking changes, manual steps, data migration needs -->

## 🧪 Testing & Validation
- **Dev Instance:** `https://oauth2test.manageddeployment.com`
- **Test Scenarios Covered:** <!-- Brief list of execution paths validated -->
- **CI Status:** <!-- Link to checks or confirm all required checks passed -->

## 👀 Reviewer Checklist
_For approvers before merging_
- [ ] Workflow logic matches requirements and follows n8n best practices
- [ ] `mapping.yml` structure is valid, complete, and free of drift
- [ ] Credential references are approved for production use
- [ ] Activation policy is appropriate (default: `false` unless justified)
- [ ] No deprecated nodes, version mismatches, or unhandled error paths
- [ ] Rollback plan is documented and feasible

## 🚀 Deployment & Rollback
- **Post-Merge Behavior:** Workflows deploy automatically to production upon merge. Activation follows the `Prod Activation` column above.
- **ID Resolution:** Production workflow IDs are resolved automatically by name. Do not modify or hardcode ID fields.
- **Rollback Procedure:** `git revert <merge-commit-sha>` → open PR → merge to restore previous known-good state.
- **Verification Steps:** <!-- How to confirm success post-deployment (e.g., check prod UI, monitor execution logs, test webhook endpoint) -->

## 📎 Additional Notes
<!-- Screenshots, architecture diagrams, runbook links, or extra context -->
