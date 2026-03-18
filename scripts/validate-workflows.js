const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const yaml = require('js-yaml');

const MAPPING_PATH = path.join(process.cwd(), 'mapping.yml');
const WORKFLOWS_DIR = path.join(process.cwd(), 'workflows');

const REQUIRED_FIELDS = ['name', 'nodes', 'connections'];
const INSTANCE_FIELDS = ['id', 'createdAt', 'updatedAt', 'versionId', 'meta', 'sharedWith', 'usedCredentials'];

async function validate() {
  console.log('🔍 Starting workflow validation...');

  // Load mapping first
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

  const allMappedFiles = new Set(mapping.workflows.map(w => path.join('workflows', w.file)));

  // Get changed files for this PR
  let changedFiles = [];
  let validateAll = false;

  if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
    console.log(`📋 Calculating diff against target branch ${process.env.GITHUB_BASE_SHA}`);
    
    try {
      const diff = execSync(`git diff --name-only ${process.env.GITHUB_BASE_SHA} ${process.env.GITHUB_HEAD_SHA}`, { encoding: 'utf8' });
      changedFiles = diff.trim().split('\n').filter(f => f.length > 0);
    } catch (err) {
      console.log('⚠️  Could not calculate diff, falling back to full validation');
      validateAll = true;
    }

    // Safety rule: if mapping.yml changed, validate everything
    if (changedFiles.includes('mapping.yml')) {
      console.log('⚠️  mapping.yml changed in this PR, running full validation of all workflows');
      validateAll = true;
    }

  } else {
    // Running locally or on push, run full validation
    validateAll = true;
  }


  // Work out which workflows we need to validate
  let workflowsToValidate;

  if (validateAll) {
    workflowsToValidate = [...mapping.workflows];
  } else {
    // Filter to only changed workflow files
    const changedWorkflowFiles = changedFiles.filter(f => f.startsWith('workflows/') && f.endsWith('.json'));

    // Check for deleted workflows
    const deletedWorkflows = changedWorkflowFiles.filter(f => !allMappedFiles.has(f));
    for (const deleted of deletedWorkflows) {
      console.log(`⚠️  ${deleted} was deleted in this PR but is still present in mapping.yml`);
    }

    workflowsToValidate = mapping.workflows.filter(wf => {
      const filePath = path.join('workflows', wf.file);
      return changedWorkflowFiles.includes(filePath);
    });

    console.log(`📍 Found ${workflowsToValidate.length} changed workflow(s) to validate`);
  }

  if (workflowsToValidate.length === 0) {
    console.log('✅ No workflows changed in this PR, validation skipped');
    process.exit(0);
  }


  const errors = [];
  const warnings = [];

  // Run validation only on selected workflows
  for (const wf of workflowsToValidate) {
    if (!wf.name || !wf.file) {
      errors.push(`Workflow entry missing "name" or "file": ${JSON.stringify(wf)}`);
      continue;
    }

    const filePath = path.join(WORKFLOWS_DIR, wf.file);
    if (!fs.existsSync(filePath)) {
      errors.push(`File referenced in mapping not found: ${wf.file}`);
      continue;
    }

    let workflowData;
    try {
      workflowData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      errors.push(`Invalid JSON in ${wf.file}: ${err.message}`);
      continue;
    }

    // Schema validation
    for (const field of REQUIRED_FIELDS) {
      if (!(field in workflowData)) {
        errors.push(`${wf.file} missing required field: ${field}`);
      }
    }

    // Check for instance-specific fields
    const foundInstanceFields = INSTANCE_FIELDS.filter(f => f in workflowData);
    if (foundInstanceFields.length > 0) {
      warnings.push(`${wf.file} contains instance-specific fields: ${foundInstanceFields.join(', ')}. These will be stripped during deployment.`);
    }

    // Credential reference check
    if (workflowData.nodes) {
      const credRefs = workflowData.nodes
        .filter(n => n.credentials)
        .flatMap(n => Object.values(n.credentials))
        .map(c => c.name || c.id);
      
      if (credRefs.length > 0) {
        warnings.push(`${wf.file} references credentials: ${credRefs.join(', ')}. Ensure these exist in production.`);
      }
    }

    // Activation policy check
    const shouldActivate = wf.active === true;
    if (shouldActivate) {
      warnings.push(`${wf.file} is marked for auto-activation in production. Verify this is intentional.`);
    }
  }

  // Report results
  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach(w => console.log(`   - ${w}`));
  }

  if (errors.length > 0) {
    console.error('\n❌ Validation failed:');
    errors.forEach(e => console.error(`   - ${e}`));
    process.exit(1);
  }

  console.log('\n✅ All changed workflows validated successfully');
  process.exit(0);
}

validate().catch(err => {
  console.error(`❌ Unexpected error: ${err.message}`);
  process.exit(1);
});
