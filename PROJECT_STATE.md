# STACK37 EOS — Current Project State & Operational Snapshot

**Last updated:** October 15, 2026 (Asia/Colombo)
**Branch:** `codex/task-team-002-preview` at `03f3881` (based on `132e54a6bb303700eb132d6e967efbad82e3fda6`)
**Team integration baseline:** `132e54a6bb303700eb132d6e967efbad82e3fda6` (prior STAB integration baseline: `d17ed63a48e2313df0f5406d9074f9076b788721`)
**Current tasks:** `TASK-STAB-005` and `TASK-TEAM-001` — ACCEPTED for their local-only scopes under DEC-020. `TASK-TEAM-002` frontend Phase 1 — IN_PROGRESS for the CEO-requested November 16 Preview publication; the UI remains read-only for mutations because Preview shares Supabase with Production. Invitation acceptance and Migration 13 remain disabled/unapplied.
**Evidence:** Frontend Phase 1 passes 243 unit tests, TypeScript, ESLint, production build and mocked browser review at 375px and 1440px. Combined backend/frontend verification and real database, RLS, authentication, transaction, and employee workflow verification remain DEFERRED / NOT EXECUTED. No commit, push, merge, deployment, database change, migration or live mutation test was made.

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
| TASK-STAB-005 Integrated verification | ACCEPTED LOCAL-ONLY under DEC-020; real database, RLS, rollback/transactions and authentication verification DEFERRED / NOT EXECUTED before commercial deployment |
| TASK-TEAM-001 Team Management | ACCEPTED LOCAL-ONLY under DEC-020; backend and integration milestones were previously accepted under DEC-018 and DEC-019; database/security and complete employee workflow verification remain pending |

Future product modules and milestones in [docs/ROADMAP.md](docs/ROADMAP.md) retain their existing scope and status. This snapshot does not authorize new ERP work.

## Existing capability evidence

The committed backend baseline contains authentication, email confirmation/recovery, subdomain tenant routing, business registration/provisioning, trial creation, and business settings actions. The handoff asserts migrations 01–12 are applied remotely; this task did not connect to Supabase or independently verify the remote schema.

TASK-STAB-004 adds a local visual implementation for existing workflows. It preserves server actions and the database boundary. Settings and authenticated workflow checks were exercised in local browser previews using mocked data/actions. These previews are not production end-to-end proof. The public application has not been inspected or deployed by this task.

Independent VAT and SSCL settings, team management, ERP operations, subscription checkout, and trial-expiry enforcement remain outside this implementation and are not represented as completed.

## Current working tree

TASK-TEAM-002 frontend changes are uncommitted in `.worktrees/team-integration` on `codex/task-team-002-preview`; the original preview-host handoff file and pre-existing documentation changes were preserved. Antigravity's uncommitted changes remain in `.worktrees/team-002-backend` on `antigravity/task-team-002-backend`. Codex inspected that worktree read-only and did not synchronize it. The earlier TASK-STAB-005 branches and reports remain preserved; the root checkout contains its separate uncommitted local-only report and must be reconciled before any future synchronization.

The preview branch `codex/task-team-002-preview` at `03f3881` is published, with a READY Vercel Preview at [https://stack37-tv4j4r6y8-stack37.vercel.app](https://stack37-tv4j4r6y8-stack37.vercel.app). Antigravity's Phase 1 backend changes add trusted-host validation, explicit `/w/{tenantSlug}/...` routing, server-enforced preview mutation guards, and structured roster query failures. Codex's Phase 1 frontend implementation is locally READY_FOR_REVIEW in its separate worktree. It has not been integrated with the backend worktree or deployed. Vercel Preview and Production variables use the same Supabase integration; no database operation or live-data test has been made. Migration 13 remains unapplied and invitation acceptance disabled under DEC-021.

The initial accepted integration did not change backend runtime behavior. The subsequent CEO-authorized TASK-STAB-005C integration imports only Antigravity's corrections in `src/lib/auth/business-config.ts` and `src/lib/actions/organization.ts`, plus three supporting unit-test files. The frontend, authentication, settings write actions, tenant guard, proxy, validations, migrations, database and live services are preserved. A further verified checkpoint of both worktrees precedes this import; see [corrections integration report](docs/reviews/TASK-STAB-005/CORRECTIONS-INTEGRATION-REPORT.md).

On October 15 the CEO authorized Phase 1 frontend integration against Antigravity's finalized `/w/{tenantSlug}/...` contract, while keeping the two worktrees separate. The frontend passes `/settings/team` to the tenant guard as the public return subpath; the backend guard prefixes it for trusted Preview. The sole contract discrepancy found is that `getTeamRoster` returns only rows stored as `pending`, so the UI cannot include rows already stored as `expired` in its count. Production centralized sign-in remains the Phase 2 dependency. Vercel Deployment Protection and real-service authentication/data behavior remain unverified.

## Verification

The CEO accepted the TASK-STAB-005 local integration phase on October 14, 2026: **189/189 unit tests across 13 files**, TypeScript, ESLint, production build, and `git diff --check` passed. Results and recovery evidence are preserved in [docs/reviews/TASK-STAB-005/INTEGRATION-REPORT.md](docs/reviews/TASK-STAB-005/INTEGRATION-REPORT.md). The later local-only report was also approved under DEC-020. Neither approval establishes real database/authentication behavior; those checks remain a release gate.

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

**Current boundary:** Prior local integration and the CEO-directed local-only TASK-STAB-005 pass are ACCEPTED under DEC-020. TASK-STAB-005C corrections remain READY_FOR_REVIEW. TASK-TEAM-002 frontend Phase 1 is IN_PROGRESS for the CEO-requested Preview publication only. Real database/RLS/transaction/authentication checks are DEFERRED / NOT EXECUTED and mandatory before commercial deployment. No Production deployment, live mutation test, or backend behavior change is authorized. All worktrees and recovery/report evidence remain preserved.

**November 16 Preview publication claim:** The CEO requested publication of the completed TASK-TEAM-002 frontend Phase 1 changes to its non-production Preview. Codex claimed the isolated task worktree for a commit and Preview deployment only. The Team page will remain read-only for writes: its Preview and Production Supabase integration is shared, and enabling mutation controls/server actions is outside this publication task. No live data writes, migrations, Production deployment, or unrelated worktree changes are authorized.

## Team Management milestone acceptance

On October 14, 2026, the CEO accepted the **TASK-TEAM-001 backend implementation** under DEC-018, the **local integration milestone** under DEC-019, and then the **locally implemented Team Management task** under DEC-020. This is local-only acceptance. Real database and RLS behavior, real authentication, transaction/rollback behavior, and end-to-end employee workflows have not been verified. Invitation acceptance remains disabled; Migration 13 remains unapplied. The enhanced multi-business workspace selector remains deferred under DEC-017. TASK-STAB-005 was also accepted local-only under DEC-020. These acceptances do not authorize a commit, push, merge, deployment, database change, or new ERP task.
