# STACK37 EOS — Decision Register

**Product:** STACK37 EOS / My Business by STACK37  
**Governance:** Chief Executive Officer, STACK37 (Pvt) Ltd  
**Document Status:** Authoritative Decision Log  

---

## 1. Approved Strategic & Architectural Decisions

| Decision ID | Decision Title | Approved Policy / Invariant | Date Established |
| :--- | :--- | :--- | :--- |
| **DEC-001** | **Single Configurable Platform** | STACK37 EOS is one configurable multi-industry platform. Developing separate codebases or forks for different industries is strictly prohibited. | Oct 10, 2026 |
| **DEC-002** | **Initial Market Focus** | Target SMEs initially, with Sri Lanka as the primary launch market (LKR, Asia/Colombo, BRN/TIN, VAT/SSCL). | Oct 13, 2026 |
| **DEC-003** | **Commercial Release Scope** | First commercial release must include connected Sales, Purchasing, Inventory, and Basic Finance, alongside the platform foundation. | Oct 13, 2026 |
| **DEC-004** | **Pre-Launch Commercialization Gate** | Subscription payment and trial-expiry handling must be operational BEFORE paid public launch, not deferred post-launch. | Oct 13, 2026 |
| **DEC-005** | **Company Entity Scope** | Initial release supports one legal company with multiple branches/facilities. Multi-entity group holding is a deferred future capability. | Oct 13, 2026 |
| **DEC-006** | **Free Trial Policy** | Every newly registered organization receives an automatic 7-day free trial on the default plan. | Oct 12, 2026 |
| **DEC-007** | **Pilot Validation Scenarios** | UK Super (retail/POS) and Construction Equipment Rental are pilot scenarios used strictly to validate platform flexibility; neither shall fork the product. | Oct 13, 2026 |
| **DEC-008** | **Independent VAT & SSCL Regimes** | VAT registration and SSCL registration must be separate, independent configuration settings. Tax calculations will be built only against validated statutory requirements. | Oct 13, 2026 |
| **DEC-009** | **Tenancy Security Invariant** | Multi-tenancy is enforced via PostgreSQL Row Level Security (RLS). Direct client-side mutations on organizations and branches are revoked; audited `SECURITY DEFINER` RPCs required. | Oct 10, 2026 |
| **DEC-010** | **Sole Ownership Invariant** | Exactly one active Primary Owner per organization, enforced by database unique constraints and trigger guards. | Oct 11, 2026 |
| **DEC-011** | **Corporate Visual Identity Direction** | STACK37 uses its existing official corporate logo, navy typography, and established blue/violet visual identity. Unified product UI design is subject to CEO approval. | Oct 13, 2026 |
| **DEC-012** | **Sequential Development Priorities** | Priority sequence is: (1) Project Control Setup, (2) Foundation Stabilization, (3) UI/UX Approval. Team Management and ERP feature development are paused until priorities 1–3 are approved. | Oct 13, 2026 |
| **DEC-013** | **Executive Change Governance** | The CEO must review and authorize all significant product decisions, Git commits/pushes, and live database migrations. | Oct 13, 2026 |
| **DEC-014** | **Permanent Agent Responsibility Policy** | CEO-approved division of responsibilities: Antigravity (Backend Owner), Codex (Frontend/UI Owner), ChatGPT (Product Coordination), CEO (Final Authority). Technical isolation via separate branches/worktrees required for parallel work. | Oct 13, 2026 |
| **DEC-015** | **Approved TASK-STAB-003 Product UI** | CEO approved the actual Codex exploration: official logo, Geist, concise modern minimal pages, white/pale blue-grey surfaces, navy square buttons, restrained blue/violet accents and horizontal workspace navigation. No fixed left sidebar. Reuse this pattern for future approved features. Implementation separately authorized as TASK-STAB-004. | Oct 13–14, 2026 |
| **DEC-016** | **Deferred Database Verification & Controlled Local Development Exception** | Due to Supabase Free plan project limitations and local container unavailability, defer live RLS, cross-tenant isolation, direct-write revocation, transaction rollback, and live auth-cookie tests. TASK-STAB-005 remains IN_PROGRESS; these checks remain a mandatory gate before commercial deployment. A controlled local-development-only exception allows Milestone 2 / FEAT-TEAM-001 work; no remote migrations, production deployment, or production-branch pushes are authorized. | Oct 14, 2026 |
| **DEC-017** | **Multi-Business Workspace Selection & Real-Time Role Display — Future** | A user may belong to multiple independent businesses with separate roles, branch assignments, and permissions. A future selector should show authorized businesses and current roles; this is FUTURE / NOT IMPLEMENTED / NOT AUTHORIZED under TASK-TEAM-001. Preserve existing `/select-organization` behavior and foundational membership data. | Oct 14, 2026 |
| **DEC-018** | **Formal Acceptance of TASK-TEAM-001 Backend Implementation** | CEO accepts Antigravity's Team Management backend implementation (server actions, validation, concurrency claim, compensating rollback, recipient identity enforcement, and audit-log schema alignment) for local development and frontend integration. Migration 13 remains unapplied and requires separate authorization. Real database security verification remains deferred under DEC-016. | Oct 14, 2026 |
| **DEC-019** | **TASK-TEAM-001 Local Integration Milestone Acceptance** | CEO accepts the local integration milestone only. Team Management remains IN_PROGRESS pending real database, RLS, authentication, transaction, and end-to-end employee workflow verification. Invitation acceptance remains disabled until its database-level security requirements are approved and verified. Migration 13 remains unapplied pending separate authorization. | Oct 14, 2026 |
| **DEC-020** | **Local-Only Acceptance of TASK-STAB-005 and TASK-TEAM-001** | The CEO approved the TASK-STAB-005 local test report and then accepted Team Management as locally implemented. These acceptances cover local code and checks only. Real database isolation, authentication, transaction, and employee workflow checks remain mandatory before commercial deployment. Invitation acceptance remains disabled; Migration 13 remains unapplied. This decision does not authorize a commit, push, deployment, database change, or new ERP task. | Oct 14, 2026 |
| **DEC-021** | **CEO Authorization for a Private Team Management Preview Using Shared Supabase** | The CEO selected “Use shared live database” for the Vercel Preview. Authorizes a push to a non-production preview branch and permits the preview to use the existing shared Supabase connection. The CEO was informed that preview actions could change live staff records. This is not authorization to deploy to `main`, run tests that change live business data, apply Migration 13, or enable invitation acceptance. | Oct 14, 2026 |

---

## 2. Pending CEO Decisions

| Item ID | Decision Required | Available Options & Context | Current Status |
| :--- | :--- | :--- | :--- |
| **OQ-001** | **Project Control System Activation** | Formal sign-off on the permanent project-control files ([AGENTS.md](file:///c:/Users/nimth/Desktop/Developments/stack37-eos/AGENTS.md), [PROJECT_STATE.md](file:///c:/Users/nimth/Desktop/Developments/stack37-eos/PROJECT_STATE.md), `docs/*`). | **Closed** — Authorized and synchronized to `feature/phase1-foundation` in Commit `823caab`. |
| **OQ-002** | **Authorization for Foundation Stabilization** | Authorization to execute `TASK-STAB-002`: reconcile Phase 3C.3, verify remote database, run test regression, and commit to Git. | **Closed** — Authorized and synchronized to `feature/phase1-foundation` in Commit `d17ed63`. |
| **OQ-003** | **UI/UX Design Review & Approval** | Actual Codex mockup and refinements approved by CEO. Reference archived at `docs/references/TASK-STAB-003-approved-design.html`. | Closed — TASK-STAB-003 design and TASK-STAB-004 implementation accepted |
| **OQ-004** | **Commercial Pricing & Packaging** | Approved subscription tier names and monthly/annual pricing amounts in LKR and USD. | Proposal pending; plan price is placeholder `0.00`. |
| **OQ-005** | **Primary Payment Gateway Selection** | Selection between Lemon Squeezy (international cards) and local Sri Lankan payment gateways (PayHere / WEBXPAY for LKR). | Database decoupled (Migration 08); integration paused. |

---

## 3. Rejected Proposals

| Rejection ID | Rejected Proposal | Reason for Rejection | Date Rejected |
| :--- | :--- | :--- | :--- |
| **REJ-001** | **Separate Codebases for Retail & Equipment Rental** | Splitting the codebase into separate products duplicates maintenance costs, fragments bug fixes, and violates the single configurable platform principle. | Oct 13, 2026 |
| **REJ-002** | **Treating Generic Tax Status Dropdown as Independent VAT/SSCL Controls** | Sri Lankan tax legislation treats VAT and SSCL as distinct statutory obligations. A general dropdown does not provide independent registration settings. | Oct 13, 2026 |
| **REJ-003** | **Invented Emerald-Green Branding & "37" Badge** | Deviates from official STACK37 corporate visual identity (navy typography, blue/violet palette, official logo). | Oct 13, 2026 |
| **REJ-004** | **Starting Team Management or ERP Modules Before Stabilization** | Skipping Foundation Stabilization and UI/UX Approval risks technical debt, uncommitted regressions, and visual inconsistency. | Oct 13, 2026 |
| **REJ-005** | **Scheduling Subscription Payments After Public Launch** | A public SaaS launch requires subscription checkout and trial-expiry handling to be operational before accepting customers. | Oct 13, 2026 |
| **REJ-006** | **Multiple Primary Owners per Organization** | Creating shared ownership introduces legal ambiguity in audit logging, dispute deadlocks, and authorization race conditions. | Oct 11, 2026 |
