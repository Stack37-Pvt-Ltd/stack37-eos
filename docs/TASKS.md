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
| **TASK-STAB-005** | **Integrated Verification**<br>Joint verification across backend safeguards and aligned UI; real database/authentication gates pending. | Joint (Antigravity + Codex) | P0 | **ACCEPTED — LOCAL-ONLY under DEC-020; REAL-SERVICE RELEASE GATE OPEN** | Local frontend/backend files, unit tests, governance and verification records |
| **TASK-TEAM-001** | **Team Management Frontend & Local Integration**<br>Integrate employee roster, invitations, access management and invitation route with the accepted backend contract. | Joint (Antigravity + Codex) | P1 | **ACCEPTED — LOCAL-ONLY under DEC-020; RELEASE GATES OPEN** | Team integration worktree, Team Management UI/actions, tests and runtime route evidence; real verification pending |
| **TASK-TEAM-002** | **Team Management Preview Readiness**<br>Prepare and verify the accepted Team Management implementation for the private Vercel Preview. | Joint (Antigravity backend; Codex frontend/integration) | P1 | **READY_FOR_REVIEW — Preview commit `e4ac490` is READY; public Team route smoke passed; signed-in review remains** | `codex/task-team-002-preview` worktree; no Production or database changes |

*Note: DEC-020 accepts the local-only TASK-STAB-005 and TASK-TEAM-001 work. Real-service checks remain mandatory before commercial deployment; Team Management invitation acceptance remains disabled and Migration 13 unapplied. The enhanced multi-business workspace selector remains future scope under DEC-017. No new ERP task is authorized by this acceptance.*

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
* **Status:** `ACCEPTED — LOCAL-ONLY` by CEO under DEC-020. Real database and authentication verification remains a separate release gate; no execution authorization is granted by local acceptance.
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
  4. No remote/live service changes; the local-only task was later accepted under DEC-020, while real database/authentication verification remains a release gate.
* **Acceptance record:** The CEO first accepted the local integration checkpoint with 189/189 root unit tests (13 files), TypeScript, ESLint, production build, and Git validation. Branch `codex/task-stab-005-integration` and baseline `d17ed63a48e2313df0f5406d9074f9076b788721` were preserved at that checkpoint. Both recovery snapshots, manifests/hashes, review records, and the unchanged 19-test safeguard suite remain intact. The CEO later approved the separate local-only report in the root checkout under DEC-020; that report is still uncommitted there and needs later reconciliation before Git synchronization.
* **Separate pending proposal:** Antigravity's revised Version 2.0 plan remains in `.worktrees/backend-safeguards/docs/verification/TASK-STAB-005_backend_verification_plan.md`. It is not imported over the checkpointed Version 1.0 plan and is not authorized for execution by this acceptance.
* **Remaining gates / risks:** Real owner/user/organization authorization and deferred membership-ID hardening; subscription fallback, configured trial and entitlement/status verification; PostgreSQL RLS tenant isolation; provisioning rollback/constraint integrity; real authentication, email confirmation/recovery, subdomain cookies, organization switching, and Settings persistence. Details remain in `PROJECT_STATE.md` and the integration report. Prepare and authorize an isolated test environment and exact fixture cleanup before real database/authentication tests.
* **Acceptance documentation scope:** Updated only `PROJECT_STATE.md`, `docs/TASKS.md`, and `docs/reviews/TASK-STAB-005/INTEGRATION-REPORT.md` to record this CEO decision. No runtime implementation or security-test assertion changes.
* **Boundary:** Await separate CEO authorization. No commit, push, merge, rebase, deployment, production-service modification, deletion of either worktree, deferred hardening implementation, or unrelated changes.

---

### TASK-TEAM-001: Team Management Frontend & Local Integration
* **Owner:** Joint (Google Antigravity — backend; ChatGPT Codex — frontend/integration)
* **Status:** `ACCEPTED — LOCAL-ONLY` by the CEO on October 14, 2026 under DEC-020. Backend implementation was accepted under DEC-018 and the earlier local integration milestone under DEC-019. Real-service release gates remain open.
* **CEO acceptance documentation claim (October 14, 2026):** The CEO has now accepted Team Management as locally implemented. Documentation-only scope: `docs/TASKS.md`, `PROJECT_STATE.md`, `docs/DECISIONS.md`, `docs/FEATURES.md`, and `docs/ROADMAP.md` in this clean integration worktree. No runtime file, migration, or other worktree is in scope; the distinction between local acceptance and commercial readiness must remain explicit.
* **Accepted milestones:** DEC-018 accepts Antigravity's backend implementation for local development and frontend integration. DEC-019 accepts the earlier local integration milestone. DEC-020 accepts the locally implemented Team Management task. None of these decisions means the feature is production-ready or verified against a real database.
* **Current scope delivered locally:** Team roster and permission presentation; staff invitation and role/branch assignment flows; pending invitation display/cancellation; employee suspend, reinstate, and removal controls with Primary Owner protections; invitation route states. Actual availability remains subject to the integrated backend actions and verification gates.
* **Security and workflow boundaries:** Invitation acceptance remains disabled. Migration 13 is unapplied and requires separate authorization. Do not enable real invitation acceptance until its database-level security requirements are approved and verified. Preserve the existing organization selection and workspace switching; the enhanced multi-business role-aware selector remains future scope under DEC-017.
* **Remaining release gates:** Real database and RLS verification; real authentication and identity verification; transaction/rollback checks; and end-to-end employee workflows. These remain **DEFERRED / NOT EXECUTED**. Route rendering and mocked/unit checks do not satisfy these gates.
* **TASK-STAB-005 dependency:** TASK-STAB-005 was accepted for its local-only scope under DEC-020; its real database, RLS, rollback/transaction, and authentication verification remain mandatory before commercial deployment.
* **CEO acceptance (October 14, 2026):** The CEO stated “accept the team management” in this conversation after the local-only TASK-STAB-005 acceptance. This records acceptance of the Team Management work already integrated locally, with invitation acceptance disabled and Migration 13 unapplied. No additional code or test execution occurred as part of this documentation update.
* **Acceptance record and evidence:** Changed only `docs/TASKS.md`, `PROJECT_STATE.md`, `docs/DECISIONS.md`, `docs/FEATURES.md`, and `docs/ROADMAP.md`. No tests were rerun for this documentation-only update; earlier local checks remain the evidence recorded above and in the integration report. Evidence level: **CEO-ACCEPTED LOCAL-ONLY**, with real-service checks **NOT EXECUTED**. `git diff --check` passed for these documentation changes.
* **Change boundary for this CEO acceptance:** Documentation only in the existing `team-integration` worktree. All implementation changes and worktrees are preserved. No commit, push, merge, deployment, database change, or new development task is authorized.

---

### TASK-TEAM-002: Team Management Preview Readiness
* **Owner:** Joint (Google Antigravity — backend; ChatGPT Codex — frontend/integration)
* **Status:** `READY_FOR_REVIEW` — The CEO requested Preview publication on November 16, 2026. Commit `e4ac490a2ce54f3338244a97ee8fe81ceba45ff2` is pushed and Vercel deployment `dpl_4x9vXdLPDYL2CQmJXCubcq6nf8t3` is READY. Public route smoke checks pass; authenticated Team workflow review remains for the CEO.
* **CEO request:** Make the Team tab work in the app and publish a Vercel preview.
* **Scope:** Review the accepted local implementation, run local checks, and publish a private Vercel Preview from a non-production branch. The CEO approved using the existing shared Supabase connection for this preview and was informed that preview actions could change live staff records.
* **Explicit exclusions:** Do not push to `main` or deploy to Production. Do not run tests that change live business data. Migration 13 and enabling invitation acceptance require separate specific CEO approval. Antigravity owns backend changes; Codex may only change frontend or integration files within its declared file scope.
* **Phase 1 frontend acceptance criteria:** Team navigation preserves `/w/{tenantSlug}/...`; organization switching stays on the trusted preview origin; the Team guard receives public subpath `/settings/team` and Antigravity's guard adds the preview prefix; Preview write controls are visibly disabled with accessible explanations; loading, error, empty and view-only states remain distinct; invitations are classified by expiry; Primary Owner protections remain; the page has no viewport-level horizontal overflow at 375px; mocked tests do not call live services. Production login centralization at `https://mybusiness.stack37.com/login` is a Phase 2 dependency and was not implemented here.
* **Declared frontend file scope:** `src/components/tenant/workspace-navigation.tsx`, `src/components/tenant/workspace-frame.tsx`, `src/components/tenant/organization-switcher.tsx`, `src/components/tenant/team-management.tsx`, `src/components/tenant/workspace-paths.ts`, `src/app/tenant/[tenantSlug]/settings/team/page.tsx` (return-path and read-only prop only), `src/app/tenant/[tenantSlug]/settings/team/loading.tsx`, `tests/ui/review-fixture.tsx`, `tests/ui/serve.mjs`, `tests/unit/team-management-ui.test.tsx`, `tests/unit/organization-switcher.test.tsx`, `tests/unit/workspace-directory.test.tsx`, `tests/unit/workspace-navigation.test.tsx`, `tests/unit/workspace-paths.test.ts`, and TASK-TEAM-002 documentation in `docs/TASKS.md` and `PROJECT_STATE.md`. `src/components/tenant/workspace-directory.tsx` remains unchanged and consumes backend-owned `getTenantWorkspaceUrl`. Backend-owned `src/proxy.ts`, `src/lib/auth/host.ts`, `src/lib/auth/tenant-utils.ts`, `src/lib/auth/tenant-guard.ts`, `src/lib/actions/team.ts`, authentication routes/actions, database files and RLS are excluded from Codex scope.
* **Local evidence (October 14, 2026):** Team integration worktree passed 232/232 unit tests across 15 files, `npm run typecheck`, scoped Team UI ESLint, and `npm run build`. Build succeeded; Next.js warned that it found lockfiles in both the worktree and parent folder. No live DB, login, or browser workflow was tested.
* **Vercel finding:** The project has `main` as its production branch; pushes there create production deployments. The existing `codex/task-team-001-integration` branch is explicitly disabled for automatic deployment in `vercel.json`. Vercel Preview and Production variables are attached to the same Supabase integration, so a functional preview could read or change the live database.
* **CEO authorization (October 14, 2026):** The CEO selected “Use shared live database.” This authorizes publishing a non-production Vercel Preview that uses the existing shared Supabase connection, with the live-data risk stated above. It does not authorize a Production deployment, live data-changing tests, Migration 13, or enabling invitation acceptance.
* **Preview publication (October 15, 2026):** Published branch `codex/task-team-002-preview`, commit `03f38813092748d0e4a1f5f9b98b6af9487a69ff`, to GitHub. Vercel deployment `dpl_GWWoHASvPJpSdDZ856jmnq2wHzcj` reached **READY** at [https://stack37-tv4j4r6y8-stack37.vercel.app](https://stack37-tv4j4r6y8-stack37.vercel.app). Deployment metadata identifies it as a Preview for the requested branch and commit. A read-only request to the preview root returned `404: STACK37 EOS requires a valid subdomain`.
* **Integration requirement / blocker:** `src/proxy.ts` accepts workspace hosts only under `*.stack37.com` or `*.localhost`, but Vercel's assigned preview hostname is under `*.vercel.app`. The preview therefore cannot reach the application or Team tab as deployed. Antigravity must define and approve a safe Preview host contract (including trusted tenant identification and preserving rejection of direct `/tenant/*` access) before Codex changes integration or UI routing. No proxy, backend, database, or security code was changed in this task.
* **Current status:** Local checks pass and the private Preview build is ready, but Team-tab access on that preview remains blocked on the backend routing contract. No live database actions were run. Invitation acceptance remains disabled and Migration 13 remains unapplied pending separate specific CEO approval.
* **October 15 scope confirmation and handoff:** The CEO chose completion of the existing non-production private preview while keeping Migration 13 unapplied and invitation acceptance disabled. Codex rechecked the deployed routing assumptions and recorded the required trusted-host, tenant-identity, auth/cookie, workspace-link, and negative-case contract in `docs/integration/TASK-TEAM-002-preview-host-handoff.md`. Vercel Deployment Protection remains unverified: the current connector received a `team_stack37` scope 403, and the CLI is unavailable. This is a documentation-only review; no runtime file, database, or deployment was changed. Antigravity's contract and ownership review remain the next dependency. Status stays `IN_PROGRESS` until the preview Team route works and the acceptance criteria above are verified.
* **CEO authorization and implementation claim (October 15, 2026):** Phase 1 frontend implementation is authorized in the preserved `codex/task-team-002-preview` worktree. The approved backend contract uses exact preview-host matching against `VERCEL_URL` with `VERCEL_ENV=preview`; the public preview workspace route is `/w/{tenantSlug}/...`; Team passes `/settings/team` as its return subpath and the backend guard adds `/w/{tenantSlug}` on trusted preview hosts. Preview organization switching stays on the same origin. Production sign-in remains centralized at `https://mybusiness.stack37.com/login` as a Phase 2 dependency. Antigravity owns proxy, host validation, tenant URL utility, server-side auth/authorization and mutation safeguards. Preview UI disabling is separate from backend-enforced rejection of writes. Invitation acceptance remains disabled.
* **Frontend completion evidence (October 15, 2026):** Exact changed-file inventory: `src/app/tenant/[tenantSlug]/settings/team/page.tsx`, `src/app/tenant/[tenantSlug]/settings/team/loading.tsx`, `src/components/tenant/organization-switcher.tsx`, `src/components/tenant/team-management.tsx`, `src/components/tenant/workspace-frame.tsx`, `src/components/tenant/workspace-navigation.tsx`, `src/components/tenant/workspace-paths.ts`, `tests/ui/review-fixture.tsx`, `tests/ui/serve.mjs`, `tests/unit/team-management-ui.test.tsx`, `tests/unit/organization-switcher.test.tsx`, `tests/unit/workspace-directory.test.tsx`, `tests/unit/workspace-navigation.test.tsx`, `tests/unit/workspace-paths.test.ts`, `docs/TASKS.md`, and `PROJECT_STATE.md`. `docs/integration/TASK-TEAM-002-preview-host-handoff.md` was already untracked and was preserved without modification. `src/components/tenant/workspace-directory.tsx` is unchanged; combined Preview behavior depends on Antigravity's updated `src/lib/auth/tenant-utils.ts`.
* **Verification evidence:** `npm run test:unit` passed 243/243 tests across 19 files; `npm run typecheck`, `npm run lint`, and `npm run build` passed. The build required network permission to fetch the existing Geist fonts and emitted a non-blocking multiple-lockfile workspace-root warning. The isolated browser fixture showed Preview navigation on `/w/serendib/...`, read-only notice, disabled Team mutation buttons, the Primary Owner marked protected, and one pending plus one expired mock invitation. At 375px, page-level horizontal overflow was absent and the employee table scrolled within its own container; desktop was reviewed at 1440px. No action request was submitted; the local fixture displayed mocked data/actions only.
* **Backend compatibility and discrepancy:** Read-only inspection of Antigravity branch `antigravity/task-team-002-backend` at base `03f38813092748d0e4a1f5f9b98b6af9487a69ff` confirmed `/w/{slug}` rewrites, trusted-host handling, preview mutation guards, and explicit roster failures. Its `buildPublicLoginRedirectUrl` accepts `/settings/team` and generates the preview-prefixed return destination. `getTenantWorkspaceUrl` returns same-preview-host `/w/{slug}/` links, which the unchanged directory and new switcher helper consume after combined integration. However, `getTeamRoster` selects stored `status='pending'` rows only. The frontend can mark returned rows expired by `expiresAt`, but cannot count invitation rows already stored with status `expired`; complete expired-state counts require the backend response to include those rows or return aggregate counts. This is the sole contract discrepancy found. Backend diff inventory: `src/lib/actions/team.ts`, `src/lib/auth/host.ts`, `src/lib/auth/tenant-guard.ts`, `src/lib/auth/tenant-utils.ts`, `src/proxy.ts`, `tests/unit/proxy-routing.test.ts`, `tests/unit/team-management.test.ts`, `tests/unit/tenant-guard.test.ts`, and `docs/TASKS.md`. These files were inspected read-only and not copied or edited.
* **Safe combined-verification proposal (requires separate CEO authorization):** Preserve both current worktrees. In a separately authorized disposable integration worktree, use the agreed baseline and transfer only the five backend runtime files plus three backend unit-test files listed above; do not alter the source worktrees. Reconcile `docs/TASKS.md` manually because both worktrees changed it. Review the frontend Team page as the only backend/frontend integration boundary; verify each imported file against Antigravity's recorded diff, then run the full unit/typecheck/lint/build gates. Do not merge, rebase, cherry-pick, push, deploy, run live mutations or apply migrations as part of that local integration.
* **Remaining risks:** Combined verification has not run. Production centralized login remains Phase 2. Expired invitation rows omitted by the current backend response cannot be included in the UI count. The Vercel Preview uses shared Supabase; visual disabling is not a replacement for Antigravity's server mutation guard. Vercel Deployment Protection and real-service authentication/data behavior remain unverified. Migration 13 and invitation acceptance remain disabled.
* **CEO authorization to publish completed frontend (November 16, 2026):** The CEO explicitly requested that Codex push the completed Phase 1 frontend changes in this worktree to the non-production Preview so they can try the Team and retail/supermarket screens. This authorizes the task-branch commit/push and Preview deployment. It does not authorize Production deployment, live database writes, Migration 13, invitation acceptance, or disabling the backend Preview mutation guard. The Preview Team actions remain read-only by design because Preview and Production share Supabase.
* **Current claim and declared file lock (November 16, 2026):** Codex claims TASK-TEAM-002 `IN_PROGRESS` for publishing the reviewed frontend Phase 1 diff on `codex/task-team-002-preview`. Scope is limited to the already-declared frontend files, their unit/UI fixtures, and `docs/TASKS.md`, `PROJECT_STATE.md`, and the preview-host handoff. The separate root checkout and all other worktrees remain untouched.
* **Preview smoke result and narrow scope extension (November 16, 2026):** The new Preview build for commit `ccb6f000e232766b7a6b68fb5548584629a17371` reached READY, but read-only requests to `/login`, `/w/uk-super/settings/team`, and `/w/uk-super/retail` returned `404: STACK37 EOS requires a valid subdomain`. Source review confirmed the task branch proxy did not implement the preview host contract recorded in the earlier handoff. Under the CEO's request to make the Preview usable, Codex extends this claim narrowly to `src/proxy.ts`, `src/lib/auth/host.ts`, `src/app/tenant/[tenantSlug]/layout.tsx`, `tests/unit/proxy-routing.test.ts`, and `tests/unit/auth-actions.test.ts`: recognize only the exact Vercel deployment or branch URL while `VERCEL_ENV=preview`, rewrite validated `/w/{tenantSlug}/...` paths to the internal tenant route, preserve the requested workspace path through sign-in, continue rejecting direct `/tenant/*` and arbitrary `*.vercel.app` hosts, and permit auth callbacks only for those exact Preview hosts. No live database write, new invitation action, migration, or Production change is authorized.
* **Preview routing verification:** Added exact deployment/branch host matching and validated `/w/{tenantSlug}/...` rewrites, retained direct internal-route and reserved-slug denials, and forwarded the public pathname so sign-in returns to the requested page. Added focused coverage for deployment-host and branch-host routes, arbitrary Vercel domains, reserved slugs, direct-route blocking, spoofed tenant headers, and callback-host validation. `npx vitest run tests/unit/proxy-routing.test.ts tests/unit/auth-actions.test.ts` passed 57/57 tests; `npm run typecheck`, scoped ESLint, and `git diff --check` passed.
* **Preview deployment and smoke (November 16, 2026):** Commit `e4ac490a2ce54f3338244a97ee8fe81ceba45ff2` built successfully; deployment `dpl_4x9vXdLPDYL2CQmJXCubcq6nf8t3` is READY at [https://stack37-d2uypiyk4-stack37.vercel.app](https://stack37-d2uypiyk4-stack37.vercel.app), with branch alias [https://stack37-eos-git-codex-task-team-002-preview-stack37.vercel.app](https://stack37-eos-git-codex-task-team-002-preview-stack37.vercel.app). Both URLs return the sign-in page for `/login` and `/w/uk-super/settings/team`; direct `/tenant/*` remains blocked. This Team-specific branch does not include a `/retail` route. Full retail operations is available separately at [https://stack37-74n4a3m4t-stack37.vercel.app](https://stack37-74n4a3m4t-stack37.vercel.app); its `/w/uk-super/retail` and Team paths both route unauthenticated visitors to sign-in.
* **Remaining review limits:** Team mutations remain disabled in Preview by design because Preview and Production share Supabase. No signed-in roster, live invitation, role assignment, stock adjustment, or sale test was performed. The Team page needs a signed-in user review; retail sale and inventory actions on the separate operations Preview can write live records.
* **TASK-TEAM-002 publication handoff (November 16, 2026):** The requested task-branch commit/push and Preview deployment are complete. The isolated worktree has no uncommitted changes; the root checkout and all other worktrees remain untouched. Task status is `READY_FOR_REVIEW`, not CEO-accepted.

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
