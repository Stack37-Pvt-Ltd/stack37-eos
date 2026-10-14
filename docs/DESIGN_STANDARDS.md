# STACK37 EOS — Product Design Standards

**Product:** STACK37 EOS / My Business by STACK37  
**Governance:** Chief Executive Officer, STACK37 (Pvt) Ltd  
**Design Approval Status:** **CEO APPROVED** in the Codex conversation on October 13, 2026 (`TASK-STAB-003`). Implementation under `TASK-STAB-004` was accepted by the CEO on October 14, 2026.

---

## 1. Corporate Brand Identity & Visual Direction

### 1.1 Official Brand Assets & Guidelines
* **Approved Corporate Reference:** **`stack37.com`** (the official corporate identity benchmark).
* **Corporate Logo:** Uses the official STACK37 corporate logo and typography.  
  *(All temporary emerald-green branding, green badge containers, and invented "37" logos are permanently deprecated and rejected per Decision `REJ-003`).*
* **Typography:** **Geist**, matching the corporate website; Geist Mono for short metadata/identifiers. The application self-hosts fonts with `next/font`. Navy `#172334` headings and slate body text; use a system/Arial fallback where web fonts are unsupported (especially email clients).
* **Surface & Palette Direction:** Clean white surfaces and pale blue-grey backgrounds (`#f8fafc`, `#f1f5f9`), balanced by **restrained blue / violet accents** (`#2563eb`, `#4f46e5`, `#3b82f6`).
* **Visual Ownership:** **ChatGPT Codex** is the designated UI/UX & Frontend Owner responsible for visual design exploration and page styling. Google Antigravity maintains backend stability, data integrity, and documentation consistency without altering visual tokens.

### 1.2 Unified UI Design Approval Status
The CEO approved the actual Codex exploration and subsequent refinements: modern minimal pages, concise copy, official logo, Geist, navy square buttons and **horizontal workspace navigation with no fixed left sidebar**. The exact reference is archived in `docs/references/TASK-STAB-003-approved-design.html`; its original is in the Codex visualization folder for conversation `01a1356f-f00b-7150-afc2-b60388893ace`. Application implementation was accepted under `TASK-STAB-004` on October 14, 2026.

---

## 2. Product UI Principles & Structural Baseline

### 2.1 Information Architecture & Layout
* **Multi-Tenant Separation:** Dedicated workspace portal at `[tenant-slug].stack37.com`.
* **Clean Sectional Hierarchy:** One clear page title, concise supporting copy, whitespace and thin rules. Group related information without excessive cards or decorative panels.
* **Navigation:** Horizontal workspace links, a workspace dropdown and visible sign-out action. Settings sections use a horizontal scrollable row on mobile. Never introduce a persistent left sidebar without CEO design approval.
* **Controls:** Sharp square navy primary actions; square outline secondary actions; restrained blue focus and active states. Primary controls are at least 44px high, with visible keyboard focus and disabled/loading states. Error and warning colors communicate status rather than branding.
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
   * Concise copy explains that confirmation completes on the next page, preserving the deliberate-confirmation protection against email scanners. Existing token, URL and redirect behavior must remain unchanged.
4. **Time-Limited Recovery Advisory:**
   * Password reset emails explicitly state the 15-minute **recovery session after confirmation**. Do not incorrectly label the initial email token as expiring in 15 minutes.
5. **Plaintext Fallback:** Every transactional HTML template must include an identical, cleanly formatted plaintext alternative for accessibility and text-only mail clients.
6. **Standard Sender Address:** `STACK37 <noreply@stack37.com>`.

---

## 4. TASK-STAB-004 implementation review

The CEO approved the design under `TASK-STAB-003` and accepted the local implementation under `TASK-STAB-004`. Screen captures, test evidence, the integration handoff comparison, and remaining limitations are recorded in `docs/reviews/TASK-STAB-004/REPORT.md`. The implementation remains local and unpushed; this acceptance does not authorize deployment.

## 5. Approved implementation patterns and future consistency

- Corporate tokens are declared in `src/app/globals.css`. Use `brand-navy`, `brand-blue`, `brand-violet`, `brand-surface` and `brand-line` with shared primitives in `src/components/ui/`.
- Reuse `Brand`, `Button`, `Input`, `Alert` and `Card` for future approved features. Use `Button asChild` for links to avoid nesting interactive controls. Keep heading levels appropriate to the page.
- Reuse `WorkspaceFrame` and `WorkspaceNavigation`; retain all existing public tenant URLs and backend access checks. Workspace switching continues to use the existing URL helper.
- Authentication and business registration have their own shared shells. Keep all action contracts, password validation, loading locks and confirmation behavior intact.
- Future tables follow the approved exploration's clean header, clear column labels, aligned numbers, thin row dividers and responsive overflow/item presentation. No ERP table/module was added by this task.
- Reference-only concepts (including independent VAT/SSCL switches) require approved scope and an Antigravity backend contract before implementation. The existing tax status field remains the supported application control.
- Email draft assets are in `docs/email-templates/`; activation and mail-client/delivery testing require separate coordination. They are not active hosted templates.
- Verification evidence and screen captures: `docs/reviews/TASK-STAB-004/`. Frontend fixture tests use the actual components with mocked data/actions and are not production end-to-end proof.
