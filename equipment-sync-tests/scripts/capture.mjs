import fs from 'node:fs/promises';
import { request } from '@playwright/test';
import { readOnlyClient } from '../lib/read-only-client.mjs';
import { normalizeEvidence } from '../lib/evidence.mjs';
import { assertWorkflow, assertRun, assertDevice } from '../lib/checks.mjs';
import { manifest, safetySettings } from '../lib/manifest.mjs';

const id = process.env.N8N_EXECUTION_ID;
if (!/^\d+$/.test(id ?? '')) throw new Error('Set N8N_EXECUTION_ID to an explicit completed manual dry-run ID.');
const context = await request.newContext();
try {
  const client = readOnlyClient(context, process.env.N8N_BASE_URL ?? '', process.env.N8N_API_KEY);
  const before = await client.get(`/workflows/${manifest.workflowId}`);
  const projectWorkflow = w => ({ id: w.id, versionId: w.versionId, active: w.active,
    settings: safetySettings(JSON.parse(w.nodes.find(n => n.name === 'Sync settings')?.parameters.jsonOutput ?? '{}')) });
  assertWorkflow(projectWorkflow(before));
  const execution = await client.get(`/executions/${id}?includeData=true`);
  if (String(execution.id) !== id) throw new Error('Execution ID mismatch.');
  const ageHours = (Date.now() - Date.parse(execution.stoppedAt)) / 3_600_000;
  const maxAge = Number(process.env.SYNC_MAX_AGE_HOURS ?? 24);
  if (!Number.isFinite(maxAge) || maxAge <= 0 || !Number.isFinite(ageHours) || ageHours < 0 || ageHours > maxAge) {
    throw new Error('Execution is unfinished, future-dated, or stale. Run a fresh manual dry-run.');
  }
  const after = await client.get(`/workflows/${manifest.workflowId}`);
  assertWorkflow(projectWorkflow(after));
  if (after.versionId !== before.versionId) throw new Error('Workflow changed while evidence was being read.');
  const evidence = normalizeEvidence(after, execution);
  await fs.mkdir('private', { recursive: true });
  const filename = `private/execution-${id}.json`;
  await fs.writeFile(filename, JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
  // Preserve sanitized failure evidence as well; a failing check is never reported as a pass.
  assertRun(evidence);
  for (const device of manifest.devices) assertDevice(evidence, device);
  console.log(`Saved ${filename}. Dry-run safety passed. Run Playwright against this file for the report.`);
} finally {
  await context.dispose();
}
