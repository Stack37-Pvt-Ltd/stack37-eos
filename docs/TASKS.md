# STACK37 EOS — Task Register & Agent History

**Product:** STACK37 EOS / My Business by STACK37  
**Governance:** Chief Executive Officer, STACK37 (Pvt) Ltd  
**Document Status:** Live Operational Task Register  

---

## 1. Multi-Agent Concurrency & Concurrency Rules

To ensure seamless collaboration across **Google Antigravity** (Backend Owner), **ChatGPT Codex** (Frontend/UI Owner), and **ChatGPT** (Product Coordination):

1. **Mandatory Task Authorization:** An agent may ONLY work on a task with status `AUTHORIZED`. No spontaneous or unapproved tasks are permitted.
2. **Comprehensive Task Record Definition:** Every task record must explicitly define:
   - **Task ID:** Unique identifier (`TASK-xxx`).
   - **Owner:** Designate either `Google Antigravity`, `ChatGPT Codex`, or `Joint`.
   - **Scope:** Detailed engineering boundaries.
   - **Expected Customer Result:** Business and user outcome.
   - **Files / Areas Affected:** Target files or directories.
   - **Acceptance Criteria:** Verifiable conditions for completion.
3. **Integration Requirements Prerequisite:** Before implementing dependent work across frontend and backend, both agents must document integration requirements (schemas, signatures, payload models) in the active task record.
4. **No Overwriting Uncommitted Work:** Agents must NEVER overwrite, reset (`git reset`, `git checkout .`), or discard another agent's uncommitted changes.
5. **Parallel Work Protocol (Branches & Worktrees):** A task-register entry alone is not a technical file lock. When parallel work is necessary, agents must operate on **separate Git branches or worktrees** and follow an approved integration procedure.
6. **Task Traceability:** All Git commits and database migrations must cite their approved Task ID in their commit messages and migration comments.
7. **Task Lifecycle Statuses:**
   - `PROPOSED`: Drafted task awaiting CEO authorization.
   - `AUTHORIZED`: Approved by the CEO; ready to be claimed.
   - `IN_PROGRESS`: Actively claimed by the designated agent.
   - `READY_FOR_REVIEW`: Completed locally with test verification and change report; awaiting CEO review.
   - `ACCEPTED`: Formally reviewed, verified, and signed off by the CEO.

---

## 2. Active & Sequential Stabilization Tasks

| Task ID | Task Title | Owner | Priority | Status | Files / Areas Affected |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TASK-STAB-001** | **Project Control System Stabilization**<br>Establish permanent cross-agent governance, responsibility policy, and master roadmap ingestion. | Google Antigravity | P0 | **SYNCHRONIZED** | `AGENTS.md`<br>`PROJECT_STATE.md`<br>`docs/*`<br>`docs/references/*`<br>*(Commit `823caab`)* |
| **TASK-STAB-002** | **Foundation Stabilization & Git Sync**<br>Reconcile Phase 3C.3 files, verify remote migrations 11 & 12, run test regression, and commit to Git. | Google Antigravity | P0 | **SYNCHRONIZED** | `src/lib/actions/`<br>`src/lib/validations/`<br>`supabase/migrations/`<br>`tests/unit/`<br>*(Commit `d17ed63`)* |
| **TASK-STAB-003** | **UI/UX Design Approval**<br>Corporate identity and responsive design exploration approved by CEO in the Codex conversation. | ChatGPT Codex & CEO | P0 | **ACCEPTED** | Approved Codex design exploration |
| **TASK-STAB-004** | **Existing Interface Alignment**<br>Apply the approved design to existing workflows. | ChatGPT Codex | P0 | **ACCEPTED** | Frontend pages/components, brand asset, email visual drafts, task/design records |
| **TASK-STAB-005A** | **Backend Integration Readiness**<br>Authoritative integration specification and API contracts. | Google Antigravity | P0 | **COMPLETED** | `docs/integration/backend_integration_readiness.md` |
| **TASK-STAB-005B** | **Backend Safeguards & Memory Update**<br>Targeted security tests and project-memory synchronization. | Google Antigravity | P0 | **ACCEPTED** | `tests/unit/backend-security-safeguards.test.ts`<br>`docs/integration/*`<br>`docs/verification/*`<br>Project memory files |
| **TASK-STAB-005C** | **Focused Backend Corrections**<br>Integrate approved Settings permission and Standard trial-plan corrections. | Antigravity author; Codex integration | P0 | **READY_FOR_REVIEW — INTEGRATED_LOCAL** | Two backend files, three unit-test files, corrections integration report |
| **TASK-STAB-005** | **Integrated Verification**<br>Joint verification across backend safeguards and aligned UI; real database/authentication gates pending. | Joint (Antigravity + Codex) | P0 | **IN_PROGRESS — LOCAL PHASE ACCEPTED** | Local frontend/backend files, unit tests, governance and verification records |
| **TASK-PROD-LOGIN-001** | **Central Production Login Portal**<br>Replace starter landing page with the approved sign-in experience. | ChatGPT Codex (frontend; Antigravity routing contract) | P0 | **READY_FOR_REVIEW — FRONTEND PHASE** | root redirect, local Geist fonts, route test, task/state/review records |

*Note: Milestone 2 (Team Collaboration) and all ERP modules are blocked until Tasks STAB-001 through STAB-005 are accepted.*

---

## 3. Active Task Records

### TASK-STAB-001: Project Control System Stabilization
* **Owner:** Google Antigravity (Backend Owner)
* **Status:** `SYNCHRONIZED` (Committed and pushed to `feature/phase1-foundation` as Commit `823caab`)
* **Scope:**
  - Codify CEO-approved Agent Responsibility Policy in `AGENTS.md` and `PROJECT_STATE.md`.
  - Ingest authoritative `STACK37_EOS_Development_Master_Roadmap_v1.pdf` at `docs/references/`.
  - Establish permanent records: `PRODUCT_SCOPE.md`, `FEATURES.md`, `ROADMAP.md`, `DECISIONS.md`, `TASKS.md`, `DESIGN_STANDARDS.md`.
  - Enforce honest evidence classification, sequential development priorities, and parallel work rules.
  - Document integration contract requirements and task traceability rules.
  - Preserve all Phase 3C.3 changes; separate governance from application code in Git history.
* **Evidence:** Commit `823caab` synchronized to `origin/feature/phase1-foundation`.
* **Expected Customer Result:** Completely stable, shared project memory across AI agents and human developers, eliminating regressions, unapproved changes, and conflicting edits.
* **Files Affected:**
  - `AGENTS.md`
  - `PROJECT_STATE.md`
  - `docs/PRODUCT_SCOPE.md`
  - `docs/FEATURES.md`
  - `docs/ROADMAP.md`
  - `docs/DECISIONS.md`
  - `docs/TASKS.md`
  - `docs/DESIGN_STANDARDS.md`
  - `docs/references/STACK37_EOS_Development_Master_Roadmap_v1.pdf`
* **Acceptance Criteria:**
  1. Documentation accurately codifies the permanent division of responsibilities (Antigravity: Backend; Codex: Frontend/UI; ChatGPT: Product Coordination; CEO: Final Authority).
  2. Master roadmap PDF ingested at `docs/references/STACK37_EOS_Development_Master_Roadmap_v1.pdf` and verified clean.
  3. All Phase 3C.3 code preserved intact.
  4. Ready for synchronization as Commit A.

---

### TASK-STAB-002: Foundation Stabilization & Git Synchronization
* **Owner:** Google Antigravity (Backend Owner)
* **Status:** `SYNCHRONIZED` (Committed and pushed to `feature/phase1-foundation` as Commit `d17ed63`)
* **Scope:**
  - Reconcile local uncommitted files from Phase 3C.3: `src/app/tenant/[tenantSlug]/settings/page.tsx`, `src/components/tenant/business-configuration-form.tsx`, `src/lib/actions/organization.ts`, `src/lib/validations/organization.ts`, `src/lib/auth/business-config.ts`, `supabase/migrations/11`, `supabase/migrations/12`.
  - Verify remote Supabase database (`xbiadendaxhoyrcvaybf`) migration history.
  - Run complete unit test suite (`npm run test:unit`) and TypeScript typecheck (`npm run typecheck`).
  - Stage, commit, and push Phase 3C.3 files under CEO authorization with commit message referencing `TASK-STAB-002`.
* **Evidence:** Commit `d17ed63` synchronized to `origin/feature/phase1-foundation`; remote migration state was reported verified by Antigravity and was not rechecked in this local integration.
* **Expected Customer Result:** Fully synchronized, stable Git foundation with zero dirty working-tree state, ready for frontend UI/UX alignment.
* **Files Affected:**
  - `src/app/tenant/[tenantSlug]/layout.tsx`
  - `src/app/tenant/[tenantSlug]/page.tsx`
  - `src/app/tenant/[tenantSlug]/settings/page.tsx`
  - `src/components/tenant/business-configuration-form.tsx`
  - `src/lib/actions/organization.ts`
  - `src/lib/validations/organization.ts`
  - `src/lib/auth/business-config.ts`
  - `supabase/migrations/20261010000011_11_business_setup_and_configuration.sql`
  - `supabase/migrations/20261010000012_12_headquarters_provisioning_fix.sql`
  - `tests/unit/business-configuration.test.ts`
  - `tests/unit/workspace-provisioning.test.ts`
* **Acceptance Criteria:**
  1. Working tree is clean (`git status` shows clean).
  2. All 166 unit tests pass.
  3. Commit pushed to `origin/feature/phase1-foundation` with explicit CEO authorization.

---

### TASK-STAB-003: UI/UX Design Approval
* **Owner:** ChatGPT Codex (Frontend/UI Owner) & CEO
* **Status:** `ACCEPTED` (CEO approved the actual Codex mockup in this conversation on October 13, 2026)
* **Scope:**
  - Present official STACK37 corporate visual identity assets (corporate logo, navy typography, blue/violet palette).
  - Present design guidelines for application layouts, headers, sidebars, forms, and cards.
  - Review and obtain formal CEO approval for the unified visual design standard.
* **Expected Customer Result:** Formally approved, unified design language reflecting STACK37's premium corporate identity.
* **Files Affected:** Design specifications, `docs/DESIGN_STANDARDS.md`.
* **Acceptance Criteria:**
  1. CEO explicitly reviews and approves design system.
  2. Deprecated placeholder branding (emerald green, "37" badges) formally superseded.

---

### TASK-STAB-004: Existing Interface Alignment
* **Owner:** ChatGPT Codex (Frontend/UI Owner)
* **Status:** `ACCEPTED` (CEO acceptance after successful final quality gate, October 14, 2026)
* **Baseline verified:** Clean branch `feature/phase1-foundation`, HEAD and local origin reference `d17ed63` (Business Settings baseline); governance commit `823caab`. Existing status text for STAB-001/002 predates synchronization. CEO reports stabilization completed; this task does not re-audit the live database.
* **Approved reference:** `C:/Users/nimth/.codex/visualizations/2026/10/13/01a1356f-f00b-7150-afc2-b60388893ace/stack37-ui-exploration.html`. Official logo, Geist, concise copy, white/pale blue-grey surfaces, navy square buttons, blue/violet accents, horizontal workspace navigation.
* **Integration contract preserved:** Existing auth actions; `createBusinessAction({name, slug, countryCode})`; settings actions, payloads, validation/errors; tenant guards, workspace URL helpers, and resolver data remain authoritative. Owner edit permissions, HQ identifiers, trial display, and human-confirmation email flow remain intact. No backend file was modified.
* **TASK-STAB-005A handoff reviewed:** Compared the supplied shared copy, canonical repository specification at `docs/integration/backend_integration_readiness.md`, and source code. Details and qualifications are in `docs/reviews/TASK-STAB-004/BACKEND-HANDOFF-REVIEW.md`. The canonical specification correctly states structured settings action errors, the optional-but-unused registration `categoryId`, and alphabetical branch fallback; the shared copy contained earlier inaccuracies including an HTTP 403 claim and wrong recovery-cookie name. The action also falls back from Standard to the lowest-priced public plan when Standard is missing.
* **Claim / frontend file scope:** `src/app/globals.css`, `src/app/layout.tsx`, existing page presentation under `src/app/`, `src/components/auth/*`, `src/components/organization/*`, `src/components/tenant/*`, `src/components/ui/*`, new brand/navigation presentation components, `public/stack37-logo.webp`, draft email assets under `docs/email-templates/`, frontend verification files, and task/state/design/roadmap/decision/review records. No backend, schema, migration, guard, proxy, authentication-security, or live service files changed.
* **Scope:**
  - Align existing authentication pages, tenant layout, dashboard, and settings screens to the approved UI/UX design.
  - Replace temporary styling with approved navy typography and blue/violet styling.
  - Verify responsive behavior across all screens down to 375px mobile width.
  - Ensure backend contracts and actions are preserved without alterations.
* **Expected Customer Result:** High-trust, cohesive user interface across all existing screens.
* **Files Affected:** `src/app/`, `src/components/`.
* **Acceptance Criteria:**
  1. Approved design direction applied consistently to existing screens and shared patterns.
  2. Zero backend action or business logic changes.
  3. Browser verified at 375px and 1440px; form/navigation behavior reviewed with local mocked actions.
  4. Evidence and known integration limitations documented; task awaits CEO review.
* **Completion evidence (October 14, 2026):** 170 project unit tests pass when excluding the unrelated nested `.worktrees/` checkout; TypeScript, scoped ESLint, and production build pass. Local review fixture interactions covered login/signup validation, confirmation click-only behavior, forgot/reset flows, business registration slug/trial states, organization switching, workspace navigation, settings saves/errors/readonly, and HQ save paths with mocked action responses. Responsive screens checked at 375px and 1440px. This is not live backend or production workflow verification.
* **Handoff qualifications:** The permanent repository specification corrects errors in the CEO-supplied shared copy: settings failures are structured action results, not HTTP 403; the recovery cookie is `sb-recovery-token`; create-business registration does not pass optional `categoryId`; branch fallback is alphabetical. Source code additionally falls back to the lowest-priced public plan if Standard is unavailable; `getBusinessConfiguration` returns readonly data to non-owners, and resolver permissions are IDs rather than codes. It also defaults `canEdit` to true if called without its optional membership ID; the actual settings page passes the verified membership ID and both actions re-check active Primary Owner authorization. Remote migrations and live RLS were not verified during this frontend task.
* **Final quality gate (October 14, 2026):** Root `test:unit` now excludes `**/.worktrees/**`; its 12 files / 170 tests pass, and all four required commands (unit tests, typecheck, ESLint, production build) pass. The earlier five security-test failures occurred before assertions while request-store mocks (`cookies()` for three recovery cases, `headers()` for two confirmation cases) yielded no `.get` store. They are not reproducible now: the isolated suite currently has the relevant mocks and all 19 tests pass. Root discovery previously included duplicate test files from that separate Git worktree. The historical mock failure's exact trigger is unconfirmed; no application security defect is established. No worktree file or security assertion was changed. See [final quality gate report](reviews/TASK-STAB-004/FINAL-QUALITY-GATE.md) for details.
* **CEO acceptance:** The CEO accepted TASK-STAB-004 after the final quality gate. All approved frontend changes and the backend handoff and quality-gate reports are preserved. No commit, push, merge, deployment, or live-service modification is authorized by this acceptance.
* **Deferred hardening items:** (1) Strengthen the optional membership-ID contract so omission cannot produce `canEdit: true`; the current Settings route supplies the verified ID and write actions enforce active Primary Owner access. (2) Review the lowest-priced-public-plan fallback when Standard is absent against the approved plan policy; the fallback selects a plan but is not itself an entitlement check. Both are follow-up items for a separately authorized backend task, not changes to this accepted UI scope.
* **Controlled integration inventory:** Existing application presentation in `src/app/` and `src/components/`, STACK37 logo asset, email drafts, UI fixtures and presentation test, root unit-test exclusion in `package.json`, design/reference and governance records, and the implementation, backend handoff, and final quality gate reports. Exact paths are in [CHANGE-INVENTORY.md](reviews/TASK-STAB-004/CHANGE-INVENTORY.md). CEO separately authorized TASK-STAB-005 local integration on October 14, 2026; no live-service or remote Git work is authorized.

---

### TASK-STAB-005A: Backend Integration Readiness
* **Owner:** Google Antigravity (Backend Owner)
* **Status:** `COMPLETED`
* **Scope:** Document existing authentication, registration, workspace, subscription, and Business Settings contracts for frontend integration.
* **Deliverable:** `docs/integration/backend_integration_readiness.md` (the accepted worktree copy matched the root copy byte-for-byte by SHA-256 during local integration).

---

### TASK-STAB-005B: Backend Safeguards & Memory Update
* **Owner:** Google Antigravity (Backend Owner)
* **Status:** `ACCEPTED` (CEO accepted October 14, 2026; safeguards subject to joint verification)
* **Scope:** Add targeted unit security coverage and synchronize project memory in the isolated `task-stab-005b` worktree.
* **Deliverables integrated locally:** `tests/unit/backend-security-safeguards.test.ts`, `docs/verification/TASK-STAB-005_backend_verification_plan.md`, and the canonical backend specification. Governance updates are reconciled below rather than copied over the accepted TASK-STAB-004 state.
* **Additional deliverable:** `docs/verification/TASK-STAB-005_backend_verification_plan.md` maps the 19 safeguard unit tests to proposed live verification scenarios; it remains a plan, not evidence that live RLS or GoTrue tests have run.
* **Evidence from Antigravity:** 19 dedicated safeguard tests; its worktree reported 185 total unit tests, TypeScript and ESLint passing. These are worktree results, not a substitute for the root integrated regression run recorded in the TASK-STAB-005 report.
* **Verification boundary / deferred risk:** The plan identifies live PostgreSQL RLS, rollback constraints, and GoTrue cross-subdomain cookies as gaps. It also notes that the resolver's membership lookup is not bound to `organization_id`; a mismatched membership ID may make the UI flag appear editable for another organization, while the update actions still authorize against the target organization. Fail-closed membership lookup is not implemented in this task. No live database/auth tests were run under this local-only authorization.

---

### TASK-STAB-005C: Approved Backend Corrections — Local Integration
* **Owners:** Antigravity authored the backend corrections; Codex coordinates their authorized local integration.
* **Status:** `READY_FOR_REVIEW — INTEGRATED_LOCAL` (CEO authorized integrating the two completed corrections and supporting tests; combined verification complete; overall TASK-STAB-005 remains IN_PROGRESS).
* **Declared file scope:** `src/lib/auth/business-config.ts`, `src/lib/actions/organization.ts`, `tests/unit/backend-security-safeguards.test.ts`, `tests/unit/business-configuration.test.ts`, `tests/unit/organization-actions.test.ts`; integration evidence in `docs/reviews/TASK-STAB-005/CORRECTIONS-INTEGRATION-REPORT.md`, `PROJECT_STATE.md`, and `docs/TASKS.md`.
* **Contracts:** Resolver signature/data shape unchanged; `canEdit` defaults to false and requires the supplied membership to match the requested organization with active Primary Owner status. Registration input/result shapes unchanged; missing/erroring public Standard trial plan returns the existing failure-result shape with an explicit error before provisioning. Available Standard retains the existing registration/Headquarters/seven-day trial workflow. Authentication and settings write actions are unchanged.
* **Source evidence:** Antigravity reports 190 unit tests across 12 files, TypeScript and ESLint passing in its isolated worktree. These are source-reported results; combined verification is pending.
* **Recovery:** Both worktrees' current changed files and all five integration targets were copied and hash-verified before integration under `%TEMP%\STACK37-EOS-TASK-STAB-005C-integration-245d5701f6404d11a1b850f76b58a708` (76 Codex files / 12 Antigravity files). Prior checkpoints and reports remain intact.
* **Verification boundary:** Real PostgreSQL RLS, transaction rollback/constraint, and GoTrue/session tests are **DEFERRED / NOT EXECUTED (BLOCKED)**. The revised verification plan and the prepared database-security test stay separate in Antigravity's worktree.
* **Combined results:** 194/194 unit tests across 13 files (190 backend tests plus four accepted frontend tests), TypeScript and ESLint PASS. Browser fixture verified registration failure/retry/success, readonly Settings/Headquarters controls, owner Settings save and Headquarters save feedback using mocked actions. No regression found in those checks; real persistence and sessions are unverified.
* **Reconciliation:** Imported the five code/test targets byte-for-byte from the verified Antigravity snapshot after confirming root targets had no competing edits. Preserved all original 19 safeguard case names and assertion text; added four permission cases, one registration case and necessary chainable-query mocks. Shared governance was updated selectively; the accepted frontend and prior review/checkpoint history were preserved. Runtime resolver has no new independent authenticated-user predicate; retain this as a live verification/broader hardening caveat.
* **New evidence files:** `docs/reviews/TASK-STAB-005/CORRECTIONS-INTEGRATION-REPORT.md` and `docs/reviews/TASK-STAB-005/005C-headquarters-fixture.jpg` (mocked UI screenshot). Exact checkpoint hashes, inventories and recovery instructions are in the report.

---

### TASK-STAB-005: Integrated Verification
* **Owner:** Joint (Google Antigravity + ChatGPT Codex)
* **Status:** `IN_PROGRESS` overall; **local integration phase ACCEPTED** by CEO on October 14, 2026. Real database and authentication verification remains pending; no execution authorization is granted by local acceptance.
* **Scope:**
  - Integrate accepted TASK-STAB-004 frontend work and TASK-STAB-005B safeguard tests into a local branch.
  - Reconcile governance documentation while preserving accepted histories and decisions.
  - Run unit, typecheck, lint, and build verification locally.
  - Keep live database/auth checks, remote Git operations, and deployment outside this authorization.
* **Change inventory:** `docs/reviews/TASK-STAB-004/CHANGE-INVENTORY.md` and `docs/reviews/TASK-STAB-005/INTEGRATION-REPORT.md` record the imported files, reconciliation, recovery checkpoints, and verification results.
* **Expected Customer Result:** Bulletproof, verified foundation ready for commercial feature development.
* **Local-phase Acceptance Criteria (satisfied and CEO-accepted):**
  1. Both accepted change sets preserved with verified recovery checkpoints.
  2. All 189 root unit tests and required local static/build checks pass.
  3. Exact integration inventory, document reconciliations, limitations, and risks reported for CEO review.
  4. No remote/live service changes; local integration accepted, with overall task acceptance pending real database/authentication verification.
* **Acceptance record:** The CEO accepted 189/189 root unit tests (13 files), TypeScript, ESLint, production build, and Git validation. Branch `codex/task-stab-005-integration` and baseline `d17ed63a48e2313df0f5406d9074f9076b788721` are preserved; integration changes remain uncommitted. Both recovery snapshots, manifests/hashes, review records, and the unchanged 19-test safeguard suite remain intact.
* **Separate pending proposal:** Antigravity's revised Version 2.0 plan remains in `.worktrees/backend-safeguards/docs/verification/TASK-STAB-005_backend_verification_plan.md`. It is not imported over the checkpointed Version 1.0 plan and is not authorized for execution by this acceptance.
* **Remaining gates / risks:** Real owner/user/organization authorization and deferred membership-ID hardening; subscription fallback, configured trial and entitlement/status verification; PostgreSQL RLS tenant isolation; provisioning rollback/constraint integrity; real authentication, email confirmation/recovery, subdomain cookies, organization switching, and Settings persistence. Details remain in `PROJECT_STATE.md` and the integration report. Prepare and authorize an isolated test environment and exact fixture cleanup before real database/authentication tests.
* **Acceptance documentation scope:** Updated only `PROJECT_STATE.md`, `docs/TASKS.md`, and `docs/reviews/TASK-STAB-005/INTEGRATION-REPORT.md` to record this CEO decision. No runtime implementation or security-test assertion changes.
* **Boundary:** Await separate CEO authorization. No commit, push, merge, rebase, deployment, production-service modification, deletion of either worktree, deferred hardening implementation, or unrelated changes.

---

### TASK-PROD-LOGIN-001: Central Production Login Portal
* **Owner:** Joint (Antigravity owns central-host proxy routing; Codex owns the sign-in UI and frontend fallback).
* **Status:** `READY_FOR_REVIEW — FRONTEND PHASE`; the CEO subsequently authorized a non-production test push on November 2, 2026. Commit `b751787` is on `codex/task-prod-login-001`. No push to `main`, production deployment, or database changes were authorized.
* **Expected Customer Result:** Visiting `https://mybusiness.stack37.com/` reaches the approved STACK37 sign-in screen; direct `/login` remains functional.
* **Integration contract:** Antigravity's handoff reports that the central `mybusiness` root redirects to `/login`, preserving query parameters and refreshed cookies, while tenant subdomain roots continue rewriting to `/tenant/[tenantSlug]`. The backend-owned `src/proxy.ts` is not part of Codex's change scope.
* **Declared Codex file scope:** `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/fonts/*`, a focused frontend unit test, this task record, `PROJECT_STATE.md`, and `docs/reviews/TASK-PROD-LOGIN-001-CODEX-REPORT.md`. No proxy, auth action, database, migration, or UK Super file is in scope.
* **Acceptance criteria:** (1) Root page redirects with Next.js `redirect('/login')`; (2) existing login page and auth actions remain unchanged; (3) focused test, full unit suite, typecheck, lint, and production build pass; (4) built `/login` output contains the approved sign-in experience; (5) no UK Super changes or migrations are included; (6) work stops locally at `READY_FOR_REVIEW`.
* **Handoff:** Antigravity's proxy fix remains uncommitted in its source worktree. This source snapshot's current `src/proxy.ts` still rewrites `mybusiness` root to `/registration`, so it intercepts `/` before the new page redirect. A local request using this proxy also reached `/registration` and returned 500 because this isolated copy has no Supabase environment. `/login` HTML was verified in the production build output, but runtime root/login behavior is pending approved local integration of Antigravity's proxy change and an isolated authentication configuration. This Codex snapshot does not copy or edit backend-owned files.
* **Codex evidence (November 2, 2026):** 195/195 unit tests across 14 files, typecheck, ESLint, production webpack build, and `git diff --check` passed. Next/Turbopack build was separately attempted but failed while spawning a child process under the sandbox; webpack build passed with authorized workspace access. Commit `b751787` was pushed only to `codex/task-prod-login-001`. GitHub's Vercel check failed at the account deployment-blocked gate; no preview deployment/URL was created. No production URL, live authentication, shared database, migration, or production deployment was used. See [Codex report](reviews/TASK-PROD-LOGIN-001-CODEX-REPORT.md).
## 4. Completed Task History Archive

### TASK-HIST-005: Business Setup & Headquarters Configuration (Phase 3C.3)
* **Owner:** Google Antigravity
* **Status:** `SYNCHRONIZED` (Phase 3C.3 baseline included in commit `d17ed63`; remote migrations 11 & 12 were reported deployed by Antigravity)
* **Evidence:** 166/166 automated unit tests passing at the time; real browser persistence and audit logging were reported verified by Antigravity.

### TASK-HIST-004: Workspace Provisioning & Foundational RBAC (Phase 3C.2)
* **Owner:** Engineering Team / Antigravity
* **Status:** `COMPLETED_COMMITTED`
* **Evidence:** Commit `eb4c9b6`. Migration 10 applied. HQ branch provisioned, Administrator (`is_system=true`) and Member (`is_system=false`) roles verified.

### TASK-HIST-003: Business Registration & Profile Provisioning (Phase 3B)
* **Owner:** Engineering Team / Antigravity
* **Status:** `COMPLETED_COMMITTED`
* **Evidence:** Commit `7f88f2c`. Migrations 08 & 09 deployed. Atomic `create_business` RPC verified.

### TASK-HIST-002: Email Authentication & Security Hardening (Phase 3A)
* **Owner:** Engineering Team / Antigravity
* **Status:** `COMPLETED_COMMITTED`
* **Evidence:** Commits `b4b88b6` through `344bcab`. Intermediate email confirmation and 15m password recovery verified.

### TASK-HIST-001: Core Tenancy, RLS & Multi-Tenancy Architecture (Phases 1 & 2)
* **Owner:** Engineering Team
* **Status:** `COMPLETED_COMMITTED`
* **Evidence:** Commits `8039975` through `d4b6b2c`. Migrations 01–07 deployed. Tenant isolation verified via `tenant-isolation.test.ts`.
