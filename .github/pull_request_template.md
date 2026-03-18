## Promotion to Production

**PR Type:** n8n Workflow Promotion

### Summary
<!-- Brief description of what is being promoted to production -->

### Workflows Being Promoted

<!-- List the workflows included in this promotion -->

| Workflow Name | File | Source ID | Notes |
|---------------|------|-----------|-------|
| nexusPostMsgTest | `workflows/nexuspostmsgtest.json` | `AckYLB8SiERiCmNV` | |
| nexusPostMsgTestAuth | `workflows/nexuspostmsgtestauth.json` | `DknlIskkKHT26g5x` | |

### Changes
<!-- Describe what has changed in these workflows since the last promotion -->

- 
- 

### Testing Performed
<!-- Please tick and describe testing done on develop environment -->

- [ ] Workflows tested manually in development n8n instance
- [ ] Error handling and edge cases verified
- [ ] Performance / execution time checked
- [ ] Dependencies with other workflows validated

### Important Notes
<!-- Any breaking changes, configuration requirements, environment variables needed, or things the production team should be aware of -->

### Mapping File Updates
<!-- Confirm if mapping.yaml was updated -->

- [ ] `mapping.yaml` has been updated with latest workflow information
- [ ] `last_sync` timestamp has been refreshed

### Deployment
- Target Branch: `production`
- Will be deployed automatically after this PR is merged using `PROD_N8N_URL` and `PROD_N8N_API_KEY`

### Rollback Plan
<!-- How can we quickly rollback if issues are found after promotion? -->

---

**Reviewer Checklist:**

- [ ] Workflow JSON files are valid and readable
- [ ] No sensitive credentials or secrets are present in workflow files
- [ ] Changes match the described testing and notes
- [ ] `mapping.yaml` is consistent with the workflows being promoted

---

**Note:** Only merge this PR when you are ready for these workflows to be pushed to the **Production** n8n instance.
