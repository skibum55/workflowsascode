import fs from 'node:fs';
import path from 'node:path';
import { manifest, safetySettings } from './manifest.mjs';

const text = value => value == null ? '' : String(value).trim();
export const same = (a, b) => text(a).toLowerCase() === text(b).toLowerCase();
const pick = (value, keys) => Object.fromEntries(keys.map(k => [k, value?.[k] ?? null]));
export function nodeItems(runData, name) {
  return (runData?.[name] ?? []).flatMap(run => run.data?.main?.[0] ?? []).map(i => i.json);
}
const body = x => x.body ?? x;

export function sourceDevice(x) {
  return {
    oid: text(x.Oid), serial: text(x.EquipmentNumber), asset: text(x.AssetTag),
    imei: text(x.IMEI), udid: text(x.UDID),
    model: text(x.ModelCatalog?.value), oem: text(x.Manufacturer?.value),
    ownership: text(x.Ownership?.value),
  };
}
export function destinationDevice(x) {
  return {
    serial: text(x.SerialNumber), asset: text(x.AssetNumber),
    imei: text(x.IMEI ?? x.Imei), udid: text(x.UDID ?? x.Udid),
    group: text(x.OrganizationGroup ?? x.LocationGroupName),
    attributes: (x.CustomAttributes ?? []).map(a => ({
      name: text(a.Name ?? a.name), value: text(a.Value ?? a.value),
      namespace: text(a.ApplicationGroup ?? a.namespace),
    })),
  };
}
export function candidates(rows, source) {
  return rows.filter(d => same(d.serial, source.serial) ||
    (source.imei && same(d.imei, source.imei)) ||
    (source.udid && same(d.udid, source.udid)) ||
    d.attributes.some(a => ['oid', 'uuid', 'customattribute1'].includes(a.name.toLowerCase()) && same(a.value, source.oid)));
}

// Persist an allowlist projection, never the raw execution/workflow/auth responses.
export function normalizeEvidence(workflow, execution, { provenance = 'n8n-public-api', inspectedNodeNames } = {}) {
  const rd = execution.data?.resultData?.runData;
  if (!rd) throw new Error('Saved execution node data is unavailable. Enable saved manual execution data and rerun.');
  const cfg = workflow.nodes?.find(n => n.name === 'Sync settings');
  const sources = nodeItems(rd, 'Read selected Verto equipment').flatMap(x => {
    const result = body(x).result;
    return Array.isArray(result) ? result : result ? [result] : [];
  }).map(sourceDevice);
  const registeredResponses = nodeItems(rd, 'Read registered devices').map(body);
  const enrolledResponses = nodeItems(rd, 'Read enrolled devices').map(body);
  const registered = registeredResponses.flatMap(x => x.RegisteredDeviceInfoList ?? []).map(destinationDevice);
  const enrolled = enrolledResponses.flatMap(x => x.Devices ?? []).map(destinationDevice);
  const snapshots = nodeItems(rd, 'Read final device snapshot');
  const jobs = nodeItems(rd, 'Assess final device status');
  const catalog = nodeItems(rd, 'Review refreshed attribute catalog')[0];
  const summary = nodeItems(rd, 'Review run summary')[0];
  return {
    schemaVersion: 1, capturedAt: new Date().toISOString(), provenance,
    workflow: { id: workflow.id, active: workflow.active, versionId: workflow.versionId,
      settings: safetySettings(JSON.parse(cfg?.parameters?.jsonOutput ?? '{}')) },
    execution: pick(execution, ['id', 'workflowId', 'mode', 'status', 'startedAt', 'stoppedAt']),
    runSettings: safetySettings(nodeItems(rd, 'Sync settings')[0]),
    inspectedNodeNames: inspectedNodeNames ?? workflow.nodes.map(n => n.name),
    executedNodes: Object.keys(rd),
    inventory: {
      registeredResponsePresent: registeredResponses.length > 0 && registeredResponses.every(x => Array.isArray(x.RegisteredDeviceInfoList)),
      registeredCount: registered.length,
      // This API response lacks Total/pagination metadata: never assert complete scope from its length.
      registeredCompleteness: 'unverified',
      enrolledResponsePresent: enrolledResponses.length > 0 && enrolledResponses.every(x => Array.isArray(x.Devices)),
      enrolledCount: enrolled.length,
      enrolledTotal: enrolledResponses[0]?.Total ?? null,
    },
    catalog: catalog ? pick(catalog, ['refreshedAt', 'complete', 'groupNumericId', 'totalDefinitions', 'matchingDefinitions']) : null,
    summary: summary ? pick(summary, ['executionId', 'dryRun', 'scope', 'totalDevices', 'syncStatus', 'verificationStatus', 'hasIssues', 'issues', 'missing', 'unexpected', 'duplicated', 'requiresFailure']) : null,
    sources,
    devices: jobs.map(j => {
      const source = sources.find(s => same(s.oid, j.sourceKey));
      const journal = j.journalRow?.record_object ? JSON.parse(j.journalRow.record_object) : null;
      return {
        oid: j.sourceKey, serial: j.serialNumber, dryRun: j.dryRun,
        syncStatus: j.syncStatus, verificationStatus: j.verificationStatus,
        mapped: j.mapped, validation: j.validation,
        journal: journal ? pick(journal, ['sourceKey', 'syncExecutionId', 'status', 'dryRun', 'createdByRun',
          'operations', 'before', 'after', 'beforeState', 'afterState', 'finalized', 'pendingBatch', 'blocked']) : null,
        snapshot: snapshots.find(s => same(s.context?.sourceKey, j.sourceKey))?.snapshot ?? null,
        registeredCandidates: source ? candidates(registered, source) : [],
        enrolledCandidates: source ? candidates(enrolled, source) : [],
        statusRow: j.statusRow ? pick(j.statusRow, ['executionId', 'sourceKey', 'syncStatus', 'verificationStatus', 'outcome', 'hasIssues', 'dryRun', 'scope']) : null,
      };
    }),
  };
}

export function loadEvidence() {
  const file = process.env.SYNC_EVIDENCE ?? 'fixtures/dry-run-35909.json';
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

export function cleanupPlan(evidence) {
  const conflicts = evidence.devices.filter(d => !d.journal ||
    d.journal.dryRun !== true || d.journal.createdByRun !== false ||
    d.journal.operations?.length !== 0 || d.journal.pendingBatch !== false ||
    d.journal.blocked?.length !== 0 || d.journal.status !== 'preview');
  return conflicts.length ? { action: 'stop_and_flag', conflicts: conflicts.map(d => d.oid) } :
    { action: 'no_changes_to_clean', conflicts: [] };
}

export function acceptanceGaps(evidence, device) {
  const gaps = (device.validation?.issues ?? []).map(i => `${i.name}: ${i.result}`);
  if (device.verificationStatus !== 'passed') gaps.push(`verificationStatus=${device.verificationStatus}`);
  if (evidence.inventory.registeredCompleteness !== 'verified') gaps.push('Registered inventory completeness unverified');
  return gaps;
}
