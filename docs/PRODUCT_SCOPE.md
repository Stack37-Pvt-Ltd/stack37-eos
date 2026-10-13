# STACK37 EOS — Product Master Scope

**Product:** STACK37 EOS (Enterprise Operating System)  
**Customer-Facing Brand:** My Business by STACK37  
**Governance:** Chief Executive Officer, STACK37 (Pvt) Ltd  
**Document Status:** Pending CEO Review  

---

## 1. Product Vision & Positioning

STACK37 EOS is a cloud-based business management and enterprise operating platform designed to provide small-to-medium enterprises (SMEs) with operational rigor, staff accountability, and unified data without the prohibitive cost and complexity of legacy ERP suites.

### Core Architectural Principle: Single Configurable Platform
- **Unified Core Platform:** STACK37 EOS is built as **one configurable platform** adaptable to diverse industries through modular configurations, settings, and workflows.
- **Strict Anti-Forking Rule:** Under no circumstances will the codebase be split or forked into separate industry-specific software products.
- **Pilot Scenarios as Requirement Validation Testbeds:**
  - **UK Super Pilot (Supermarket / Retail):** A pilot scenario used strictly to validate fast barcode scanning, high-frequency checkout, real-time stock depletion, expiry date tracking, and retail cash-drawer reconciliations.
  * **Construction Equipment Rental Pilot:** A pilot scenario used strictly to validate serialized fixed-asset tracking, time-based hire contracts, security deposits, dispatch/return inspection checklists, and recurring rental billing.
  * *Confirmed Decision:* Neither pilot scenario constitutes a standalone product. Both serve solely to validate that the core platform's configuration capabilities can support contrasting business workflows.

---

## 2. Target Market & Geographic Focus

### 2.1 Target Customers
- **Target Segment:** Small and Medium-sized Enterprises (SMEs) requiring operational control across sales, purchasing, inventory, staff, and cashflow. *(No speculative employee-count ranges; flexible to diverse SME scales).*
- **Primary Operational Focus:** Businesses operating one legal company with one or more operating locations (e.g., central office, store, or warehouse).

### 2.2 Initial Geographic Focus (Sri Lanka)
The first commercial launch market is **Sri Lanka**. The platform natively supports:
- **Primary Currency:** Sri Lankan Rupee (`LKR`) as standard baseline.
- **Timezone:** `Asia/Colombo` (`UTC+05:30`).
- **Entity Identification:** Business Registration Numbers (BRN) and Taxpayer Identification Numbers (TIN).
- **Independent Tax Regimes:** Separate, independent configuration settings for **VAT registration** and **SSCL registration**.
- **Global Architecture Preserved:** Multi-currency support (USD, EUR, GBP, AUD, CAD, SGD, AED, INR, JPY) and regional configuration tables are preserved to enable future international expansion without refactoring.

---

## 3. Scope Boundaries: Commercial Release vs Future Vision

### 3.1 First Commercial Release Scope (Mandatory Launch Scope)
To achieve a viable, paid commercial release, the platform must deliver:
1. **Core Multi-Tenant Operating Foundation:** Subdomain isolation, email auth, organizational onboarding, headquarters facility provisioning, and business profile setup.
2. **Team Collaboration & Staff Management:** Inviting employees by email, assigning system Administrator and Member roles, and assigning staff to specific branches.
3. **Connected Core ERP Modules:**
   - **Sales:** Customer management, price quotations, sales invoicing, tax calculation, and payment receipts.
   - **Purchasing:** Supplier management, purchase orders, and goods received notes (GRN).
   - **Inventory:** Master product/service catalog, SKU/barcode tracking, multi-branch stock balances, inter-branch transfers, and stock adjustments.
   - **Basic Finance:** Cash and bank ledgers, accounts receivable, accounts payable, and daily cashflow overview.
4. **Commercialization & Subscription Gateways:**
   - 7-day automatic free trial on registration.
   - Self-service paid subscription checkout (integrating payment gateways for international cards and local Sri Lankan payments).
   - Automated trial-expiry handling and workspace access locking.

### 3.2 Single Legal Entity with Multi-Branch Support
- **Confirmed Launch Scope:** The system supports **one legal corporation/company** per organization account, with support for **multiple operating branches/facilities** (Headquarters, Store 1, Warehouse 2, etc.).
- **Headquarters Invariant:** Every organization automatically provisions a permanent Headquarters branch (`is_headquarters = true, code = 'HQ'`).

### 3.3 Multi-Entity Group Operations (Documented Future Vision)
- **Status:** **Future Vision (Deferred)**
- Managing multiple distinct legal corporate entities (holding companies, sister subsidiaries) under a single consolidated group account is recognized as a future capability, but is explicitly excluded from the initial commercial release.

---

## 4. Statutory Tax Architecture & Compliance

### 4.1 Independent VAT & SSCL Configuration
- **VAT registration** and **SSCL (Social Security Contribution Levy) registration** must be configured as **independent business settings** in the workspace configuration.
- A business may be:
  - Unregistered for both taxes (non-VAT, non-SSCL)
  - Registered for VAT only
  - Registered for SSCL only
  - Registered for both VAT and SSCL
- *Implementation Reality Check:* The existing form fields (single `tax_id` and general `tax_status` dropdown) do NOT constitute independent VAT/SSCL controls. Dedicated controls will be built under validated requirements.

### 4.2 Evidence-Based Calculation Rules
- Tax calculation logic, invoice line-item disclosures, tax invoices, and reporting outputs will be developed **only against validated, confirmed statutory formulas**.
- Speculative tax calculations, hardcoded tax rates, or guessed exemption lists are strictly prohibited.

---

## 5. Commercialization & Packaging Status

- **7-Day Free Trial:** Confirmed. Every new organization receives 7 days of full access.
- **Pricing & Packaging:** **Undecided.** Subscription prices (in LKR and USD), tier structures, and package names remain unapproved proposals pending CEO commercial review.
- **Launch Requirement:** Subscription checkout and trial-expiry handling must be operational **before** paid public commercial launch.
