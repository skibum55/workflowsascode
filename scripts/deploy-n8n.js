#!/usr/bin/env node
/**
 * Phase 1 Step 2: Deployment script for n8n workflows using Public API
 * Phase 2 Step 3: Injects version into Tags and Sticky Note node
 * Phase 4 Step 3: Deploys to fleet from main/tag
 * 
 * Usage: node scripts/deploy-n8n.js --env non-prod --workflow workflows/shared-webhook-processor.json
 *        node scripts/deploy-n8n.js --env fleet
 */

const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const simpleGit = require('simple-git');
const manifest = require('../manifest.json');

async function main() {
  const args = process.argv.slice(2);
  const env = args.find(arg => arg.startsWith('--env='))?.split('=')[1];
  const workflowFile = args.find(arg => arg.startsWith('--workflow='))?.split('=')[1];
  
  if (!env) throw new Error('--env (non-prod|fleet) required');
  
  // Phase 2 Step 2: Get current git tag/version
  const git = simpleGit();
  const tags = await git.tags({ '--sort': '-version:refname' });
  const version = tags.all[0] || (await git.revparse(['HEAD'])).slice(0, 7);
  
  console.log(`🚀 Phase 4 Step 3: Deploying version ${version}`);

  if (env === 'non-prod') {
    await deploySingleWorkflow(workflowFile, manifest.environments['non-prod'], version);
  } else if (env === 'fleet') {
    // Phase 4 Step 3: Deploy to all customers
    for (const customer of manifest.environments.customers) {
      console.log(`\n📦 Deploying to ${customer.name}`);
      for (const [wfName, wfId] of Object.entries(customer.workflows)) {
        const wfPath = path.join(__dirname, '..', 'workflows', `${wfName}.json`);
        await deploySingleWorkflow(wfPath, customer, version);
      }
    }
  }
}

async function deploySingleWorkflow(workflowFile, target, version) {
  // Phase 1 Step 2: Read workflow JSON
  const workflowData = await fs.readJSON(workflowFile);
  
  // Phase 2 Step 3: Inject version into tags and sticky note
  workflowData.name = `${workflowData.name} v${version}`;
  if (!workflowData.tags) workflowData.tags = [];
  workflowData.tags.push(`v${version}`);
  
  // Update sticky note node with version (assumes node exists with name "VersionStickyNote")
  const stickyNode = workflowData.nodes.find(n => n.name === 'VersionStickyNote');
  if (stickyNode) {
    stickyNode.parameters.content = `Deployed: v${version}\n{{ new Date().toISOString() }}`;
  }
  
  // Phase 1 Step 2: Deploy via n8n Public API
  const response = await axios({
    method: 'POST',
    url: `${target.baseUrl}/api/v1/workflows/${target.instanceId}`,
    headers: {
      'X-N8N-API-KEY': target.apiKey,
      'Content-Type': 'application/json'
    },
    data: workflowData
  });
  
  console.log(`✅ Deployed ${path.basename(workflowFile)} to ${target.baseUrl}`);
}

main().catch(console.error);