# STACK37 EOS — Current Project State & Operational Snapshot

**Last updated:** November 16, 2026 (Asia/Colombo)
**Branch:** `codex/task-uk-super-004-ops` (UK Super candidate; see task release plan)
**Committed baseline:** `fccdefcc9217bfaac671eaf55694ffc55d2cda8b` (Retail data and category navigation correction)
**Current task:** `TASK-UK-SUPER-004` — READY_FOR_REVIEW for the Preview correction; signed-in review and Production release gates remain open.
**Evidence:** 198/198 local unit tests across 13 files, TypeScript, scoped ESLint, git diff check pass. No UK Super changes or migrations included. Zero commits, pushes, or deployments.

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
| TASK-STAB-005 Integrated verification | ACCEPTED — CEO approved the local-only report; real database, RLS, rollback and authentication verification remains an open release gate |
| TASK-PROD-LOGIN-001 Production login screen & routing | READY_FOR_REVIEW — Backend routing correction complete (`src/proxy.ts` redirects `mybusiness.stack37.com/` to `/login`, preserving tenant subdomains and direct `/registration`; 198 unit tests passing) |

Future product modules and milestones in [docs/ROADMAP.md](docs/ROADMAP.md) retain their existing scope and status. This snapshot does not authorize new ERP work.

## Existing capability evidence

The committed backend baseline contains authentication, email confirmation/recovery, subdomain tenant routing, business registration/provisioning, trial creation, and business settings actions. The handoff asserts migrations 01–12 are applied remotely; this task did not connect to Supabase or independently verify the remote schema.

TASK-STAB-004 adds a local visual implementation for existing workflows. It preserves server actions and the database boundary. Settings and authenticated workflow checks were exercised in local browser previews using mocked data/actions. These previews are not production end-to-end proof. The public application has not been inspected or deployed by this task.

Independent VAT and SSCL settings, team management, ERP operations, subscription checkout, and trial-expiry enforcement remain outside this implementation and are not represented as completed.

## Current working tree

The prior integration and corrections are now preserved in local commit `132e54a`; the earlier baseline `d17ed63a48e2313df0f5406d9074f9076b788721` remains in history. This local-only pass changes only the task register, this snapshot, and its verification report, without a commit or push. Separate verified file snapshots of TASK-STAB-004 and TASK-STAB-005B were created under `%TEMP%\STACK37-EOS-TASK-STAB-005-checkpoint-d75b476588e94232a867fceac526991e`; manifests and SHA-256 hashes are recorded in the TASK-STAB-005 integration report. The UI implementation is preserved. The 19 original backend safeguard unit tests and checkpointed Version 1.0 verification plan are present in the main project. Four shared governance files were reconciled manually. Codex did not write to Antigravity's worktree. Its revised Version 2.0 plan remains a separate pending proposal at `.worktrees/backend-safeguards/docs/verification/TASK-STAB-005_backend_verification_plan.md`, as directed by the CEO; it has not replaced the integrated Version 1.0 or received execution authorization in this task.

The initial accepted integration did not change backend runtime behavior. The subsequent CEO-authorized TASK-STAB-005C integration imports only Antigravity's corrections in `src/lib/auth/business-config.ts` and `src/lib/actions/organization.ts`, plus three supporting unit-test files. The frontend, authentication, settings write actions, tenant guard, proxy, validations, migrations, database and live services are preserved. A further verified checkpoint of both worktrees precedes this import; see [corrections integration report](docs/reviews/TASK-STAB-005/CORRECTIONS-INTEGRATION-REPORT.md).

## Verification

The CEO accepted the TASK-STAB-005 local integration phase on October 14, 2026: **189/189 unit tests across 13 files**, TypeScript, ESLint, production build, and `git diff --check` passed. Results and recovery evidence are preserved in [docs/reviews/TASK-STAB-005/INTEGRATION-REPORT.md](docs/reviews/TASK-STAB-005/INTEGRATION-REPORT.md). This acceptance does not complete the overall task or establish real database/authentication behavior.

Prior TASK-STAB-004 checks included 170 unit tests, TypeScript, ESLint, production build, frontend interaction/layout fixtures, and browser review at 375px and 1440px. Its evidence remains in [docs/reviews/TASK-STAB-004/REPORT.md](docs/reviews/TASK-STAB-004/REPORT.md) and [docs/reviews/TASK-STAB-004/FINAL-QUALITY-GATE.md](docs/reviews/TASK-STAB-004/FINAL-QUALITY-GATE.md).

After TASK-STAB-005C integration: **194/194 tests across 13 files**, TypeScript and ESLint pass. Registration success/error and Settings/Headquarters owner/readonly interactions were verified in the existing isolated browser fixture with mocked actions. These checks do not prove persistence, provisioning transactions or real sessions. The production build was not rerun for this correction task; the earlier successful build is historical evidence. Database-dependent security and authentication tests remain **DEFERRED / NOT EXECUTED**.

The CEO-directed local-only verification pass on October 14, 2026 reran **194/194 tests across 13 files**, TypeScript, scoped ESLint, and a production build successfully. A local production server returned HTTP 200 for login, register, and confirmation pages on the required `mybusiness.localhost` host. An unscoped ESLint scan was interrupted while traversing nested worktrees; browser automation was unavailable, so neither is claimed as a pass. The CEO approved the [LOCAL-ONLY-VERIFICATION.md](docs/reviews/TASK-STAB-005/LOCAL-ONLY-VERIFICATION.md) report in this conversation. No staging or live database test was run.

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

**Current boundary:** Prior local integration and the CEO-directed local-only TASK-STAB-005 pass are ACCEPTED. TASK-STAB-005C corrections remain READY_FOR_REVIEW. Real database/RLS/transaction/authentication checks are DEFERRED / NOT EXECUTED and remain mandatory before commercial deployment. The revised verification proposal remains separate and pending. This pass made no commit, push, merge, rebase, deployment, production-service change, worktree deletion, or backend behavior change. All worktrees and recovery/report evidence remain preserved. This acceptance does not authorize Migration 13, deployment, or a new ERP task.

## UK Super inventory task (November 6, 2026)

The UK Super inventory review UI and product-draft staging integration are packaged on branch `codex/task-uk-super-002-integration`, based on the pushed TASK-SYNC-001 baseline. The local UI was accepted by the CEO; this branch is awaiting review. Hosted UK Super currently has 2,079 staged drafts, 395 flagged rows, zero published products, and no imported stock. This branch push does not apply migrations or publish products.

The Vercel Preview environment may share the hosted Supabase project. No app-wide read-only guard has been verified; an authenticated draft edit in Preview could update an existing UK Super draft. The CEO explicitly authorized pushing the exact-host routing fix on November 6 after receiving this information. No inventory edits, database migrations, merge to `main`, or production deployment are included.

Vercel created a Preview for the UK Super branch. Its first build failed because the candidate omitted the demo-only supermarket-demo component imported by the UK Super route. A follow-up commit added that component and the Preview build became READY. The new exact-host routing change is now being pushed; verify its Preview deployment and route before review.

## TASK-UK-SUPER-004 retail operations candidate (November 15, 2026)

CEO reassigned this implementation to Codex. The isolated branch `codex/task-uk-super-004-ops` contains candidate retail data loading, branch-level POS and inventory actions, employee role/branch assignment, invitation handling, and proposed migrations 15/16. The retail UI no longer displays demo sales or sample products. Product drafts remain staged; imported stock is initialized to zero until physically counted.

Local verification: TypeScript passed; 265/265 unit tests across 17 files passed; scoped ESLint and `git diff --check` passed on the committed candidate. PGlite tests executed Migrations 15 and 16 in memory and verified invitation/acceptance, sale/stock/idempotency/dashboard/audit/role-seeding paths. Auth/permission helpers were stubs, not real Supabase RLS/JWT proof. The approved Geist faces are self-hosted with `next/font/local` and their SIL OFL license. The production build compiles and typechecks but fails during Windows generated-route output with `EPERM` while creating directories under `.next`. Docker Desktop cannot start (missing `SOFTWARE\\Docker Inc\\Docker Desktop` registry key); its per-user repair installer exited `-5`. The Supabase CLI is not installed. An isolated Supabase branch was quoted at $0.01344/hour and the CEO declined its creation.

**TASK-UK-SUPER-004 frontend correction is READY_FOR_REVIEW (2026-11-16).** The Retail branch relation error is fixed by normalizing Supabase's many-to-one object result. The category-specific Retail & E-Commerce tab is fixed by passing categoryName through the workspace frame. Verification: 270/270 unit tests, TypeScript, scoped ESLint, and diff check pass. Preview deployment `dpl_6rm1CyvecuszVbtL76rUgDfmGxqt` for commit `fccdefc` is READY; its unauthenticated Retail route returns the sign-in page as expected. Signed-in verification is still needed. `mybusiness.stack37.com` is assigned to Production deployment `dpl_3fKc8z73hHX7WzrtGwSZB49tmzuR` (commit `0d7a2fe`), which currently returns 404 at `/w/uk-super`; Production has not been changed. Remaining production release gates are open. See [the release plan](docs/reviews/TASK-UK-SUPER-004/IMPLEMENTATION-AND-LIVE-RELEASE-PLAN.md).
