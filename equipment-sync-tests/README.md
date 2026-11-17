# Verto → Omnissa Playwright validation (phase 1)

This API-only suite validates saved evidence from a **manually started dry-run** for exactly the three OIDs in `lib/manifest.mjs`. It never starts or deploys a workflow, activates a schedule, or writes to Verto/Omnissa. No browser installation is needed. Node.js 22 or newer is required.

The suite is isolated from the repository's existing browser tests, package dependencies and deployment Actions. Run the commands below from `equipment-sync-tests`, not the repository root.

## 1. Pull the suite into your Codespace

Open your Codespace for `skibum55/workflowsascode`. From the repository root, check your branch and working tree:

```bash
git branch --show-current
git status --short
```

If you have uncommitted work, preserve it before switching branches or pulling. Then obtain the suite:

```bash
git switch rlc_n8n_workflows_tests
git pull --ff-only origin rlc_n8n_workflows_tests
```

The files are under `equipment-sync-tests/`. No changes are required to root `package.json`, the root Playwright configuration, deployment scripts or GitHub Actions. Do not run the repository's deployment commands to run this suite.

```bash
cd equipment-sync-tests
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run test:acceptance
```

The default input is the sanitized manual dry-run **35909**, captured November 17, 2026 during this implementation. The earlier **35887** baseline is retained for comparison. Replay confirms the test harness and that saved evidence; it does **not** run a new workflow or read current device state. The HTML report labels the execution and its evidence origin.

`npm test` runs dry-run safety plus negative harness tests. Six IMEI/UDID integration cases are skipped when those values are absent from these Verto records; synthetic present/mismatch/duplicate cases exercise those assertions separately.

`npm run test:acceptance` deliberately fails for every device until all required verification evidence is available. Do not change these failures to expected failures, update snapshots to accept them, or treat a green safety run as full synchronization acceptance.

## 2. Connect read-only capture to n8n

In your GitHub account **Settings → Codespaces → Codespaces secrets**, create `N8N_API_KEY` and grant access to `skibum55/workflowsascode`. Stop and restart the Codespace to load the new secret. Use an n8n **public REST API key**, not an MCP token. Grant only workflow/execution read scopes where your edition supports scoped keys. Do not paste the key into chat, a command, source control, a report or this README.

Check that the environment variable is available without displaying its value:

```bash
node -e 'console.log(process.env.N8N_API_KEY ? "N8N_API_KEY is set" : "N8N_API_KEY is missing")'
```

Set this non-secret URL in the Codespace terminal:

```bash
export N8N_BASE_URL=https://oauth2test.manageddeployment.com
```

The capture adapter uses only:

- `GET /api/v1/workflows/p05Qkl8zYlkbgn1h`
- `GET /api/v1/executions/<explicit-id>?includeData=true`

It rejects all other paths and follows no redirects. It reads the workflow before and after fetching the execution, checks the audited version and safety settings, and stores only an allowlist projection. Raw workflow/execution responses, authentication outputs, headers and credential configurations are never saved. `private/`, generated reports and local secrets are ignored by Git. Reports still contain the designated device IDs; share them within the appropriate audience.

If the API is unavailable or execution data is redacted/pruned, capture fails. Ask the n8n administrator to enable the supported read API/saved manual execution data. Do not substitute an undocumented editor endpoint or export an entire workflow containing login inputs.

## 3. Start a new manual dry-run in n8n

Open **Verto Equipment Synchronization to Omnissa**, workflow `p05Qkl8zYlkbgn1h`. Before executing, confirm:

- Workflow remains **inactive/unpublished**; do not enable the schedule.
- `Sync settings`: `dryRun: true`, `testMode: true`, `testApplyApproved: false`, `maxTestDevices: 3`.
- `testSourceOids` contains only:
  - `71ae57ab-fc5e-463a-ae35-52a33bba726b` — `00430535-J3600`
  - `60bdef86-02c0-4967-9291-df36fd3c4c4f` — `06281961`
  - `3ee1050f-0306-43c5-8a54-4430d459e63d` — `J36XKZ1`
- Ownership mapping stays `{ "Supplier Owned": "S" }`; Purchase remains unmapped.
- No pinned data substitutes for real source reads or final snapshots.

Run the **complete workflow** from manual trigger **Inspect or run first sync**, rather than executing individual nodes. Wait for completion and copy its execution ID. n8n will write its normal test journals/status records during this dry-run; Verto and Omnissa device mutations must remain disabled.

## 4. Capture and validate that exact execution

```bash
export N8N_EXECUTION_ID=YOUR_NEW_EXECUTION_ID
npm run capture
export SYNC_EVIDENCE="private/execution-${N8N_EXECUTION_ID}.json"
npm test
npm run test:acceptance
```

Capture requires an explicit ID and rejects executions older than 24 hours, unfinished runs, a different workflow, non-manual runs, active workflows, live settings, changed ownership mapping and an unaudited workflow version. The allowlist/version guard is a review gate, not a live-execution approval switch. A later legitimate n8n edit requires a graph review before updating `auditedVersionId` in `lib/manifest.mjs`.

The capture command does not execute the workflow. There is intentionally no automatic trigger in phase 1. No API key is available to this delivered bundle; the public-API capture must first be exercised with your Codespaces secret. Local MCP evidence runs do not establish that your Codespace network/key/scopes work.

If capture saves a sanitized file and then fails a safety assertion, keep the file and run the reports against it to investigate. Never proceed to a live update because a capture failed. Configuration/network failures before evidence normalization produce a terminal error rather than a Playwright report.

## 5. Read/download the report

```bash
npm run report
```

Open port **9323** using Codespaces' **Ports** panel (add it if necessary), then choose **Open in Browser**; keep visibility **Private**. Press Ctrl+C in the terminal when finished serving the report. To download a portable report, archive the **whole** HTML report directory (including its attachment data):

```bash
zip -r playwright-report.zip reports/html reports/results.json reports/junit.xml
```

Download the ZIP using the Codespaces Explorer. Each test invocation replaces `reports/`; archive the safety report before running acceptance if you want both separately, or use `npm run test:all` to produce one combined report. The combined command exits nonzero for real acceptance failures.

## Coverage and interpretation

| Layer | Validates | Meaning of success |
| --- | --- | --- |
| Safety | Inactive audited workflow, dry-run flags, exact OID coverage, no device-write nodes, complete enrolled response count, fresh scoped attribute catalog, journal identity/finality, unchanged before/after device and state evidence, final snapshot and preserved issue reporting | The inspected execution meets the initial dry-run safety contract |
| Identity | Source OID/serial/asset compared independently to registered/enrolled inventory evidence and final snapshots; conflicting OID aliases and duplicate candidates fail | Exactly one matching registration is observed in the response, with no matching enrolled record for these registered fixtures |
| Conditional identity | IMEI/UDID matches and uniqueness when present; absent fixtures visibly skipped | No claim that missing source identifiers were exercised in integration |
| Acceptance | Required field and namespace evidence, verification status, registered inventory completeness | Every required result has evidence; currently fails on known gaps |
| Harness | Active/live/wrong-OID/duplicate/conflict/stale-catalog/changed-state failures, read-only client restrictions, no-op cleanup conflict gate, synthetic identifier cases, export secret exclusion | The checker detects the tested unsafe or incorrect evidence |

This first suite uses Verto/Omnissa responses **recorded within the selected n8n execution**. It does not yet make an independently authenticated, current Verto or Omnissa GET. It also compares the per-device status-row payload emitted by the checker; it does not independently read back persisted Data Table rows in Codespaces. Those are explicit next-phase coverage items.

Initial real evidence has three `syncStatus: unchanged` results and three `verificationStatus: needs_attention` results. Model/OEM and device attribute namespace remain unverified; one ownership field is unavailable, and Purchase remains unmapped. A successful definition lookup never proves a device assignment namespace. The registered inventory has no completeness metadata, so the suite does not claim complete-scope or tenant-wide uniqueness.

## 6. Controlled cleanup

Phase 1 creates/updates no devices, so cleanup is a verified **no-op**. Every journal must be dry-run/preview, finalized, with zero operations, zero blocked entries, no created device and no pending batch. Any conflicting evidence stops the checks and flags the device. There is no DELETE/restore function, and the suite retains the n8n audit records.

Before a future live-test phase, add run-owned resource IDs, a before/after change manifest, optimistic conflict checks, restoration verification and explicit live approval. Existing registrations must never be deleted just because their serial/OID is allowlisted. The current reset workflow cannot safely restore all existing registration Asset Number updates; resolve that limitation before permitting such test writes.

## 7. Track future changes in GitHub

The initial suite is committed on `rlc_n8n_workflows_tests`. After making future test changes, review and commit only this directory on your test branch:

```bash
git status --short
git add equipment-sync-tests
git diff --cached --stat
git diff --cached
git commit -m "Add read-only Verto Omnissa dry-run validation suite"
git push origin rlc_n8n_workflows_tests
```

Run those commands from the repository root. Do not commit `private/`, reports, API keys or raw workflow exports. No GitHub Action or schedule is added here. After manual evidence capture and report review, the same commands can be added first to a manual Actions job, then a schedule, and finally a CI gate. A future automatic dry-run trigger needs a separately reviewed authenticated execution path that preserves all safety guards.

References: [Playwright API testing](https://playwright.dev/docs/api-testing), [Playwright reporters](https://playwright.dev/docs/test-reporters), [n8n public API](https://docs.n8n.io/api/).
