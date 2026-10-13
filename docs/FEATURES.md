# STACK37 EOS — Feature Register

**Product:** STACK37 EOS / My Business by STACK37  
**Governance:** Chief Executive Officer, STACK37 (Pvt) Ltd  
**Document Status:** Pending CEO Review  

---

## 1. Classification & Evidence Framework

To eliminate ambiguity, all features are tracked with rigorous evidence tiers:
* **Committed Code:** Code merged to Git branch `feature/phase1-foundation`.
* **Locally Tested:** Implemented in local working directory; validated via unit tests and browser inspection.
* **Deployed DB Migrations:** Migration SQL successfully executed on the remote/live Supabase database (`xbiadendaxhoyrcvaybf`).
* **Publicly Deployed:** Live on production web hosting (e.g., Vercel).
* **CEO-Accepted:** Formally demonstrated, verified, and accepted by executive leadership.

### Status Categories:
- **COMPLETED_COMMITTED:** Fully committed in Git, migrations deployed (where applicable), test verified.
- **IMPLEMENTED_LOCAL:** Built locally and tested; awaiting Foundation Stabilization & Git commit.
- **PLANNED_LAUNCH:** Approved mandatory requirement for First Commercial Release.
- **PROPOSED:** Under evaluation; requires requirement validation and CEO approval.
- **FUTURE_VISION:** Documented long-term capability; deferred beyond first commercial release.

---

## 2. Master Roadmap Coverage & Reconciliation Notice

> [!IMPORTANT]
> **Reconciliation against the 138-Capability Master Roadmap:**  
> The authoritative [STACK37 EOS Development Master Roadmap v1.0](file:///c:/Users/nimth/Desktop/Developments/stack37-eos/docs/references/STACK37_EOS_Development_Master_Roadmap_v1.pdf) is version-controlled at `docs/references/STACK37_EOS_Development_Master_Roadmap_v1.pdf`.  
> It defines **138 tracked capabilities** organized across 10 shared platform responsibilities and 13 requirement families:
> - **PL:** Platform, accounts and SaaS experience (PL-01 to PL-16)
> - **ORG:** Organization and operational structure (ORG-01 to ORG-08)
> - **MD:** Shared parties and catalogue master data (MD-01 to MD-10)
> - **SAL:** Sales and invoicing (SAL-01 to SAL-12)
> - **PUR:** Purchasing and suppliers (PUR-01 to PUR-10)
> - **INV:** Inventory, warehousing and logistics (INV-01 to INV-14)
> - **FIN:** Finance and accounting (FIN-01 to FIN-15)
> - **CRM:** Customer growth, marketing and service (CRM-01 to CRM-08)
> - **HR:** Workforce, HR and payroll (HR-01 to HR-09)
> - **PRJ:** Projects, assets, facilities and contracts (PRJ-01 to PRJ-08)
> - **WF:** Workflow, audit, compliance and governance (WF-01 to WF-09)
> - **MFG:** Manufacturing and production (MFG-01 to MFG-07)
> - **INT:** Integration, reporting and AI (INT-01 to INT-12)
>
> The tables below map the **Active Development Baseline (First Commercial Release Scope)** and **Long-Term Enterprise Modules**, maintaining 1-to-1 traceability with the master PDF without promoting future vision prematurely into development commitments.

---

## 3. Active Development Baseline (First Commercial Release Scope)

| Feature ID | Feature Name | Priority | Status | Dependencies | Implementation Evidence & Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FEAT-AUTH-001** | **Email & Password Authentication**<br>Registration, login, and secure session management via Supabase GoTrue. | P0 | **COMPLETED_COMMITTED** | None | **Committed:** Commit `344bcab`<br>**Deployed DB:** Migrations 01–07<br>**Locally Tested:** `auth-actions.test.ts` |
| **FEAT-AUTH-002** | **Scanner-Proof Email Confirmation**<br>Intermediate confirmation page protecting single-use verification links from enterprise email scanners. | P0 | **COMPLETED_COMMITTED** | FEAT-AUTH-001 | **Committed:** Commit `344bcab`<br>**Locally Tested:** Verified in browser & unit tests |
| **FEAT-AUTH-003** | **Cryptographic Password Recovery**<br>15-minute HMAC-signed, single-use, user-bound password recovery mechanism. | P0 | **COMPLETED_COMMITTED** | FEAT-AUTH-001 | **Committed:** Commit `d08514e`<br>**Locally Tested:** `recovery-auth.test.ts` |
| **FEAT-AUTH-004** | **Organization Switcher Portal**<br>Workspace selector screen at `/select-organization` for users with multi-tenant access. | P1 | **COMPLETED_COMMITTED** | FEAT-AUTH-001 | **Committed:** Commit `d08514e`<br>**Locally Tested:** Page & actions verified |
| **FEAT-CORE-001** | **Subdomain Multi-Tenancy Routing**<br>Host-based reverse proxy routing workspaces to `[tenant-slug].domain.com`. | P0 | **COMPLETED_COMMITTED** | None | **Committed:** Commit `b4b88b6`<br>**Locally Tested:** `proxy-routing.test.ts` |
| **FEAT-CORE-002** | **Row Level Security (RLS) Isolation**<br>PostgreSQL database-level isolation enforcing tenant data segregation. Direct client writes revoked. | P0 | **COMPLETED_COMMITTED** | None | **Committed:** Commit `be10d59`<br>**Deployed DB:** Migrations 02–06<br>**Locally Tested:** `tenant-isolation.test.ts` |
| **FEAT-CORE-003** | **Immutable Audit Log Infrastructure**<br>Private schema audit logging recording sensitive operational and security events. | P0 | **COMPLETED_COMMITTED** | None | **Committed:** Commit `8039975`<br>**Deployed DB:** Migration 01 (`private.insert_audit_log`) |
| **FEAT-ONBD-001** | **Atomic Business Registration**<br>One-step creation of organization, owner membership, 7-day trial, and workspace provisioning. | P0 | **COMPLETED_COMMITTED** | FEAT-CORE-002 | **Committed:** Commit `7f88f2c`<br>**Deployed DB:** Migrations 08, 09, 12 (`create_business` RPC) |
| **FEAT-ONBD-002** | **Headquarters & Foundational RBAC Provisioning**<br>Automatic initialization of HQ branch (`is_headquarters=true, code='HQ'`), Administrator role (system), and Member role (standard). | P0 | **COMPLETED_COMMITTED** | FEAT-ONBD-001 | **Committed:** Commit `eb4c9b6`<br>**Deployed DB:** Migrations 10, 12<br>**Locally Tested:** `workspace-provisioning.test.ts` |
| **FEAT-SETT-001** | **Business Entity Profile Setup**<br>Primary Owner configuration of trading name, legal name, registration number (BRN), category, contact info, and address. | P1 | **IMPLEMENTED_LOCAL** | FEAT-ONBD-002 | **Uncommitted Local Code:** `src/app/.../settings/`<br>**Deployed DB:** Migration 11<br>**Locally Tested:** `business-configuration.test.ts` |
| **FEAT-SETT-002** | **Headquarters Branch Settings**<br>Primary Owner configuration of Headquarters facility name, contact phone, and physical address. | P1 | **IMPLEMENTED_LOCAL** | FEAT-SETT-001 | **Uncommitted Local Code:** `src/components/...form.tsx`<br>**Deployed DB:** Migration 11, 12<br>**Locally Tested:** Browser & unit tests |
| **FEAT-SETT-003** | **Basic Tax ID & General Classification**<br>Capture of single Tax ID (TIN) and general tax classification dropdown (`standard`, `vat_registered`, `exempt`, `simplified`). | P1 | **IMPLEMENTED_LOCAL** | FEAT-SETT-001 | **Uncommitted Local Code:** `organization.ts`<br>**Deployed DB:** Migration 11<br>**Locally Tested:** Unit tests pass |
| **FEAT-TAX-001** | **Independent VAT & SSCL Registration Controls**<br>Separate, independent business settings for VAT registration and SSCL registration. | P1 | **PLANNED_LAUNCH** | FEAT-SETT-001 | **INCOMPLETE / UNBUILT.** General dropdown in FEAT-SETT-003 does NOT satisfy this requirement. |
| **FEAT-TEAM-001** | **Staff Email Invitations & Role Assignment**<br>Owner/Admin workflow to invite staff members by email, assign Administrator or Member role, and bind to branches. | P1 | **PLANNED_LAUNCH** | FEAT-ONBD-002 | **INCOMPLETE / UNBUILT.** Database table `invitations` exists (Migration 03); frontend UI and mailer unbuilt. |
| **FEAT-INVT-001** | **Product & Service Master Catalog**<br>Master catalog for physical goods and services (Name, SKU, Barcode, UOM, Cost Price, Selling Price, Tax flags). | P1 | **PLANNED_LAUNCH** | FEAT-SETT-001 | **INCOMPLETE / UNBUILT.** Required for First Commercial Release. |
| **FEAT-INVT-002** | **Multi-Branch Inventory Balances**<br>Real-time branch inventory levels, stock adjustments with reason logging, and inter-branch stock transfers. | P1 | **PLANNED_LAUNCH** | FEAT-INVT-001 | **INCOMPLETE / UNBUILT.** Required for First Commercial Release. |
| **FEAT-PURC-001** | **Supplier Management & Purchase Orders**<br>Supplier directory, Purchase Orders (PO), and Goods Received Notes (GRN) to receive stock into branches. | P1 | **PLANNED_LAUNCH** | FEAT-INVT-001 | **INCOMPLETE / UNBUILT.** Required for First Commercial Release. |
| **FEAT-SALE-001** | **Customer Directory & Quotations**<br>Customer accounts, price quotations, and one-click quotation-to-invoice conversion. | P1 | **PLANNED_LAUNCH** | FEAT-INVT-001 | **INCOMPLETE / UNBUILT.** Required for First Commercial Release. |
| **FEAT-SALE-002** | **Sales Invoicing & Tax Calculation**<br>Commercial invoices with verified statutory VAT and SSCL calculations, stock deductions, and PDF output. | P1 | **PLANNED_LAUNCH** | FEAT-SALE-001<br>FEAT-TAX-001 | **INCOMPLETE / UNBUILT.** Calculations must use validated rules only. Required for Commercial Release. |
| **FEAT-FINA-001** | **Basic Finance & Cashflow Ledger**<br>Cash/bank accounts, customer payment receipts, supplier payments, accounts receivable (AR), and accounts payable (AP). | P1 | **PLANNED_LAUNCH** | FEAT-SALE-002<br>FEAT-PURC-001 | **INCOMPLETE / UNBUILT.** Required for First Commercial Release. |
| **FEAT-BILL-001** | **Subscription Checkout & Payment Gateways**<br>Paid subscription checkout for international cards (Lemon Squeezy) and local Sri Lankan payments (LKR). | P1 | **PLANNED_LAUNCH** | FEAT-ONBD-001 | **INCOMPLETE / UNBUILT.** Must be operational BEFORE paid commercial public launch. |
| **FEAT-BILL-002** | **Automated Trial Expiration & Access Locking**<br>Graceful transition to read-only workspace upon expiration of 7-day trial without active subscription. | P1 | **PLANNED_LAUNCH** | FEAT-BILL-001 | **INCOMPLETE / UNBUILT.** Must be operational BEFORE paid commercial public launch. |
| **FEAT-POS-001** | **Retail Checkout Mode (UK Super Pilot)**<br>Fast barcode scanning, touch layout, cash drawer trigger, receipt printing. | P2 | **PROPOSED** | FEAT-INVT-002<br>FEAT-SALE-002 | **Requirement validation scenario only;** not a standalone product. |
| **FEAT-RENT-001** | **Equipment Rental Mode (Equipment Pilot)**<br>Serialized machinery hire, time-based contracts, security deposits, return checklists. | P2 | **PROPOSED** | FEAT-INVT-001<br>FEAT-SALE-002 | **Requirement validation scenario only;** not a standalone product. |

---

## 3. Complete Long-Term Product Catalogue (Future Capabilities)

The following capabilities constitute the long-term enterprise vision for STACK37 EOS beyond the First Commercial Release:

| Feature ID | Feature Name & Scope | Priority | Status | Dependencies | Long-Term Business Value |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FEAT-BRAN-001** | **Multi-Branch Facility Expansion**<br>Self-service creation and management of secondary operating branches, store outlets, and regional warehouses beyond Headquarters. | P2 | **FUTURE_VISION** | FEAT-SETT-002 | Allows expanding businesses to add unlimited retail stores and warehouses under one legal company. |
| **FEAT-DOM-001** | **Custom Domain Mapping & SSL**<br>Binding custom enterprise vanity domains (e.g. `erp.clientcompany.com`) to workspace subdomains. | P2 | **FUTURE_VISION** | FEAT-CORE-001 | Table `domains` exists (Migration 02). Enables white-label presence for enterprise customers. |
| **FEAT-HR-001** | **Human Resources & Payroll**<br>Staff records, attendance tracking, leave management, automated payroll generation, and Sri Lankan statutory EPF/ETF contribution filing. | P3 | **FUTURE_VISION** | FEAT-TEAM-001 | Eliminates third-party payroll software and automates monthly labor compliance. |
| **FEAT-CRM-001** | **Customer Relationship Management (CRM)**<br>Lead capture, sales pipeline stages, communication activity logs, deal tracking, and customer contact history. | P3 | **FUTURE_VISION** | FEAT-SALE-001 | Enables proactive sales pipeline tracking and relationship history before quotation issuance. |
| **FEAT-ANLY-001** | **Advanced BI & Financial Analytics**<br>Executive dashboards, product gross margin analytics, customer lifetime value, inventory turnover metrics, and formal P&L statements. | P3 | **FUTURE_VISION** | FEAT-FINA-001 | Provides managing directors with deep operational intelligence and margin visibility. |
| **FEAT-PORT-001** | **Customer & Vendor Self-Service Portal**<br>External authenticated client portal allowing customers to view open quotes, download past invoices, and pay online. | P3 | **FUTURE_VISION** | FEAT-SALE-002 | Reduces administrative burden of resending invoices and tracking payment confirmations. |
| **FEAT-BARC-001** | **Barcode & Shelf Label Printing**<br>Integrated generation and bulk printing of product barcode labels and retail shelf pricing tags. | P2 | **FUTURE_VISION** | FEAT-INVT-001 | Streamlines retail and warehouse stock labeling workflows. |
| **FEAT-FX-001** | **Multi-Currency Realized/Unrealized FX**<br>Automated foreign exchange rate feeds, currency revaluation, and ledger tracking of realized and unrealized FX gains/losses. | P3 | **FUTURE_VISION** | FEAT-FINA-001 | Essential for import/export businesses managing receivables and payables in USD, EUR, and LKR. |
| **FEAT-MULT-001** | **Multi-Entity Holding Groups**<br>Managing multiple distinct legal corporations under one consolidated group holding account with inter-company eliminations. | P3 | **FUTURE_VISION** | FEAT-FINA-001 | Supports enterprise holding groups operating sister corporations under single management. |

