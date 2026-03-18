const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const MAPPING_PATH = path.join(process.cwd(), 'mapping.yml');
const WORKFLOWS_DIR = path.join(process.cwd(), 'workflows');

// Basic n8n workflow schema requirements
const REQUIRED_FIELDS = ['name', 'nodes', 'connections'];
const INSTANCE_FIELDS = ['id', 'createdAt', 'updatedAt', 'versionId', 'meta', 'sharedWith', 'usedCredentials'];

async function validate() {
  console.log('🔍 Starting workflow validation...');

  // 1. Load & parse mapping
  if (!fs.existsSync(MAPPING_PATH)) {
    console.error('❌ mapping.yml not found');
    process.exit(1);
  }

  let mapping;
  try {
    mapping = yaml.load(fs.readFileSync(MAPPING_PATH, 'utf8'));
  } catch (err) {
    console.error(`❌ Failed to parse mapping.yml: ${err.message}`);
    process.exit(1);
  }

  if (!mapping.workflows || !Array.isArray(mapping.workflows)) {
    console.error('❌ mapping.yml must contain a "workflows" array');
    process.exit(1);
  }

  const errors = [];
  const warnings = [];

  // 2. Validate each workflow entry
  for (const wf of mapping.workflows) {
    if (!wf.name || !wf.file) {
      errors.push(`Workflow entry missing "name" or "file": ${JSON.stringify(wf)}`);
      continue;
    }

    const filePath = path.join(WORKFLOWS_DIR, wf.file);
    if (!fs.existsSync(filePath)) {
      errors.push(`File not found: ${wf.file}`);
      continue;
    }

    let workflowData;
    try {
      workflowData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      errors.push(`Invalid JSON in ${wf.file}: ${err.message}`);
      continue;
    }

    // 3. Schema validation
    for (const field of REQUIRED_FIELDS) {
      if (!(field in workflowData)) {
        errors.push(`${wf.file} missing required field: ${field}`);
      }
    }

    // 4. Check for instance-specific fields (should be stripped before promotion)
    const foundInstanceFields = INSTANCE_FIELDS.filter(f => f in workflowData);
    if (foundInstanceFields.length > 0) {
      warnings.push(`${wf.file} contains instance-specific fields: ${foundInstanceFields.join(', ')}. These will be stripped during deployment.`);
    }

    // 5. Credential reference check
    if (workflowData.nodes) {
      const credRefs = workflowData.nodes
        .filter(n => n.credentials)
        .flatMap(n => Object.values(n.credentials))
        .map(c => c.name || c.id);
      
      if (credRefs.length > 0) {
        warnings.push(`${wf.file} references credentials: ${credRefs.join(', ')}. Ensure these exist in production.`);
      }
    }

    // 6. Activation policy check
    const shouldActivate = wf.active === true;
    if (shouldActivate) {
      warnings.push(`${wf.file} is marked for auto-activation in production. Verify this is intentional.`);
    }
  }

  // 7. Report results
  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach(w => console.log(`   - ${w}`));
  }

  if (errors.length > 0) {
    console.error('\n❌ Validation failed:');
    errors.forEach(e => console.error(`   - ${e}`));
    process.exit(1);
  }

  console.log('\n✅ All workflows validated successfully');
  process.exit(0);
}

validate().catch(err => {
  console.error(`❌ Unexpected error: ${err.message}`);
  process.exit(1);
});
