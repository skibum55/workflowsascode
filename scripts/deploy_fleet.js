// file: scripts/deploy_fleet.js
// PHASE 4 | STEP 3: Promote to Fleet
// PHASE 4 | STEP 4: Gate Merges (Enforced by CI/CD Flow)
// PHASE 4 | STEP 5: Iterate Manifest for Simultaneous Deployments
// Supports Phase 2 | Step 6: Visual Versioning Injection during deployment

const fs = require('fs').promises;
const N8nClient = require('../src/lib/api_client');
const { injectVersion, readLocalJSON } = require('../src/lib/utils');

async function main() {
  try {
    const versionTag = process.argv[2];
    const manifestPath = './config/manifest.json'; // Fixed location as per Phase 1 | Step 2
    
    if (!versionTag) throw new Error('No version tag provided.');

    console.log(`[PHASE 4 | STEP 3] Starting Fleet Promotion for ${versionTag}...`);
    
    const manifest = await readLocalJSON(manifestPath);
    let globalStatus = 'success';
    const results = [];

    // PHASE 4 | STEP 3: Iterate over Environments in Manifest
    for (const config of manifest.environments) {
      // Skip Dev environment for Production Release promotion logic
      if (config.type === 'internal') continue; 

      try {
        console.log(`[DEPLOY] Targeting Customer: ${config.id}`);
        
        const n8n = new N8nClient(config.instance_url, config.instance_api_key);
        
        // Verify Connection Before Heavy Lifting
        await n8n.authenticate();

        // Load Source Workflow File
        // Note: Assuming single workflow bundle for demo, expand loop if mult-workflow
        const sourcePath = manifest.workflows[0].source_path;
        const baseWorkflow = await readLocalJSON(sourcePath);

        // PHASE 2 | STEP 6: Inject Versioning into Workflow JSON
        const deployedWorkflow = await injectVersion(baseWorkflow, versionTag, config.id);

        // PHASE 4 | STEP 3: Deploy to Target Instance
        const destMapping = manifest.workflows[0].destinations.find(d => d.env_id === config.id);
        
        if (!destMapping) {
          console.warn(`Warning: No ID mapping found for ${config.id}, skipping.`);
          continue;
        }

        const result = await n8n.setWorkflow(deployedWorkflow);
        results.push({ id: config.id, status: 'deployed', url: config.instance_url });
        console.log(`[SUCCESS] Pushed to ${config.id}.`);

      } catch (err) {
        console.error(`[FAILURE] Failed to deploy to ${config.id}:`, err.message);
        globalStatus = 'failed';
        results.push({ id: config.id, status: 'error', error: err.message });
      }
    }

    // OUTPUT RESULT STATUS TO GITHUB ACTIONS
    if (globalStatus === 'success') {
      console.log('[COMPLETE] All eligible instances updated successfully.');
    } else {
      console.log('[FAIL] Some instances failed. Manual intervention required.');
    }

    // Return status for GitHub Action Job Output
    process.stdout.write(globalStatus);
    process.exit(globalStatus === 'success' ? 0 : 1);

  } catch (err) {
    console.error('[FATAL] Script execution failed:', err);
    process.exit(1);
  }
}

main();
