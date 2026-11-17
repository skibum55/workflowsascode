export const manifest = Object.freeze({
  workflowId: 'p05Qkl8zYlkbgn1h',
  auditedVersionId: '69207ebf-cda6-4dfb-bbb5-955b5e29ca79',
  groupUuid: 'c270aea5-ee1c-4545-ac23-c4dd517509d5',
  groupId: 'dwpg8def338f33a82e7',
  groupName: 'VertoSM',
  attributeName: 'CustomAttribute1',
  applicationGroup: 'ApplicationGroup1',
  ownershipMap: { 'Supplier Owned': 'S' },
  devices: [
    { oid: '71ae57ab-fc5e-463a-ae35-52a33bba726b', serial: '00430535-J3600' },
    { oid: '60bdef86-02c0-4967-9291-df36fd3c4c4f', serial: '06281961' },
    { oid: '3ee1050f-0306-43c5-8a54-4430d459e63d', serial: 'J36XKZ1' },
  ],
});

export const mutationNodes = [
  'Execute journaled Omnissa operation',
  'Save pending operation',
  'Save final sync state',
];

export function safetySettings(settings) {
  const keys = ['dryRun', 'testMode', 'testApplyApproved', 'maxTestDevices',
    'testSourceOids', 'ownershipMap', 'udidSourceField', 'imeiSourceField'];
  return Object.fromEntries(keys.map(k => [k, settings?.[k] ?? null]));
}
