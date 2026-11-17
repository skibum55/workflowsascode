import { test, expect } from '@playwright/test';
import { loadEvidence, cleanupPlan } from '../lib/evidence.mjs';
import { assertRun, assertDevice, assertOptionalIdentity } from '../lib/checks.mjs';
import { manifest } from '../lib/manifest.mjs';

const evidence = loadEvidence();
test.beforeEach(async ({}, info) => {
  info.annotations.push({ type: 'evidence', description: `${evidence.provenance}; execution ${evidence.execution.id}; ${evidence.execution.startedAt}. Saved execution evidence, not a new device API read.` });
});
test('manual dry-run safety, exact OID coverage, catalog refresh and summary', () => assertRun(evidence));
for (const device of manifest.devices) {
  test(`${device.serial}: identity, unchanged journal and separate status checks`, () => assertDevice(evidence, device));
  for (const field of ['imei', 'udid']) {
    test(`${device.serial}: ${field.toUpperCase()} matches uniquely when provided by Verto`, () => {
      const source = evidence.sources.find(s => s.oid === device.oid);
      test.skip(!source?.[field], `This Verto fixture has no ${field.toUpperCase()}; present-value integration case remains untested.`);
      assertOptionalIdentity(evidence, device, field);
    });
  }
}
test('controlled cleanup is a verified no-op', () => {
  assertRun(evidence);
  expect(cleanupPlan(evidence)).toEqual({ action: 'no_changes_to_clean', conflicts: [] });
});
