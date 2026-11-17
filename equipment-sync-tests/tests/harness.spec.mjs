import { test, expect } from '@playwright/test';
import { readOnlyClient } from '../lib/read-only-client.mjs';
import { loadEvidence, cleanupPlan, candidates, normalizeEvidence } from '../lib/evidence.mjs';
import { assertRun, assertDevice, assertOptionalIdentity } from '../lib/checks.mjs';
import { manifest } from '../lib/manifest.mjs';

const clone = () => structuredClone(loadEvidence());
const fixture = manifest.devices[0];
for (const [name, change] of [
  ['active workflow', e => e.workflow.active = true],
  ['live saved settings', e => e.workflow.settings.dryRun = false],
  ['live execution settings', e => e.runSettings.dryRun = false],
  ['live approval', e => e.runSettings.testApplyApproved = true],
  ['ownership remapping', e => e.runSettings.ownershipMap.Purchase = 'C'],
  ['unreviewed graph', e => e.workflow.versionId = 'unexpected-version'],
  ['mutating path', e => e.executedNodes.push('Execute journaled Omnissa operation')],
  ['omitted mutation inspection', e => e.inspectedNodeNames = []],
  ['wrong workflow', e => e.execution.workflowId = 'other'],
  ['technical failure', e => e.execution.status = 'error'],
  ['missing result', e => e.devices.pop()],
  ['duplicate result', e => e.devices.push(structuredClone(e.devices[0]))],
  ['stale catalog', e => e.catalog.refreshedAt = '2000-01-01T00:00:00Z'],
  ['incomplete enrolled inventory', e => e.inventory.enrolledTotal += 1],
]) {
  test(`rejects ${name}`, () => {
    const e = clone(); change(e);
    expect(() => assertRun(e)).toThrow();
  });
}
for (const [name, change] of [
  ['duplicate observed device', d => d.registeredCandidates.push(structuredClone(d.registeredCandidates[0]))],
  ['different OID', d => d.registeredCandidates[0].attributes[0].value = 'another-oid'],
  ['changed asset', d => d.snapshot.fields.AssetNumber = 'changed'],
  ['wrong source model mapping', d => d.mapped['Device Model'] = 'wrong'],
  ['invented ownership mapping', d => d.mapped['Device Ownership(C/E/S/None)'] = 'C'],
  ['changed state', d => d.journal.afterState.status = 'synced-during-preview'],
  ['journal conflict', d => d.journal.status = 'conflict'],
  ['cross-execution journal', d => d.journal.syncExecutionId = '0'],
  ['hidden unverified fields', d => d.validation.checks = d.validation.checks.map(c => c.result === 'unverified' ? { ...c, result: 'passed' } : c)],
  ['conflated status', d => d.statusRow.syncStatus = 'needs_attention'],
]) {
  test(`device check rejects ${name}`, () => {
    const e = clone(); change(e.devices[0]);
    expect(() => assertDevice(e, fixture)).toThrow();
  });
}
test('cleanup stops on an operation and offers no mutation function', () => {
  const e = clone(); e.devices[0].journal.operations.push({ status: 'unknown' });
  expect(cleanupPlan(e)).toEqual({ action: 'stop_and_flag', conflicts: [fixture.oid] });
});
test('matches duplicate candidates by OID, IMEI and UDID independently of serial', () => {
  const source = { oid: fixture.oid, serial: fixture.serial, imei: '0012345', udid: 'UDID01' };
  const base = { serial: 'other', imei: '', udid: '', attributes: [] };
  const rows = [{ ...base, imei: source.imei }, { ...base, udid: source.udid },
    { ...base, attributes: [{ name: 'CustomAttribute1', value: source.oid }] }];
  expect(candidates(rows, source)).toHaveLength(3);
});
for (const field of ['imei', 'udid']) {
  test(`${field}: present-value match works and mismatch/duplicate fail (synthetic)`, () => {
    const e = clone(); const d = e.devices[0];
    e.sources[0][field] = '001234567890';
    d.registeredCandidates[0][field] = '001234567890';
    d.snapshot.fields[field.toUpperCase()] = '001234567890';
    expect(() => assertOptionalIdentity(e, fixture, field)).not.toThrow();
    d.snapshot.fields[field.toUpperCase()] = 'wrong';
    expect(() => assertOptionalIdentity(e, fixture, field)).toThrow();
    d.snapshot.fields[field.toUpperCase()] = '001234567890';
    d.registeredCandidates.push(structuredClone(d.registeredCandidates[0]));
    expect(() => assertOptionalIdentity(e, fixture, field)).toThrow();
  });
}
test('client rejects non-read endpoints before contacting n8n', async () => {
  let calls = 0;
  const client = readOnlyClient({ get: async () => { calls++; } }, 'https://example.invalid', 'synthetic-key');
  for (const path of ['/workflows/other', '/workflows/x/activate', '/executions/1/retry',
    '/executions/1?includeData=true&redirect=other', 'https://other.invalid', '/credentials']) {
    await expect(client.get(path)).rejects.toThrow('Read-only endpoint rejected');
  }
  expect(calls).toBe(0);
  expect(client.post).toBeUndefined();
  expect(client.delete).toBeUndefined();
});
test('client uses GET and refuses redirects/errors without response-body leakage', async () => {
  const calls = [];
  const context = { get: async (url, options) => {
    calls.push({ url, options });
    return { status: () => 302, json: () => { throw new Error('secret response'); } };
  } };
  const client = readOnlyClient(context, 'https://example.invalid', 'synthetic-key');
  await expect(client.get(`/workflows/${manifest.workflowId}`)).rejects.toThrow('HTTP 302');
  expect(calls[0].options.maxRedirects).toBe(0);
  expect(calls[0].url).toBe(`https://example.invalid/api/v1/workflows/${manifest.workflowId}`);
});
test('client accepts the documented GET execution path and JSON response', async () => {
  const client = readOnlyClient({ get: async () => ({ status: () => 200, json: async () => ({ id: '123' }) }) },
    'https://example.invalid', 'synthetic-key');
  expect(await client.get('/executions/123?includeData=true')).toEqual({ id: '123' });
});
test('client rejects insecure URLs and missing credentials', () => {
  for (const url of ['http://example.invalid', 'https://user:password@example.invalid', 'https://example.invalid?token=x']) {
    expect(() => readOnlyClient({}, url, 'synthetic-key')).toThrow();
  }
  expect(() => readOnlyClient({}, 'https://example.invalid', '')).toThrow('N8N_API_KEY is required');
});
test('normalization does not export arbitrary workflow parameters or authentication outputs', () => {
  const e = clone();
  const w = { id: manifest.workflowId, versionId: manifest.auditedVersionId, active: false,
    nodes: [{ name: 'Sync settings', parameters: { jsonOutput: JSON.stringify(e.runSettings) } },
      { name: 'Authorize Verto', parameters: { password: 'SYNTHETIC_SECRET' } }] };
  const x = { id: '123', data: { resultData: { runData: {
    'Authorize Verto': [{ data: { main: [[{ json: { access_token: 'SYNTHETIC_SECRET' } }]] } }],
  } } } };
  expect(JSON.stringify(normalizeEvidence(w, x))).not.toContain('SYNTHETIC_SECRET');
});
