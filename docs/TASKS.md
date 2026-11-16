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
| **TASK-STAB-005** | **Integrated Verification**<br>Joint verification across backend safeguards and aligned UI; real database/authentication gates pending. | Joint (Antigravity + Codex) | P0 | **ACCEPTED — LOCAL-ONLY; REAL-SERVICE RELEASE GATE OPEN** | Local frontend/backend files, unit tests, governance and verification records |
| **TASK-PROD-LOGIN-001** | **Production Login Screen & Central Routing**<br>Direct central portal root (`mybusiness.stack37.com/`) to `/login`, preserving tenant subdomain routing and direct `/registration`. | Joint (Backend: Antigravity; Frontend: Codex) | P0 | **READY_FOR_REVIEW — BACKEND ROUTING COMPLETE** | `src/proxy.ts`<br>`tests/unit/proxy-routing.test.ts` |

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
* **Status:** `ACCEPTED — LOCAL-ONLY` following the CEO's approval of the local-only verification report on October 14, 2026. The earlier local integration phase was also ACCEPTED by the CEO. Real database and authentication verification remains a separate open release gate; local results must not be represented as real-service proof.
* **Local-only verification claim (October 14, 2026):** The CEO directed Codex to finish the available TASK-STAB-005 checks in the local environment without using a staging or live database. Codex's declared file scope is `docs/TASKS.md`, `PROJECT_STATE.md`, and `docs/reviews/TASK-STAB-005/LOCAL-ONLY-VERIFICATION.md`, plus local review captures if needed. Runtime code, migrations, and the three dirty worktrees are outside this claim. This direction changes the current verification scope, not the evidence standard for real database and authentication behavior.
* **Local-only completion evidence (October 14, 2026):** 194/194 unit tests across 13 files, TypeScript, scoped ESLint, production build, local HTTP 200 responses for login/register/confirmation pages, and `git diff --check` passed. Unscoped ESLint was interrupted during its nested-worktree scan and is not counted as passed. Browser automation was unavailable in this environment. The exact commands, results, limitations, and unchanged runtime boundary are in [LOCAL-ONLY-VERIFICATION.md](reviews/TASK-STAB-005/LOCAL-ONLY-VERIFICATION.md). No real database or authentication test was run. The report was handed off for CEO review and subsequently accepted as described below.
* **CEO acceptance of local-only scope (October 14, 2026):** The CEO approved the local test report in this conversation. This accepts the completed local-only TASK-STAB-005 pass. Real database, authorization, authentication, transaction, and cross-subdomain checks remain a mandatory separate gate before commercial deployment. Acceptance does not authorize Migration 13, a deployment, or a new ERP task.
* **Git record correction:** The accepted integration and corrections were later checkpointed in local commit `132e54a`. Earlier text below describing them as uncommitted is a historical account of the acceptance moment, not the current Git state. This verification pass made no commit or push.
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

### TASK-UK-SUPER-004 — UK Super retail operations integration
* **Owner:** ChatGPT Codex (the CEO directly reassigned this implementation to Codex in this conversation).
* **Status:** `IN_PROGRESS — CEO-authorized frontend interconnection pass; backend-owned module contracts remain a separate release dependency.`
* **Reopened file scope:** `src/components/tenant/retail-live-workspace.tsx`, `src/components/tenant/retail-operations-workspace.tsx`, new `src/components/tenant/retail-module-sections.tsx`, focused unit tests, `docs/TASKS.md`, `PROJECT_STATE.md`, and `docs/reviews/TASK-UK-SUPER-004/IMPLEMENTATION-AND-LIVE-RELEASE-PLAN.md`. Existing live overview/POS/inventory/draft screens remain intact. Added module sections will show honest unavailable-data states with disabled actions; Employee page links to existing Team route. No schema, migration, RLS, business RPC, or live data changes.
* **Scope:** Integrate the existing UK Super product draft review with branch inventory, an audited stock adjustment flow, a recorded cash/external-card POS checkout, branch dashboard totals, and employee role/branch assignment. Preserve workspace tenant and branch checks. This is a pilot operations slice, not the complete commercial ERP scope.
* **Branch and isolation:** `codex/task-uk-super-004-ops`, isolated worktree `.worktrees/integration/TASK-UK-SUPER-004/operations`, based on the UK Super inventory integration branch. Shared checkout and existing agent worktrees were not edited.
* **Files affected:** `PROJECT_STATE.md`, `docs/TASKS.md`, `docs/reviews/TASK-UK-SUPER-004/IMPLEMENTATION-AND-LIVE-RELEASE-PLAN.md`, `next.config.ts`; `src/app/fonts/OFL.txt`, `geist-latin.woff2`, `geist-mono-latin.woff2`, `src/app/layout.tsx`; `src/app/invite/accept/page.tsx`, `src/app/tenant/[tenantSlug]/retail/page.tsx`, `src/app/tenant/[tenantSlug]/settings/team/page.tsx`; `src/components/tenant/organization-switcher.tsx`, `retail-live-workspace.tsx`, `retail-operations-workspace.tsx`, `team-management.tsx`, `workspace-frame.tsx`, `workspace-navigation.tsx`, `workspace-paths.ts`; `src/lib/actions/retail.ts`, `team.ts`, `src/lib/auth/team.ts`, `src/lib/email/invitation.ts`, `src/lib/validations/retail.ts`, `team.ts`; migrations `20261105000015_15_team_invitations_and_rpcs.sql` and `20261115000016_16_retail_sales_inventory.sql`; tests `tests/integration/retail-operations.test.ts`, `team-invitations.test.ts`, `tests/unit/retail-validation.test.ts`, `team-management-ui.test.tsx`, `team-management.test.ts`.
* **Local evidence:** `npm run typecheck` passed. `npm run test:unit` passed 265/265 across 17 files. Scoped ESLint and `git diff --check` passed before commit. `tests/integration/retail-operations.test.ts` executed Migrations 15 and 16 in PGlite and passed invitation/acceptance, sale, stock adjustment, replay guard, insufficient stock rollback, dashboard aggregation, employee assignment/audit, and role-seeding checks. Its auth/permission helpers are stubs; this does not verify actual Supabase RLS or JWT claims.
* **Build result:** The approved Geist faces are self-hosted with `next/font/local`; their SIL OFL license is included. TypeScript passes and the webpack build compiles and typechecks, but Windows build workers fail during generated-route output with `EPERM` while creating directories under `.next`. No complete local production build has passed.
* **Verification environment:** Docker Desktop cannot start (missing `SOFTWARE\Docker Inc\Docker Desktop` registry key; repair installer exited `-5`). CEO declined the separately priced $0.01344/hour Supabase development branch. PGlite is the isolated verifier; its permission functions are stubs and do not prove live RLS/JWT isolation.
* **Live migration authorization and result:** The CEO explicitly directed Codex to use the current EOS Supabase project as the live database. Migration 15 applied as version `20261115171617` and Migration 16 as `20261115171739`. Read-only checks confirmed invitation `created_at`, invitation/retail RPCs, retail tables, RLS enablement on new retail tables, denied anonymous sale/stock RPC execution, and no direct authenticated sale insert/stock update grants. No sale, stock-movement, or invitation fixture rows were written. These checks do not exercise authenticated JWT/RLS behavior end to end.
* **Not verified:** No live RLS/JWT/auth/email end-to-end test; no authenticated browser check or 375px review; no transaction smoke test. Preview `/w/uk-super/retail` and `/w/uk-super/settings/team` return the sign-in page for unauthenticated requests, as expected. Do not describe the system as production-ready until these gates pass.
* **Known product limits:** UK Super has staged draft products and no trusted opening stock. Existing products receive zero opening stock until a physical count is entered. This POS records cash sales and records card as externally processed; it does not process payments, calculate VAT/SSCL, reconcile a till, or issue legally validated receipts. Purchasing, customers, transfers, expiry tracking, finance, loyalty and complete reporting are still outside this implementation.
* **Release gate:** Live migrations are applied. Commit `50f0025c4fa2a25018e365ae8e5ff7b0fb33d813` and author-corrected follow-up `7e41f02cc3ea590f8e202b240ab478c5acb8ff7b` are pushed to the task branch; no history was rewritten. Preview `dpl_145YHTSkUXz6b2qpDYwL2d2jBcmM` for `7e41f02` is READY. Its remote build compiled, typechecked, generated all 12 static pages, and completed. `/login` returned HTTP 200; the public UK Super retail/team workspace URLs route unauthenticated users to sign-in. This is not a signed-in workflow check. Vercel CLI is unavailable, and the local Windows build still fails during generated-route output. No real JWT/RLS or authenticated browser check has passed. Production is unchanged. Card processing, VAT/SSCL, till reconciliation, compliant receipts, and opening-stock approval remain unresolved.
* **Production authorization and verification (2026-11-16):** CEO approved deployment. Re-ran `npm run test:unit` (265/265 across 17 files) and `npm run typecheck` (passed). Read-only live metadata confirms RLS enabled on four retail tables; the four retail/team RPCs are SECURITY DEFINER with empty `search_path`, granted to `authenticated`, denied to `anon`. Aggregate live metadata confirms one branch and one branch-assigned active member for UK Super. Signed-in Preview Retail still shows data unavailable; Team loads after about 10 seconds and displays the expected read-only mode. Real JWT/RLS behavior remains unverified. Per the release plan's no-go rule, no Production deployment was made. Opening stock is zero pending physical count; email, mobile, backup, and rollback gates remain incomplete. No business data was written.
* **Retail investigation and correction (2026-11-16):** The `membership_branches → branches` foreign key is many-to-one, so PostgREST returns `branches` as one object; the Retail page called `.map()` on it, throwing into a broad catch that mislabeled the account as unassigned. Added a normalizer for object/array relation shapes. The tenant layout already passed `categoryName`, but `WorkspaceFrame` dropped it; navigation now shows a Retail & E-Commerce tab only when that category is selected. Added focused helper/navigation coverage. `npm run test:unit` passes 270/270 across 19 files, `npm run typecheck` passes, and scoped ESLint and `git diff --check` pass. Preview deployment `dpl_6rm1CyvecuszVbtL76rUgDfmGxqt` for commit `fccdefcc9217bfaac671eaf55694ffc55d2cda8b` is READY at https://stack37-c5z5ydx0d-stack37.vercel.app. The public Retail route returns the sign-in page as expected; signed-in confirmation remains pending. Production domain investigation confirms `mybusiness.stack37.com` is attached to Production deployment `dpl_3fKc8z73hHX7WzrtGwSZB49tmzuR` at commit `0d7a2fe`, which returns 404 for `/w/uk-super`; the correction is Preview-only and Production was not changed. No live data or backend behavior changed.
* **CEO-authorized module-shell integration (2026-11-16):** Reopened the frontend task to surface all previously authored Retail section shells in the active live workspace. Declared files: `src/components/tenant/retail-live-workspace.tsx`, `src/components/tenant/retail-operations-workspace.tsx`, new `src/components/tenant/retail-module-sections.tsx`, `tests/unit/retail-module-sections.test.tsx`, `docs/TASKS.md`, `PROJECT_STATE.md`, and this release plan. The active Retail page now includes Purchasing, Customers, Employees, Expenses, Branches, Loyalty & offers, Reports, and Controls alongside Overview, POS, Inventory, and Product drafts. Placeholder screens show unavailable data and disabled actions; Employees links to the existing Team route. Unit tests pass 273/273 across 20 files, TypeScript, scoped ESLint, and `git diff --check` pass. Commit `5e490494edb9129dead635c961792bb2bdcef4fa` is pushed. Preview deployment `dpl_BnzeYWnET2PRDA7zccDS5gViVg7j` is READY at https://stack37-hgo7x2517-stack37.vercel.app; its unauthenticated Retail route reaches sign-in (HTTP 200). Signed-in and 375px browser reviews remain. No backend, schema, live data, or preview-write behavior changed.
* **CEO-authorized frontend interconnection pass (2026-11-16):** CEO approved connecting available Retail sections and removing the duplicate Employees section while keeping workspace Team. Declared file scope: `src/components/tenant/retail-module-sections.tsx`, `src/components/tenant/retail-live-workspace.tsx`, `tests/unit/retail-module-sections.test.tsx`, `tests/unit/workspace-navigation.test.tsx`, `docs/TASKS.md`, and `PROJECT_STATE.md`. Connect Branches, Reports, and Controls only to already supported branch, product, dashboard, Team, and Business Settings data/navigation. Preserve existing POS, Inventory, Product Drafts, and workspace Team. Do not add backend actions, schemas, RLS, migrations, or live data writes. Purchasing/supplier, Customers, Expenses, and Loyalty/offers have no corresponding data/action contracts in this candidate; keep their writes disabled and document exact backend dependencies. Acceptance: no Employees item in Retail tabs, Team remains in workspace navigation, connected sections display real current props/links, missing-data sections remain honest, unit/type/lint checks pass.

### TASK-PROD-LOGIN-001: Production Login Screen & Central Routing
* **Owner:** Joint (Google Antigravity: Backend Routing & Auth Contracts; ChatGPT Codex: Frontend Sign-in Experience)
* **Status:** `READY_FOR_REVIEW — BACKEND ROUTING COMPLETE`
* **Scope:**
  - Update `src/proxy.ts` routing contract so that only the central `mybusiness.stack37.com/` (and local `mybusiness.localhost:3000/`) portal root redirects to `/login`.
  - Preserve tenant subdomain routing (`<tenant>.stack37.com/*` -> `/tenant/<tenant>/*`).
  - Preserve direct `/registration` and other shared auth routes (`/login`, `/register`, `/forgot-password`, `/reset-password`, etc.).
  - Preserve session synchronization, refreshed cookies, and Cache-Control headers across root redirect.
  - Implement comprehensive regression coverage in `tests/unit/proxy-routing.test.ts` (17 tests passing).
  - Exclude UK Super scope and migrations 13–15 from this release (isolated in `.worktrees/uk-super-backend`).
* **Expected Customer Result:** Visitors to `https://mybusiness.stack37.com/` seamlessly reach the official My Business sign-in experience at `/login`, while tenant organizations and direct registration paths operate undisturbed.
* **Files Affected:** `src/proxy.ts`, `tests/unit/proxy-routing.test.ts`.
* **Verification Evidence:**
  - 198/198 unit tests passing across 13 test files (`npm run test:unit`).
  - TypeScript typecheck passing with 0 errors (`npm run typecheck`).
  - Scoped ESLint passing cleanly on touched files (`npx eslint src/proxy.ts tests/unit/proxy-routing.test.ts`).
  - `git diff --check` clean.

---

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

## TASK-UK-SUPER-002 — UK Super inventory review UI and staging integration

* **Owner:** Joint — Antigravity owns the import schema/RPCs; Codex owns the dashboard UI.
* **Status:** READY_FOR_REVIEW — CEO accepted the local dashboard UI and authorized this isolated branch push on November 6, 2026. This status is not CEO acceptance of the branch or production release.
* **Scope:** Present UK Super's staged inventory inside Retail & E-Commerce → Inventory, show the staged/not-live warning, and allow the owner to review or edit flagged draft fields through the existing `resolve_product_draft` RPC. Include Migration 14 and its backend contract/test artifacts authored under the task. Do not publish products or change stock quantities.
* **Hosted data state (recorded earlier):** 2,079 UK Super product drafts staged; 395 have review flags; all remain staged; zero published products and no opening stock imported. Migrations 13 and 14 were applied under separate CEO approval. This push does not run migrations or modify hosted data.
* **Local review evidence:** The CEO accepted the dashboard layout locally on November 5, 2026. The old drafts URL redirects to the embedded Inventory tab. Reported unit tests, typecheck, lint, and diff checks passed at handoff; Codex did not rerun tests during this packaging step.
* **Git boundary:** This isolated branch is based on `codex/task-sync-001-integration`. It excludes unrelated Team, security tracker, and routing follow-up edits from the shared checkout. No merge to `main`, product publication, new database migration, or production deployment is included.
* **Preview note:** Vercel may automatically build a Preview for this branch. Project notes indicate Preview can use the shared hosted Supabase project, and no verified app-wide read-only protection exists; authenticated draft edits may therefore affect the already-staged UK Super rows.

* **Vercel Preview follow-up:** The first branch build failed because the UK Super demo route's local-only demo component was missing from the candidate. Added src/components/tenant/supermarket-demo.tsx in a task-labeled follow-up commit; the Preview rebuild is being checked. This component uses fictional sample data and disabled operational controls.
* **Preview hostname routing (November 6, 2026):** Added exact deployment-host routing to this branch under `TASK-SYNC-001-PREVIEW-ROUTING-001`. The CEO explicitly authorized this push after being told the Preview may connect to hosted Supabase and the editor can save staged drafts. Typecheck and diff check passed; unit tests were not rerun. No inventory edits, migration, publication, merge, or production deployment were performed. Vercel rebuild and URL verification remain pending.
