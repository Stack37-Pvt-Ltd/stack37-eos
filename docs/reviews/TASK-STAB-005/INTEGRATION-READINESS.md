# STACK37 EOS — TASK-STAB-005 Integration Readiness

**Status:** Preparation complete; no integration performed. Awaiting CEO approval of the proposed procedure.\
**Scope:** Read-only review of the accepted TASK-STAB-004 and TASK-STAB-005B inventories, current branch/worktrees, root test configuration, and existing backend integration contracts.

## Executive assessment

The two accepted changes are recoverable and have a clear integration path, but they are not yet integrated. Both checkouts are at the same baseline commit `d17ed63a48e2313df0f5406d9074f9076b788721`. The main checkout contains Codex's uncommitted UI changes. The Antigravity worktree contains four modified project-memory documents and two untracked deliverables. Neither checkout has a unique commit to merge or cherry-pick.

There are **no overlapping application/runtime source files** in the TASK-STAB-005B change set. The main integration risks are four overlapping governance documents and the test's location/configuration. The canonical backend specification also exists in both trees with identical SHA-256 (`8C47230CAD6816EC58C58BE1D2E2CCADFCB49F1F4DE0FA54181A398F2630D8CA`).

The root test script already excludes nested `.worktrees/` paths and still discovers the root `tests/unit/` directory. Keep that root `package.json` during integration. Do not copy Antigravity's package file over it.

## Repository state inspected

- Main checkout: `C:\Users\nimth\Desktop\Developments\stack37-eos`
- Current branch: `feature/phase1-foundation`
- Main `HEAD`: `d17ed63a48e2313df0f5406d9074f9076b788721`
- Antigravity checkout: `.worktrees/backend-safeguards`
- Antigravity branch: `task-stab-005b`
- Antigravity `HEAD`: `d17ed63a48e2313df0f5406d9074f9076b788721`
- Both worktree entries have the same starting commit; the accepted work exists as local changes, not branch commits.
- Main root test command: `vitest run tests/unit/ --exclude "**/.worktrees/**"`.
- Main root unit suite before backend test transfer: 12 files / 170 passing tests.
- Antigravity's accepted evidence reports 12 unit files / 185 tests, including 19 security tests. Combining the shared baseline with the UI's four presentation tests and the security suite is expected to yield 189 tests, subject to actual post-integration run and avoiding duplicate files.

Antigravity worktree status, read only:

- Modified: `PROJECT_STATE.md`, `docs/DECISIONS.md`, `docs/DESIGN_STANDARDS.md`, `docs/TASKS.md`.
- Untracked: `docs/integration/backend_integration_readiness.md`, `tests/unit/backend-security-safeguards.test.ts`.
- No changed backend runtime actions, validations, tenant guard, proxy, migrations, or UI components were found in its working diff.

## Overlap and conflict assessment

| Paths / areas | Ownership | Risk and planned treatment |
|---|---|---|
| `PROJECT_STATE.md` | Both inventories | **High documentation conflict.** Antigravity's memory sync has updated phase/task facts; Codex's file records TASK-STAB-004 acceptance, the accepted frontend, hardening items and explicit TASK-STAB-005 authorization boundary. Reconcile both fact sets manually; retain CEO acceptance and preserve current UI evidence. |
| `docs/TASKS.md` | Both inventories | **High documentation conflict.** Merge Antigravity's TASK-STAB-005A/005B records and synchronized 001/002 status with Codex's accepted 004 record and the still-proposed 005 state. Do not allow an older `READY_FOR_REVIEW` statement for 004 to replace CEO acceptance. |
| `docs/DECISIONS.md` | Both inventories | **Medium documentation conflict.** Keep Antigravity's accepted strategic decisions while retaining Codex's UI decision and OQ-003 closure. Avoid dropping any CEO-approved decision rows. |
| `docs/DESIGN_STANDARDS.md` | Both inventories | **Medium documentation conflict.** Merge Antigravity's accepted design governance and Codex's implementation-specific tokens/reference. Preserve the actual approved HTML reference and its sharp buttons/horizontal navigation/no-sidebar direction. |
| `docs/integration/backend_integration_readiness.md` | Antigravity deliverable; identical copy already in main tree | **Low content conflict, duplicate untracked file.** Hashes match. Retain one canonical copy and verify its hash after integration. |
| `tests/unit/backend-security-safeguards.test.ts` | Antigravity deliverable | **Low source overlap.** New root test path does not collide with the existing 12 root test files. It imports existing backend contracts by relative `../../src/...` paths and should resolve correctly at `tests/unit/`. Once copied into root `tests/unit/`, the existing root script will discover it. |
| `package.json` | Codex change only | **Configuration conflict if overwritten.** Root script includes the `.worktrees` exclusion; Antigravity worktree script does not. Preserve root script and do not copy the worktree package file. |
| `src/app/`, `src/components/`, `src/lib/`, `src/proxy.ts`, `supabase/` | Codex frontend changes / shared baseline | No TASK-STAB-005B runtime changes were found. No runtime merge conflict is expected from the accepted backend safeguard inventory. |

The root `.worktrees/` entry in `git status` is Antigravity's nested checkout. It is not a TASK-STAB-004 deliverable and must never be staged as part of the root change set.

## Contract mismatches to carry into joint verification

No runtime contract mismatch was introduced by TASK-STAB-005B; its change inventory adds safeguards tests and memory/specification files, not server-action code. Existing source/specification qualifications remain:

1. **Registration plan name:** The specification describes the success plan as always `Standard`; source prefers Standard but falls back to the lowest-priced public plan if Standard is absent. UI uses the returned plan name. Review the commercial fallback under the deferred hardening item before paid launch.
2. **Settings resolver access:** The specification says unauthorized users receive `null`; source can return readonly configuration with `canEdit: false`. The current tenant guard precedes the route and both update actions independently check active Primary Owner status.
3. **Optional membership ID:** `getBusinessConfiguration` defaults `canEdit` to true if the optional membership ID is omitted. The current Settings route passes the verified membership ID, and save actions enforce owner authorization. Keep this recorded as deferred backend hardening.
4. Existing UI calls retain their current authentication, registration `{ name, slug, countryCode }`, workspace URL/switching, Settings payload/error, Headquarters ID and subscription display contracts. No change to these contracts is planned during file integration.

See `docs/reviews/TASK-STAB-004/BACKEND-HANDOFF-REVIEW.md` for full source comparisons.

## Proposed recoverable checkpoint strategy

No checkpoint or repository mutation was performed for this report. After the CEO approves the procedure:

1. Reconfirm both `HEAD` values and capture allow-listed tracked diffs from each checkout to backup patch files using `git diff --binary d17ed63a48e2313df0f5406d9074f9076b788721`. Separately archive allow-listed untracked files (not the nested `.worktrees/` directory), then record SHA-256 hashes. Store the backups outside both worktrees.
2. Create a dedicated integration branch from `d17ed63a48e2313df0f5406d9074f9076b788721`. Preserve TASK-STAB-004 as a checkpoint before bringing in TASK-STAB-005B. Use explicit path lists when staging; never use `git add .` or stage `.worktrees/`.
3. Transfer the accepted backend security test and the canonical integration specification (verify the known matching hash). Reconcile the four shared documentation files manually using the inventory above; do not wholesale overwrite either accepted state.
4. Keep the Antigravity worktree read-only throughout. Do not merge it as a branch: it has no new commit and its source changes are uncommitted. Copy only its accepted, inventoried deliverables to the integration branch after authorization.
5. Review the staged path list and diff; verify there are no unrelated files, backend implementation changes, secrets, generated build output, or nested worktree content before committing any checkpoint authorized by the CEO.
6. Run checks below. If a transfer or merge step fails, stop, preserve the failed branch for inspection, and restore the integration branch from the pre-integration checkpoint or reapply the verified backup patch/archive. Do not reset or clean either original checkout. Leave Antigravity's original worktree untouched.

Suggested read-only checkpoint commands for the later authorized session (paths are examples and must be confirmed before execution):

```powershell
git status --short
git rev-parse HEAD
git -C .worktrees/backend-safeguards status --short
git -C .worktrees/backend-safeguards rev-parse HEAD
git diff --binary d17ed63a48e2313df0f5406d9074f9076b788721
git -C .worktrees/backend-safeguards diff --binary d17ed63a48e2313df0f5406d9074f9076b788721
```

The patch outputs should be redirected to backup files only after the CEO authorizes the checkpoint step. They do not include untracked files; archive the two allow-listed backend deliverables separately. Do not run `git stash`, `git clean`, `git reset`, or checkout/discard commands against either worktree.

## Regression commands after authorized integration

Run from the main repository root, in this order:

```powershell
npm run test:unit
npm run typecheck
npm run lint
npm run build
```

Expected unit coverage after integration is the 170 current root tests plus the 19 safeguard tests (189 total), assuming no duplicate test files are transferred. The unit command must report the root `tests/unit/` suite and must not report `.worktrees/backend-safeguards/...` paths.

Additional integration suites exist:

```powershell
npm run test:db
npm run test:auth
```

**Do not run these as routine local tests.** Both target the configured Supabase project `xbiadendaxhoyrcvaybf`, create temporary users/organizations/plans and write fixture manifests; they require service credentials, `EOS_SERVER_TEST_AUTHORIZATION_FLAG=xbiadendaxhoyrcvaybf`, and `EOS_CONFIRM_NO_REAL_CUSTOMER_DATA=CONFIRMED_EMPTY_PRE_LAUNCH`. The auth suite also requires `EOS_RECOVERY_SECRET`. Their cleanup is destructive to those fixtures, and these commands were not run during preparation. They require separate approval and confirmation of a dedicated empty pre-launch environment. They must never be pointed at production/customer data.

The production build can require network access to retrieve the existing Geist Google Fonts. Previous final-gate verification passed when network access was available.

## Readiness decision

**Ready for CEO review of the proposed integration procedure; not yet ready to execute integration.** The change sets share a base, runtime file overlap is absent, the package test exclusion is correct, and the documentation/test transfer path is identified. The procedure intentionally pauses before any merge, copy into the main source tree, commit, live database test, or production operation until the CEO separately approves integration.
