import { test, expect } from '@playwright/test';
import { loadEvidence, acceptanceGaps } from '../lib/evidence.mjs';
import { assertRun, assertDevice } from '../lib/checks.mjs';
import { manifest } from '../lib/manifest.mjs';

const evidence = loadEvidence();
for (const expected of manifest.devices) {
  test(`${expected.serial}: every required result has verification evidence`, async ({}, info) => {
    assertRun(evidence);
    assertDevice(evidence, expected);
    const device = evidence.devices.find(d => d.oid === expected.oid);
    const gaps = acceptanceGaps(evidence, device);
    await info.attach('verification-gaps', {
      body: JSON.stringify({ executionId: evidence.execution.id, oid: expected.oid,
        syncStatus: device.syncStatus, verificationStatus: device.verificationStatus, gaps }, null, 2),
      contentType: 'application/json',
    });
    expect(gaps, 'Required evidence is missing. This is an acceptance failure, even when dry-run safety passes.').toEqual([]);
  });
}
