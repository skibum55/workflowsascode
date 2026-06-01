#!/usr/bin/env node
/**
 * Phase 4 Step 1: Emergency rollback script
 * Restores from latest snapshot directory
 */

const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const manifest = require('../manifest.json');

async function main() {
  const nonProd = manifest.environments['non-prod'];
  const snapshotDir = path.join(__dirname, '..', 'snapshots');
  
  const snapshots = await fs.readdir(snapshotDir);
  if (snapshots.length === 0) {
    throw new Error('No snapshots found for rollback');
  }
  
  const latestBackup = snapshots.sort().pop();
  const backupData = await fs.readJSON(path.join(snapshotDir, latestBackup));
  
  // Restore workflow
  await axios.put(`${nonProd.baseUrl}/api/v1/workflows/${nonProd.instanceId}/wf_002`, backupData, {
    headers: { 'X-N8N-API-KEY': nonProd.apiKey }
  });
  
  console.log(`✅ Rolled back to ${latestBackup}`);
}

main().catch(console.error);