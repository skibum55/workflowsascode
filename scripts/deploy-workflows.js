const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const MAPPING_PATH = path.join(process.cwd(), 'mapping.yaml');
const WORKFLOWS_DIR = path.join(process.cwd(), 'workflows');
const N8N_URL = process.env.N8N_PROD_URL?.replace(/\/$/, '');
const API_KEY = process.env.N8N_PROD_API_KEY;
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

  // 1. Get changed files
  let changedFiles = [];
  try {
    const diff = execSync('git diff --name-only HEAD^ HEAD', { encoding: 'utf8' });
    changedFiles = diff.trim().split('\n').filter(f => f.startsWith('workflows/') && f.endsWith('.json'));
  } catch (err) {
    console.log('ℹ️  Could not compute git diff. Deploying all mapped workflows.');
  }

  // 2. Load mapping
  const mapping = yaml.load(fs.readFileSync(MAPPING_PATH, 'utf8'));
  const workflowMap = new Map(mapping.workflows.map(w => [path.join('workflows', w.file), w]));

  // Filter to only changed & mapped workflows
  const toDeploy = changedFiles.length > 0 
    ? changedFiles.filter(f => workflowMap.has(f))
    : Array.from(workflowMap.keys());

  if (toDeploy.length === 0) {
    console.log('ℹ️  No workflow changes detected. Skipping deployment.');
    process.exit(0);
  }

  console.log(`📦 Deploying ${toDeploy.length} workflow(s)...`);

  // 3. Fetch existing prod workflows for ID resolution
  const existingWorkflows = await fetchJSON('/workflows');
  const prodByName = new Map(existingWorkflows.data.map(w => [w.name, w]));

  // 4. Deploy each workflow
  for (const file of toDeploy) {
    const config = workflowMap.get(file);
    const filePath = path.join(process.cwd(), file);
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

deploy().catch(err => {
  console.error(`❌ Deployment failed: ${err.message}`);
  process.exit(1);
});
