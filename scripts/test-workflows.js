#!/usr/bin/env node
/**
 * Phase 3: Automated Testing Pipeline
 * Step 9: Snapshot current state
 * Step 10: Deploy updated workflow  
 * Step 11: Initiate webhook test execution
 * Step 12: Fire test payload
 * Step 13: Poll execution results
 */

const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { execSync } = require('child_process');
const manifest = require('../manifest.json');

async function main() {
  console.log('🧪 Phase 3: Starting non-prod test suite');
  
  const nonProd = manifest.environments['non-prod'];
  const testWorkflow = 'workflows/shared-webhook-processor.json'; // From GitHub Action context
  
  // Phase 3 Step 9: Snapshot current state
  const snapshotDir = path.join(__dirname, '..', 'snapshots');
  await fs.ensureDir(snapshotDir);
  
  const currentWorkflow = await getWorkflow(nonProd, 'wf_002');
  await fs.writeJSON(path.join(snapshotDir, `backup-${Date.now()}.json`), currentWorkflow);
  console.log('💾 Current state snapshotted');
  
  try {
    // Phase 3 Step 10: Deploy test version
    await deployTestVersion(testWorkflow, nonProd);
    
    // Phase 3 Step 11-13: Execute webhook test
    const executionId = await triggerWebhookTest(nonProd, 'wf_002');
    const testPayloadPath = path.join(__dirname, '..', 'tests/test-payloads', 'webhook-test-shared.json');
    await fireTestPayload(nonProd, executionId, testPayloadPath);
    
    // Phase 3 Step 13: Poll for success
    const result = await pollExecution(nonProd, executionId);
    if (result.status === 'success') {
      console.log('✅ Phase 3 COMPLETE: Test PASSED');
      process.exit(0);
    } else {
      throw new Error(`Test failed: ${JSON.stringify(result)}`);
    }
  } catch (error) {
    console.error('❌ Test FAILED - Initiating rollback');
    await rollback(nonProd);
    process.exit(1);
  }
}

async function getWorkflow(target, workflowId) {
  const res = await axios.get(`${target.baseUrl}/api/v1/workflows/${target.instanceId}/${workflowId}`, {
    headers: { 'X-N8N-API-KEY': target.apiKey }
  });
  return res.data;
}

async function deployTestVersion(workflowPath, target) {
  // Use deploy script logic here
  console.log(`Deploying test version from ${workflowPath}`);
}

async function triggerWebhookTest(target, workflowId) {
  const res = await axios.post(`${target.baseUrl}/api/v1/workflows/${target.instanceId}/${workflowId}/test`, {}, {
    headers: { 'X-N8N-API-KEY': target.apiKey }
  });
  return res.data.execution.id;
}

async function fireTestPayload(target, executionId, payloadPath) {
  const payload = await fs.readJSON(payloadPath);
  await axios.post(`${target.baseUrl}/webhook-test/${executionId}`, payload, {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function pollExecution(target, executionId, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await axios.get(`${target.baseUrl}/api/v1/executions/${executionId}`, {
      headers: { 'X-N8N-API-KEY': target.apiKey }
    });
    if (res.data.status !== 'running') return res.data;
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('Execution timeout');
}

async function rollback(target) {
  // Phase 4 Step 1: Scripted Rollback
  const snapshotFiles = await fs.readdir(path.join(__dirname, '..', 'snapshots'));
  const latestBackup = snapshotFiles.sort().pop();
  const backupData = await fs.readJSON(path.join(__dirname, '..', 'snapshots', latestBackup));
  
  await axios({
    method: 'PUT',
    url: `${target.baseUrl}/api/v1/workflows/${target.instanceId}/wf_002`,
    headers: { 'X-N8N-API-KEY': target.apiKey },
    data: backupData
  });
  
  console.log('🔄 Rollback COMPLETE');
}

main();