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

---

## 2. Pending CEO Decisions

| Item ID | Decision Required | Available Options & Context | Current Status |
| :--- | :--- | :--- | :--- |
| **OQ-001** | **Project Control System Activation** | Formal sign-off on the proposed permanent project-control files ([AGENTS.md](file:///c:/Users/nimth/Desktop/Developments/stack37-eos/AGENTS.md), [PROJECT_STATE.md](file:///c:/Users/nimth/Desktop/Developments/stack37-eos/PROJECT_STATE.md), `docs/*`). | Under CEO Review (`TASK-STAB-001`) |
| **OQ-002** | **Authorization for Foundation Stabilization** | Authorization to execute `TASK-STAB-002`: reconcile Phase 3C.3, verify remote database, run test regression, and commit to Git. | Pending CEO Green Light |
| **OQ-003** | **UI/UX Design Review & Approval** | Formal review of corporate visual identity, official logo assets, navy typography, and blue/violet UI design (`TASK-STAB-003`). | Pending CEO Green Light |
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
