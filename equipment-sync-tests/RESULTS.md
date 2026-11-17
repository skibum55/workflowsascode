# Initial validation results — November 17, 2026

Target repository/branch: `skibum55/workflowsascode`, `rlc_n8n_workflows_tests` (base commit `93ceaa875c64a04e7a33e8295fb3130ec0c1a131`). This implementation was built and tested in an isolated local checkout, then prepared for commit to this branch. It has not been run inside your Codespace.

## Real n8n dry-run

- Execution **35909**, manual, technical status **success**.
- Started **2026-11-17 19:12:41.948 UTC**; finished **19:13:50.768 UTC**.
- Main workflow stayed **inactive**; `dryRun: true`, `testApplyApproved: false`.
- Workflow version stayed `69207ebf-cda6-4dfb-bbb5-955b5e29ca79`.
- Exactly the three authorized source OIDs were processed.
- No journaled Omnissa operation, pending-operation save, or final-sync-state save node executed.
- A separate MCP read of the three Sync State rows before/after showed exact equality, including timestamps.
- A separate MCP read found the persisted run status plus three device status rows with separate sync and verification statuses.
- No live device create/update/delete was performed. Cleanup required no action; n8n test audit records were retained.

| Serial | OID | Sync | Verification | n8n issues |
| --- | --- | --- | --- | ---: |
| 00430535-J3600 | 71ae57ab-fc5e-463a-ae35-52a33bba726b | unchanged | needs_attention | 4 |
| 06281961 | 60bdef86-02c0-4967-9291-df36fd3c4c4f | unchanged | needs_attention | 3 |
| J36XKZ1 | 3ee1050f-0306-43c5-8a54-4430d459e63d | unchanged | needs_attention | 4 |

The 11 n8n issues remain visible: Model/OEM and device attribute namespace are unverified for all three devices; one ownership field is unavailable; Purchase remains unmapped. Ownership mappings were not changed. The current attribute definition was refreshed within this run and uniquely matched `CustomAttribute1` / `ApplicationGroup1` in group 7870; that does not verify a device assignment namespace.

## Playwright results

`npm run test:all` against sanitized evidence from **35909**:

- **47 tests:** **38 passed**, **6 skipped**, **3 failed**.
- Passing tests: 5 dry-run/identity/cleanup safety checks and 33 harness/negative tests.
- Skips: these three Verto records have no IMEI or UDID. The six present-value integration cases remain untested; synthetic present/mismatch/duplicate cases passed.
- Failures: one full-acceptance test per device. These are real acceptance failures caused by missing evidence, not expected-failure annotations. The test process correctly exits with code 1.
- An earlier replay of baseline 35887 also passed its then-current safety/harness checks, with the same six conditional skips.

In addition to the n8n issues, full acceptance is blocked because the registered-device inventory response lacks completeness metadata. One matching registration was observed for each source, with no matching enrolled record in the complete enrolled response. No tenant-wide uniqueness claim is made.

## Scope limits and next steps

These Playwright runs used source/destination read responses saved in the real n8n execution, retrieved through MCP and projected into a sanitized fixture. This verifies the dry-run evidence with independent test assertions; it does not independently query current Verto/Omnissa APIs from Codespaces, prove a create/update operation, or validate cleanup of a live change.

The delivered public-API capture adapter has positive and negative harness tests, but still needs its first authenticated run from your Codespace with `N8N_API_KEY`. The suite checks emitted Data Table status-row payloads; the separate table read-back above was performed by the implementation session, not the Codespaces adapter.

Next: pull the branch in your Codespace, run the saved-evidence tests, configure the repository-scoped Codespaces secret, manually start a guarded n8n dry-run, capture that explicit execution ID, and review the downloadable report. Independent service reads, persisted-table read-back in the suite, completeness proof, authenticated automatic triggering, schedules, CI and live cleanup remain later phases. Keep the main workflow inactive and in dry-run until its live-update review is complete.
