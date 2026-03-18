const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const MAPPING_PATH = path.join(process.cwd(), 'mapping.yml');
const WORKFLOWS_DIR = path.join(process.cwd(), 'workflows');
const N8N_URL = process.env.N8N_PROD_URL?.replace(/\/$/, '');
const API_KEY = process.env.N8N_PROD_API_KEY;
const GITHUB_BEFORE = "1234" // process.env.GITHUB_BEFORE;

const INSTANCE_FIELDS = ['id', 'createdAt', 'updatedAt', 'versionId', 'meta', 'sharedWith', 'usedCredentials', 'pinData'];

if (!N8N_URL || !API_KEY) {
  console.error('❌ Missing N8N_PROD_URL or N8N_PROD_API_KEY environment variables');
  process.exit(1);
}

const HEADERS = {
  'Content-Type': 'application/json',
  'X-N8N-API-KEY': API_KEY
};

async function fetchJSON(endpoint, options = {}) {
  const res = await fetch(`${N8N_URL}/api/v1${endpoint}`, {
    ...options,
    headers: { ...HEADERS, ...options.headers }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

function sanitizeWorkflow(data) {
  const clean = { ...data };
  INSTANCE_FIELDS.forEach(f => delete clean[f]);
  return clean;
}

async function deploy() {
  console.log('🚀 Starting workflow deployment...');

  // 1. Load mapping
  const mapping = yaml.load(fs.readFileSync(MAPPING_PATH, 'utf8'));
  const workflowMap = new Map(mapping.workflows.map(w => [path.join('workflows', w.file), w]));

  // 2. Calculate changed files
  let changedFiles = [];
  let deployAll = false;

  changedFiles = getChangedWorkflowFiles();
  
 /* if (GITHUB_BEFORE && GITHUB_BEFORE !== '0000000000000000000000000000000000000000') {
    console.log(`📋 Calculating diff against previous production commit ${GITHUB_BEFORE}`);
    
    try {
      const diff = execSync(`git diff --name-only ${GITHUB_BEFORE} HEAD`, { encoding: 'utf8' });
      changedFiles = diff.trim().split('\n').filter(f => f.length > 0);
    } catch (err) {
      console.log('⚠️  Could not calculate diff, falling back to full deployment');
      deployAll = true;
    }

    // Safety Rule: If mapping.yml changed, deploy EVERYTHING
    if (changedFiles.includes('mapping.yml')) {
      console.log('⚠️  mapping.yml changed in this commit, running full deployment of all workflows');
      deployAll = true;
    }

  } else {
    console.log('ℹ️  First run on production branch, deploying all workflows');
    deployAll = true;
  }

*/
  // 3. Determine which workflows to deploy
  let toDeploy;

  if (deployAll) {
    toDeploy = mapping.workflows;
  } else {
    const changedWorkflowFiles = changedFiles.filter(f => f.startsWith('workflows/') && f.endsWith('.json'));

    toDeploy = mapping.workflows.filter(wf => {
      const filePath = path.join('workflows', wf.file);
      return changedWorkflowFiles.includes(filePath);
    });

    // Check for workflows that were removed from mapping
    const allFiles = new Set(mapping.workflows.map(w => path.join('workflows', w.file)));
    const removed = changedWorkflowFiles.filter(f => !allFiles.has(f));
    if (removed.length > 0) {
      console.log(`⚠️  The following workflows were removed from mapping: ${removed.join(', ')}`);
      console.log(`⚠️  These will NOT be automatically deleted from production.`);
    }
  }

  if (toDeploy.length === 0) {
    console.log('✅ No workflow changes detected. Deployment skipped.');
    process.exit(0);
  }

  // 4. Print pre-deployment summary
  console.log('\n📦 Workflows to be deployed:');
  toDeploy.forEach(wf => console.log(`   - ${wf.name} [active: ${wf.active === true}]`));
  console.log('');


  // 5. Fetch existing prod workflows
  console.log('🔍 Fetching current state from production n8n...');
  const existingWorkflows = await fetchJSON('/workflows?limit=250');
  const prodByName = new Map(existingWorkflows.data.map(w => [w.name, w]));


   // 6. Deploy each workflow
  for (const config of toDeploy) {
    const filePath = path.join(WORKFLOWS_DIR, config.file);
    let payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    payload = sanitizeWorkflow(payload);
    payload.name = config.name;
    payload.active = config.active === true; // Default false for safety

    const existing = prodByName.get(config.name);
    let result;

    try {
      if (existing) {
        console.log(`🔄 Updating: ${config.name}`);
        result = await fetchJSON(`/workflows/${existing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        console.log(`➕ Creating: ${config.name}`);
        result = await fetchJSON('/workflows', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
      console.log(`✅ Success: ${config.name} (ID: ${result.data.id}, Active: ${result.data.active})`);
    } catch (err) {
      console.error(`❌ Failed to deploy ${config.name}: ${err.message}`);
      process.exit(1);
    }
  }

  console.log('\n🎉 Deployment complete');
  process.exit(0);
}

/**
 * Get list of changed workflow JSON files in the current PR.
 * Returns absolute paths relative to repo root.
 */
function getChangedWorkflowFiles() {
  try {
    // Get list of changed files in the PR (between base and head)
    const diff = execSync('git diff --name-only HEAD^ HEAD', { encoding: 'utf8' });
    const changedFiles = diff.trim().split('\n')
      .filter(f => f.startsWith('workflows/') && f.endsWith('.json'));

    if (changedFiles.length === 0) {
      console.log('ℹ️  No workflow changes detected in this PR.');
      return [];
    }

    console.log(`📦 Detected ${changedFiles.length} changed workflow file(s):`);
    changedFiles.forEach(f => console.log(`   - ${f}`));
    return changedFiles;
  } catch (err) {
    console.log('ℹ️  Could not compute git diff. Falling back to all mapped workflows.');
    return [];
  }
}

deploy().catch(err => {
  console.error(`❌ Deployment failed: ${err.message}`);
  process.exit(1);
});