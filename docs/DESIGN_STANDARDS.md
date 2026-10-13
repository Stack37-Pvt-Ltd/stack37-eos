# STACK37 EOS — Product Design Standards

**Product:** STACK37 EOS / My Business by STACK37  
**Governance:** Chief Executive Officer, STACK37 (Pvt) Ltd  
**Design Approval Status:** **PENDING CEO APPROVAL** (Scheduled under `TASK-STAB-003`)  

---

## 1. Corporate Brand Identity & Visual Direction

### 1.1 Official Brand Assets & Guidelines
* **Approved Corporate Reference:** **`stack37.com`** (the official corporate identity benchmark).
* **Corporate Logo:** Uses the official STACK37 corporate logo and typography.  
  *(All temporary emerald-green branding, green badge containers, and invented "37" logos are permanently deprecated and rejected per Decision `REJ-003`).*
* **Typography:** Deep corporate navy and dark typography (`#0f172a` / `#1e293b`) for headings, labels, and text, establishing executive enterprise credibility and contrast.
* **Surface & Palette Direction:** Clean white surfaces and pale blue-grey backgrounds (`#f8fafc`, `#f1f5f9`), balanced by **restrained blue / violet accents** (`#2563eb`, `#4f46e5`, `#3b82f6`).
* **Visual Ownership:** **ChatGPT Codex** is the designated UI/UX & Frontend Owner responsible for visual design exploration and page styling. Google Antigravity maintains backend stability, data integrity, and documentation consistency without altering visual tokens.

### 1.2 Unified UI Design Approval Status
> [!IMPORTANT]
> **Pending Executive Review:**  
> The final unified product UI design system—including corporate logo rendering, exact Tailwind tokens, sidebar navigation styling, and component library styling—is **AWAITING FORMAL CEO APPROVAL** under upcoming milestone `TASK-STAB-003` (UI/UX Design Approval led by Codex).  
> Existing application code retains its functional structure until that review is authorized and conducted.

---

## 2. Product UI Principles & Structural Baseline

### 2.1 Information Architecture & Layout
* **Multi-Tenant Separation:** Dedicated workspace portal at `[tenant-slug].stack37.com`.
* **Clean Sectional Hierarchy:** Clear page titles, breadcrumbs, and distinct card-based groupings.
* **Form Structure:**
  * Grouped related fields (Company Profile, Contact Channels, Address, Tax & Accounting).
  * Clear labels, descriptive helper text, and real-time inline validation feedback.
  * Explicit Primary Action buttons with loading states (`isSaving` spinners) and clear success/error banners.

### 2.2 Responsive Baseline & Accessibility
* **Mobile Responsiveness:** All application screens must render cleanly and function without horizontal overflow or clipped inputs down to a minimum **375px mobile viewport width**.
* **Contrast & Legibility:** Minimum 4.5:1 contrast ratio on all body text and form inputs to ensure accessibility and professional readability.
* **Touch Targets:** Minimum 40px touch targets for all mobile buttons and interactive controls.

---

## 3. Transactional Authentication Email Standards

All customer-facing transactional emails (Account Confirmation, Password Recovery, Team Invitations) must comply with the approved enterprise email standard:

### 3.1 Structural Requirements
1. **Responsive Table-Based Layout:** Max-width 560px card container, centered on light neutral background (`#f8fafc`), compatible across Outlook, Apple Mail, Gmail, and mobile clients.
2. **Official Header:** Features the official STACK37 corporate header mark.
3. **Scanner-Proof Link Architecture:**
   * Direct verification links open an intermediate confirmation landing page.
   * Prominent security advisory box explains that deliberate confirmation protects against corporate automated security/spam scanners prematurely consuming single-use tokens.
4. **Time-Limited Recovery Advisory:**
   * Password reset emails explicitly state the 15-minute validity window for recovery sessions.
5. **Plaintext Fallback:** Every transactional HTML template must include an identical, cleanly formatted plaintext alternative for accessibility and text-only mail clients.
6. **Standard Sender Address:** `STACK37 <noreply@stack37.com>`.

---

## 4. Design Transition Plan for Task 003 (UI/UX Approval)

When `TASK-STAB-003` is authorized by the CEO, the design engineering team will:
1. Integrate the high-resolution official STACK37 corporate logo into the workspace header and authentication screens.
2. Standardize the application's Tailwind / CSS color tokens around the approved corporate navy typography and blue/violet palette.
3. Present full desktop and mobile browser previews for CEO review and sign-off before committing changes to Git.
