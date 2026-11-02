# STACK37 EOS — Current Project State & Operational Snapshot

**Last updated:** November 2, 2026 (Asia/Colombo)
**Branch:** `codex/task-prod-login-001` (local isolated snapshot)
**Committed baseline:** `132e54a6bb303700eb132d6e967efbad82e3fda6`
**Current task:** `TASK-PROD-LOGIN-001` — Codex frontend phase READY_FOR_REVIEW in an isolated snapshot. Antigravity's central-host `/` → `/login` proxy correction remains separate and uncommitted. Current baseline still rewrites that host's root to `/registration`; combined root behavior is not verified until the backend-owned change is integrated under separate authorization. No UK Super files, migrations, commits, pushes, or deployments are part of this task.
**Evidence:** 195/195 unit tests, TypeScript, ESLint, production build and `git diff --check` pass in the isolated snapshot. Built login HTML contains the approved sign-in screen and logo. Direct runtime route requests and root redirect are not verified because this isolated snapshot has no Supabase environment and lacks Antigravity's proxy correction; no production request was made.

---

## Product and ownership

STACK37 EOS is commercially branded **My Business by STACK37**. Antigravity owns backend logic, data, authentication, authorization, migrations, and integrations. Codex owns approved UI/UX and frontend implementation. The CEO owns product scope and approvals, Git synchronization, database operations, and deployment.

The approved TASK-STAB-003 visual direction is recorded in [docs/DESIGN_STANDARDS.md](docs/DESIGN_STANDARDS.md) and its full reference in [docs/references/TASK-STAB-003-approved-design.html](docs/references/TASK-STAB-003-approved-design.html).

## Stabilization sequence

| Task | Current recorded status |
|---|---|
| TASK-STAB-001 Project control | SYNCHRONIZED in commit `823caab` |
| TASK-STAB-002 Foundation stabilization | SYNCHRONIZED in commit `d17ed63`; remote migrations were reported verified by Antigravity and not rechecked during this local integration |
| TASK-STAB-003 Design approval | ACCEPTED by CEO |
| TASK-STAB-004 Approved UI implementation | ACCEPTED by CEO after final quality gate (October 14, 2026) |
| TASK-STAB-005A Backend integration readiness | COMPLETED |
| TASK-STAB-005B Backend safeguards and memory update | ACCEPTED by CEO |
| TASK-STAB-005C Focused backend corrections | Integrated locally under CEO authorization; READY_FOR_REVIEW with 194 combined unit tests, TypeScript and ESLint passing |
| TASK-STAB-005 Integrated verification | IN_PROGRESS — local integration phase ACCEPTED by CEO (October 14, 2026); real database, RLS, rollback and authentication verification is DEFERRED / NOT EXECUTED |

Future product modules and milestones in [docs/ROADMAP.md](docs/ROADMAP.md) retain their existing scope and status. This snapshot does not authorize new ERP work.

## Existing capability evidence

The committed backend baseline contains authentication, email confirmation/recovery, subdomain tenant routing, business registration/provisioning, trial creation, and business settings actions. The handoff asserts migrations 01–12 are applied remotely; this task did not connect to Supabase or independently verify the remote schema.

TASK-STAB-004 adds a local visual implementation for existing workflows. It preserves server actions and the database boundary. Settings and authenticated workflow checks were exercised in local browser previews using mocked data/actions. These previews are not production end-to-end proof. The public application has not been inspected or deployed by this task.

Independent VAT and SSCL settings, team management, ERP operations, subscription checkout, and trial-expiry enforcement remain outside this implementation and are not represented as completed.

## Current working tree in the original TASK-STAB-005 snapshot

Changes are local and uncommitted on `codex/task-stab-005-integration`; baseline `d17ed63a48e2313df0f5406d9074f9076b788721` is unchanged. Separate verified file snapshots of TASK-STAB-004 and TASK-STAB-005B were created under `%TEMP%\STACK37-EOS-TASK-STAB-005-checkpoint-d75b476588e94232a867fceac526991e`; manifests and SHA-256 hashes are recorded in the TASK-STAB-005 integration report. The UI implementation is preserved. The 19 backend safeguard unit tests and checkpointed Version 1.0 verification plan are present in the main project. Four shared governance files were reconciled manually. Codex did not write to Antigravity's worktree. Its revised Version 2.0 plan remains a separate pending proposal at `.worktrees/backend-safeguards/docs/verification/TASK-STAB-005_backend_verification_plan.md`, as directed by the CEO; it has not replaced the integrated Version 1.0 or received execution authorization in this task.

The initial accepted integration did not change backend runtime behavior. The subsequent CEO-authorized TASK-STAB-005C integration imports only Antigravity's corrections in `src/lib/auth/business-config.ts` and `src/lib/actions/organization.ts`, plus three supporting unit-test files. The frontend, authentication, settings write actions, tenant guard, proxy, validations, migrations, database and live services are preserved. A further verified checkpoint of both worktrees precedes this import; see [corrections integration report](docs/reviews/TASK-STAB-005/CORRECTIONS-INTEGRATION-REPORT.md).

TASK-PROD-LOGIN-001 frontend changes are recorded separately in the isolated `codex/task-prod-login-001` snapshot. They are additive and do not replace or synchronize the original TASK-STAB-005 worktree described above.

## Verification

The CEO accepted the TASK-STAB-005 local integration phase on October 14, 2026: **189/189 unit tests across 13 files**, TypeScript, ESLint, production build, and `git diff --check` passed. Results and recovery evidence are preserved in [docs/reviews/TASK-STAB-005/INTEGRATION-REPORT.md](docs/reviews/TASK-STAB-005/INTEGRATION-REPORT.md). This acceptance does not complete the overall task or establish real database/authentication behavior.

Prior TASK-STAB-004 checks included 170 unit tests, TypeScript, ESLint, production build, frontend interaction/layout fixtures, and browser review at 375px and 1440px. Its evidence remains in [docs/reviews/TASK-STAB-004/REPORT.md](docs/reviews/TASK-STAB-004/REPORT.md) and [docs/reviews/TASK-STAB-004/FINAL-QUALITY-GATE.md](docs/reviews/TASK-STAB-004/FINAL-QUALITY-GATE.md).

After TASK-STAB-005C integration: **194/194 tests across 13 files**, TypeScript and ESLint pass. Registration success/error and Settings/Headquarters owner/readonly interactions were verified in the existing isolated browser fixture with mocked actions. These checks do not prove persistence, provisioning transactions or real sessions. The production build was not rerun for this correction task; the earlier successful build is historical evidence. Database-dependent security and authentication tests remain **DEFERRED / NOT EXECUTED**.

## Backend correction status and remaining hardening

- **Business Settings default and organization binding — IMPLEMENTED_LOCAL:** `canEdit` now defaults to false. The supplied membership must match the requested organization, be active and be Primary Owner. The current Settings route supplies its verified membership ID; write actions retain their independent owner checks. These two former deferred caveats are addressed by the imported correction.
- **Authenticated user binding — remaining verification:** The resolver does not add a direct `user_id` predicate or independent session lookup. The existing tenant guard, session client and RLS remain responsible for caller binding; real user/session/RLS verification is blocked. The broader proposed hardening in the separate revised plan is not implemented by this import.
- **Standard plan resolution — IMPLEMENTED_LOCAL:** Registration now returns an explicit failure before provisioning if the public Standard plan is missing or its lookup errors. It no longer selects an arbitrary price-sorted plan. Available Standard retains the existing seven-day trial workflow. Real plan configuration, trial persistence, entitlements and expiry remain unverified here.

## Remaining verification gates

- **Authorization:** Verify real active-owner, non-owner, suspended-member, cross-organization, and authenticated-user boundaries. The default and organization-binding corrections pass mocked tests; real caller binding and database enforcement remain unverified.
- **Subscriptions:** Confirm the configured Standard trial plan, seven-day trial creation, displayed subscription status, and actual entitlements against approved policy. The arbitrary fallback is removed; trial-expiry enforcement is not established by local integration.
- **RLS:** Verify real PostgreSQL isolation for organization, branch, settings, and audit data using an explicitly authorized isolated environment.
- **Transactions:** Verify atomic organization/Headquarters/membership/subscription provisioning, rollback on failure, and database constraints without partial records.
- **Authentication and workflows:** Verify real signup, confirmation, login, recovery, session/cookie behavior across workspace subdomains, organization switching, and Business Settings persistence/permissions.

**Current boundary:** Prior local integration is ACCEPTED; overall TASK-STAB-005 remains IN_PROGRESS. The CEO separately authorized local integration of the two TASK-STAB-005C corrections; that work is now READY_FOR_REVIEW. Real database/RLS/transaction/authentication checks are DEFERRED / NOT EXECUTED until actually run in an authorized environment. The revised verification proposal remains separate and pending. No commit, push, merge, rebase, deployment, production-service change, worktree deletion, further backend behavior or unrelated work is authorized. Both worktrees and all recovery/report evidence remain preserved.
