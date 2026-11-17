import assert from 'node:assert/strict';
import { manifest, mutationNodes } from './manifest.mjs';
import { cleanupPlan, same } from './evidence.mjs';

const sorted = values => [...values].sort();
export function assertSettings(settings) {
  assert.equal(settings.dryRun, true, 'dryRun must remain true');
  assert.equal(settings.testMode, true, 'testMode must remain true');
  assert.equal(settings.testApplyApproved, false, 'live test approval must remain false');
  assert.equal(settings.maxTestDevices, 3);
  assert.deepEqual(sorted(settings.testSourceOids), sorted(manifest.devices.map(d => d.oid)));
  assert.deepEqual(settings.ownershipMap, manifest.ownershipMap, 'Ownership mapping must remain unchanged');
  assert.equal(settings.imeiSourceField, 'IMEI');
  assert.equal(settings.udidSourceField, 'UDID');
}
export function assertWorkflow(workflow) {
  assert.equal(workflow.id, manifest.workflowId);
  assert.equal(workflow.active, false, 'Workflow must remain inactive');
  assert.equal(workflow.versionId, manifest.auditedVersionId, 'Workflow changed: review graph before updating the audited version');
  assertSettings(workflow.settings);
}
export function assertRun(e) {
  assert.equal(e.schemaVersion, 1);
  assertWorkflow(e.workflow);
  assertSettings(e.runSettings);
  assert.equal(e.execution.workflowId, manifest.workflowId);
  assert.equal(e.execution.mode, 'manual');
  assert.equal(e.execution.status, 'success');
  assert.ok(e.execution.id && e.execution.startedAt && e.execution.stoppedAt);
  const start = Date.parse(e.execution.startedAt), stop = Date.parse(e.execution.stoppedAt);
  assert.ok(Number.isFinite(start) && Number.isFinite(stop) && stop >= start);
  for (const node of mutationNodes) {
    assert.ok(e.inspectedNodeNames.includes(node), `Execution inspection omitted ${node}`);
    assert.ok(!e.executedNodes.includes(node), `Unexpected mutation path: ${node}`);
  }
  const expected = sorted(manifest.devices.map(d => d.oid));
  assert.deepEqual(sorted(e.devices.map(d => d.oid)), expected, 'Exactly three results, no duplicates');
  assert.deepEqual(sorted(e.sources.map(s => s.oid)), expected, 'Exactly three source reads, no duplicates');
  assert.ok(e.inventory.registeredResponsePresent && e.inventory.enrolledResponsePresent);
  assert.equal(e.inventory.enrolledCount, e.inventory.enrolledTotal, 'Enrolled inventory must be complete');
  assert.equal(e.summary.executionId, e.execution.id);
  assert.equal(e.summary.dryRun, true);
  assert.equal(e.summary.scope, 'preview');
  assert.equal(e.summary.totalDevices, 3);
  assert.equal(e.summary.requiresFailure, false);
  for (const key of ['missing', 'unexpected', 'duplicated']) assert.deepEqual(e.summary[key], []);
  assert.equal(e.catalog.complete, true);
  assert.ok(Date.parse(e.catalog.refreshedAt) >= start && Date.parse(e.catalog.refreshedAt) <= stop,
    'Attribute catalog must have been refreshed within this execution');
  assert.equal(e.catalog.matchingDefinitions.length, 1);
  assert.equal(e.catalog.matchingDefinitions[0].name, manifest.attributeName);
  assert.equal(e.catalog.matchingDefinitions[0].applicationGroup, manifest.applicationGroup);
  assert.equal(String(e.catalog.matchingDefinitions[0].managedByOrganizationGroupId), '7870');
  assert.equal(cleanupPlan(e).action, 'no_changes_to_clean');
  const issues = e.devices.flatMap(d => d.validation.issues.map(i => ({ sourceKey: d.oid, ...i })));
  assert.deepEqual(e.summary.issues, issues, 'Run summary must retain every device issue');
}

export function assertDevice(e, expected) {
  const d = e.devices.find(x => x.oid === expected.oid);
  const source = e.sources.find(x => x.oid === expected.oid);
  assert.ok(d && source, 'Source and result must exist');
  assert.equal(source.serial, expected.serial);
  assert.equal(d.serial, expected.serial);
  assert.equal(d.dryRun, true);
  assert.ok(['unchanged', 'dry_run', 'deferred'].includes(d.syncStatus), 'No live sync result in a preview');
  assert.equal(d.mapped['Device Serial Number'], source.serial);
  assert.equal(d.mapped['Device Asset Number'], source.asset);
  for (const [field, value] of [['Device Model', source.model], ['Device Oem', source.oem],
    ['Device IMEI', source.imei], ['Device UDID(No special Characters)', source.udid]]) {
    if (value) assert.equal(d.mapped[field], value, `${field} must match the source`);
  }
  const ownership = manifest.ownershipMap[source.ownership];
  if (ownership) assert.equal(d.mapped['Device Ownership(C/E/S/None)'], ownership);
  else assert.ok(!d.mapped['Device Ownership(C/E/S/None)'], 'Unmapped ownership must not acquire a mapping');
  const j = d.journal;
  assert.equal(j.sourceKey, d.oid);
  assert.equal(j.syncExecutionId, e.execution.id);
  assert.equal(j.finalized, true);
  assert.equal(j.status, 'preview');
  assert.deepEqual(j.operations, []);
  assert.deepEqual(j.before, j.after, 'Device must be unchanged');
  assert.deepEqual(j.beforeState, j.afterState, 'Successful projection must be unchanged');
  assert.deepEqual(d.snapshot, j.after, 'Fresh final snapshot must match finalized journal');
  assert.equal(d.snapshot.groupUuid, manifest.groupUuid);
  // Initial fixtures are registered devices; a changed target kind requires explicit review.
  assert.equal(d.snapshot.kind, 'registered');
  assert.equal(d.registeredCandidates.length, 1, 'One observed registration across OID/serial/IMEI/UDID searches');
  assert.deepEqual(d.enrolledCandidates, [], 'An enrolled representation needs explicit reconciliation before accepting this registered-device fixture');
  const dest = d.registeredCandidates[0];
  assert.equal(dest.group, manifest.groupName);
  assert.equal(dest.serial, source.serial);
  assert.equal(dest.asset, source.asset);
  const oidAttrs = dest.attributes.filter(a => ['oid', 'uuid', 'customattribute1'].includes(a.name.toLowerCase()));
  assert.equal(oidAttrs.length, 1, 'No conflicting/duplicate OID aliases');
  assert.equal(oidAttrs[0].name, manifest.attributeName);
  assert.ok(same(oidAttrs[0].value, source.oid));
  assert.equal(d.snapshot.fields.SerialNumber, source.serial);
  assert.equal(d.snapshot.fields.AssetNumber, source.asset);
  const snapshotAttrs = d.snapshot.attributes.filter(a => ['oid', 'uuid', 'customattribute1'].includes(a.name.toLowerCase()));
  assert.equal(snapshotAttrs.length, 1);
  assert.ok(same(snapshotAttrs[0].value, source.oid));
  assert.equal(d.statusRow.executionId, e.execution.id);
  assert.equal(d.statusRow.sourceKey, source.oid);
  assert.equal(d.statusRow.syncStatus, d.syncStatus);
  assert.equal(d.statusRow.verificationStatus, d.verificationStatus);
  assert.equal(d.statusRow.dryRun, true);
  assert.equal(d.statusRow.scope, 'preview');
  assert.equal(d.validation.syncStatus, d.syncStatus);
  assert.equal(d.validation.verificationStatus, d.verificationStatus);
  const issues = d.validation.checks.filter(c => c.result !== 'passed');
  assert.ok(d.validation.checks.length > 0);
  assert.deepEqual(d.validation.issues, issues);
  assert.deepEqual(d.validation.checks.filter(c => c.result === 'failed'), []);
  assert.equal(d.statusRow.hasIssues, issues.length > 0);
  assert.equal(d.verificationStatus, issues.length ? 'needs_attention' : 'passed');
  // Unknown API fields are deliberately still unverified, even with a known catalog definition.
  for (const [mapped, names] of [
    ['Device Model', ['Model']], ['Device Oem', ['Oem', 'Manufacturer', 'OEMInfo']],
    ['Device Ownership(C/E/S/None)', ['Ownership']],
  ]) {
    if (d.mapped[mapped]) {
      const actual = names.map(n => d.snapshot.fields[n]).find(v => v != null);
      if (actual == null) {
        assert.ok(d.validation.checks.some(c => c.name === mapped && c.result === 'unverified'), `${mapped} cannot silently pass`);
      } else {
        assert.equal(actual, d.mapped[mapped], `${mapped} must match the destination`);
      }
    }
  }
  if (!snapshotAttrs[0].namespace) {
    assert.ok(d.validation.checks.some(c => c.name === 'attribute_namespace' && c.result === 'unverified'));
  } else assert.equal(snapshotAttrs[0].namespace, manifest.applicationGroup);
}

export function assertOptionalIdentity(e, expected, field) {
  const source = e.sources.find(s => s.oid === expected.oid);
  const d = e.devices.find(x => x.oid === expected.oid);
  assert.ok(source[field], `Source ${field} is absent: no coverage for this case`);
  const candidates = [...d.registeredCandidates, ...d.enrolledCandidates].filter(x => same(x[field], source[field]));
  assert.equal(candidates.length, 1, `Exactly one observed destination must match source ${field}`);
  const aliases = field === 'imei' ? ['IMEI', 'Imei'] : ['UDID', 'Udid'];
  const actual = aliases.map(k => d.snapshot.fields[k]).find(Boolean);
  assert.ok(actual && same(actual, source[field]), `Fresh snapshot must expose matching ${field}`);
}
