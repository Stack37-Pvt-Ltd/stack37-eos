# STACK37 EOS — Canonical Backend Integration Readiness Specification

**Document Path:** `docs/integration/backend_integration_readiness.md`\
**Author:** Google Antigravity (Backend Engineering & System Logic Owner)\
**Target Audience:** ChatGPT Codex (UI/UX & Frontend Owner), ChatGPT (Product Coordination), Chief Executive Officer\
**Baseline Commit:** `d17ed63` (`feature/phase1-foundation`)\
**Status:** **AUTHORITATIVE REPOSITORY SPECIFICATION — TASK-STAB-005B**

---

## 1. Executive Summary & Purpose

The Chief Executive Officer authorized ChatGPT Codex to implement `TASK-STAB-004` (the approved STACK37 UI redesign). Google Antigravity has performed an exhaustive verification of all existing backend systems across:
1. Multi-Tenant Identity & Authentication
2. Atomic Business Registration & Workspace Provisioning
3. Next.js 16 Edge Proxy Subdomain Routing
4. Cross-Tenant Organization Selection & Switching
5. 7-Day Trial Subscriptions & Operational State Resolution
6. Business Setup & Headquarters Configuration

This specification serves as the authoritative, binding contract between the backend services and Codex's redesigned frontend components. It guarantees that:
- **0 Business Logic Regressions:** All Server Actions, security definer RPCs, and RLS policies operate flawlessly without modification.
- **Defensive Validation & Structured Error Mapping:** Every user input is strictly validated on both client (Zod) and server, returning predictable `{ success, error, fieldErrors }` contracts.
- **Enterprise Security Invariants:** Anti-enumeration authentication, scanner-proof email verification, 15-minute cryptographically signed recovery tokens, and single-owner guards remain 100% enforced.
- **Accurate Scope Boundaries:** Independent VAT and SSCL registration controls remain classified as **NOT YET IMPLEMENTED**.

---

## 2. Complete Inventory of Backend Operations & Contracts

### A. Authentication & Recovery Operations (`src/lib/actions/auth.ts`)

| Action / Operation | Input Payload Model | Success Return Contract | Failure / Error Return Contract | Security Invariants |
| :--- | :--- | :--- | :--- | :--- |
| **`loginAction`** | `rawInput: LoginInput`<br>• `email: string` (RFC format, lowercase, max 255)<br>• `password: string` (min 1, max 128) | `{ success: true, data: { userId: string, email: string } }` | `{ success: false, error: "Invalid email address or password.", fieldErrors?: Record<string, string> }` | **Anti-Enumeration Defense:** Generic error message prevents determining whether the email address exists in the system. |
| **`signupAction`** | `rawInput: SignupInput`<br>• `fullName: string` (2–100 chars)<br>• `email: string` (RFC format)<br>• `password: string` (8–128 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character)<br>• `confirmPassword: string` | `{ success: true, emailConfirmationRequired: boolean, data: { userId: string, email: string } }` | `{ success: false, error: string, fieldErrors?: Record<string, string> }` | When email confirmation is active in Supabase, `data.session` is null and `emailConfirmationRequired` returns `true`. The UI must display the confirmation card rather than redirecting. |
| **`forgotPasswordAction`** | `rawInput: ForgotPasswordInput`<br>• `email: string` (RFC format) | `{ success: true, data: { message: "If an account exists with this email address, a password reset link has been dispatched." } }` | `{ success: false, error: "Please enter a valid email address." }` | **Anti-Enumeration Defense:** Returns identical generic success notice whether the email is registered or not. |
| **`confirmOtpAction`** | `input: ConfirmOtpInput`<br>• `tokenHash: string`<br>• `type: EmailOtpType` (`'email'` \| `'signup'` \| `'recovery'` \| `'invite'` \| `'magiclink'`)<br>• `next?: string` (sanitized relative path) | `{ success: true, data: { redirectTo: string } }` | `{ success: false, error: "The verification link is invalid or has expired. Please request a new one." }` | **Scanner-Proof Invariant:** Single-use tokens are NEVER consumed on GET page load. An intermediate card must require a human button click. When `type === 'recovery'`, server issues an HTTP-only 15-minute `sb-recovery-token` cookie. |
| **`resetPasswordAction`** | `rawInput: ResetPasswordInput`<br>• `password: string` (enterprise complexity)<br>• `confirmPassword: string` | `{ success: true, data: { message: "Password successfully updated. You may now sign in with your new credentials." } }` | `{ success: false, error: string, fieldErrors?: { password?: string } }` | **Requires Verified Recovery Cookie:** Calling without the `sb-recovery-token` cookie fails with an unauthorized error. Traps `same_password` and `weak_password`. Clears cookie upon success. |
| **`logoutAction`** | `options?: { scope?: 'local' \| 'global' }` | `{ success: true }` | `{ success: false, error: "Failed to log out. Please try again." }` | Clears Supabase auth session cookies. Scope `'local'` clears current device; `'global'` revokes all refresh tokens. |

---

### B. Business Registration & Provisioning (`src/lib/actions/organization.ts`)

| Action / Operation | Input Payload Model | Success Return Contract | Failure / Error Return Contract | Atomic Database Operations |
| :--- | :--- | :--- | :--- | :--- |
| **`createBusinessAction`** | `rawInput: CreateBusinessInput`<br>• `name: string` (2–100 chars)<br>• `slug: string` (3–63 chars, regex `SLUG_REGEX`, non-reserved)<br>• `countryCode: string` (2-letter ISO, e.g. `'LK'`, `'US'`) | `{ success: true, data: { organizationId: string, slug: string, planName: 'Standard', trialDays: 7, message: string } }` | `{ success: false, error: string, fieldErrors?: { slug?: string, name?: string, countryCode?: string } }` | **Atomic `create_business` RPC:**<br>1. Provisions `organizations` record (`provisioning_status = 'active'`).<br>2. Binds user as Primary Owner (`is_owner = true`).<br>3. Provisions Headquarters branch (`is_headquarters = true`, `code = 'HQ'`).<br>4. Links owner to HQ in `membership_branches`.<br>5. Assigns Administrator role (`is_system = true`).<br>6. Initializes 7-day trial in `subscriptions`.<br>7. Emits `organization.created` audit log.<br>• Idempotent: duplicate retries return existing workspace cleanly. |

*Note on Category ID:* While `createBusinessSchema` allows an optional `categoryId` for future expansion, the current production registration flow strictly passes `{ name, slug, countryCode }` to `createBusinessAction`. Industry categorization is managed in the Business Settings screen.

---

### C. Workspace Routing & Organization Switcher (`src/proxy.ts`, `src/lib/auth/tenant-guard.ts`, `src/lib/auth/tenant-utils.ts`)

| Operation / Utility | Invocation Context | Return Contract / Behavior | Failure / Guard Handling | Integration Notes for Codex |
| :--- | :--- | :--- | :--- | :--- |
| **`proxy`** (`src/proxy.ts`) | Next.js Edge Middleware for all incoming HTTP requests | Rewrites `[subdomain].[host]/[path]` to internal `/tenant/[subdomain]/[path]`. Rewrites `mybusiness.[host]/` to `/registration`. | Direct external requests to `/tenant/*` return **404 Not Found**. Client headers `x-tenant-slug` are stripped for security. | Frontend MUST NOT link directly to `/tenant/*`. Links inside a workspace must be root-relative (`/` or `/settings`). |
| **`requireTenantAccess`** (`src/lib/auth/tenant-guard.ts`) | Invoked in `TenantLayout` & Tenant Page Server Components | `{ authorized: true, context: { user, organization, membership } }` | • `unauthenticated`: redirects to `/login?next=[safePath]`.<br>• `not_a_member`: returns `{ authorized: false, reason: 'not_a_member' }` (Tenant layout renders `TenantAccessDenied`).<br>• `suspended`: returns `{ authorized: false, reason: 'suspended' }` (Blocked from workspace). | Suspended employees are blocked at database RLS level. |
| **`getUserOrganizations`** (`src/lib/auth/tenant-guard.ts`) | Server function for `/select-organization` & header switcher | `Promise<UserOrganization[]>` (`id, name, slug, provisioning_status, is_owner, status`) | Returns empty array if user has no active memberships. | Excludes suspended memberships and unauthorized tenants via PostgreSQL RLS. |
| **`getTenantWorkspaceUrl`** (`src/lib/auth/tenant-utils.ts`) | Client-safe utility for constructing workspace URLs | Returns `http://[slug].localhost:[port]/` in development or `https://[slug].stack37.com/` in production. | Cleanly isolates port and base domain. | Use this in the Organization Switcher when navigating between different tenant workspaces. |

---

### D. 7-Day Trial & Operational Workspace State (`src/lib/auth/workspace-context.ts`)

| Resolver Function | Data Contract Returned | Customer-Facing States | Integration Notes for Codex |
| :--- | :--- | :--- | :--- |
| **`getWorkspaceOperationalData`** | `Promise<WorkspaceOperationalData>`:<br>• `organization`: `{ id, name, slug, countryCode, provisioningStatus, createdAt }`<br>• `membership`: `{ id, isOwner, status }`<br>• `subscription`: `{ planName, price, status, trialEnd, daysRemaining, isTrialActive }`<br>• `branches`: `WorkspaceBranch[]` (`id, name, isAssigned`)<br>• `assignedBranch`: `WorkspaceBranch` (Assigned branch or earliest branch)<br>• `roles`: `WorkspaceRole[]` (`id, name, isSystem`)<br>• `permissions`: `string[]` (list of permission codes) | • **Trial Active:** `status === 'trialing'` and `daysRemaining > 0`. Top banner displays days remaining.<br>• **Trial Expired:** `status === 'trialing'` and `daysRemaining === 0`.<br>• **Active Paid:** `status === 'active'`.<br>• **Past Due:** `status === 'past_due'`. | Days remaining calculated via `calculateTrialDaysRemaining(trialEnd)`. Deterministic and timezone-safe. |

*Note on Assigned Branch:* If a user has an explicit branch linkage in `membership_branches`, that branch is returned as `assignedBranch`. If no explicit assignment exists, the resolver falls back to the earliest branch in alphabetical order (`branches[0]`).

---

### E. Business Settings & Headquarters Configuration (`src/lib/actions/organization.ts`, `src/lib/auth/business-config.ts`)

| Operation / Action | Schema & Supported Fields | Permission Gate | Action Result Contract | Database Execution & Audit Trail |
| :--- | :--- | :--- | :--- | :--- |
| **`getBusinessConfiguration`** | Resolves `{ organization, headquartersBranch, categories, canEdit }` | Accessible by all active tenant members. `canEdit` is strictly `true` for Primary Owner only (`is_owner = true` and `status = 'active'`). | Returns `null` if organization not found or user is unauthorized. | Robust fallback: resolves HQ branch by `is_headquarters=true` first, then name `'Headquarters'`, then earliest branch ID (survives branch renaming). |
| **`updateBusinessConfigurationAction`** | **Organization Fields:**<br>• `name` (2–100 chars, required)<br>• `legalName` (max 150 chars)<br>• `registrationNumber` (max 50 chars)<br>• `categoryId` (UUID optional)<br>• `currency` (3-letter ISO from `SUPPORTED_CURRENCIES`)<br>• `timezone` (valid timezone name from `COMMON_TIMEZONES`)<br>• `taxId` (TIN / VAT number, max 50 chars)<br>• `taxStatus` (`'standard' \| 'vat_registered' \| 'exempt' \| 'simplified'`)<br>• `contactEmail`, `contactPhone`, `website`<br>• `addressLine1`, `addressLine2`, `city`, `stateProvince`, `postalCode`, `countryCode` | **Primary Owner Only:** Actor must have `is_owner = true` and `status = 'active'`. Non-owners receive `{ success: false, error: "Unauthorized: Only the active primary owner can modify business settings." }`. | `{ success: true, data: { message: "Business configuration successfully saved." } }`<br>OR<br>`{ success: false, error: string, fieldErrors?: Record<string, string> }` | Calls `update_business_configuration` SECURITY DEFINER RPC. Automatically revalidates `/tenant/[slug]/settings` and `/tenant/[slug]`. Logs audit trail. |
| **`updateBranchConfigurationAction`** | **Headquarters Branch Fields:**<br>• `branchId` (UUID, required)<br>• `name` (2–100 chars, required)<br>• `code` (1–20 chars, default `'HQ'`)<br>• `contactEmail`, `contactPhone`<br>• `addressLine1`, `addressLine2`, `city`, `stateProvince`, `postalCode` | **Primary Owner Only:** Actor must have `is_owner = true` and `status = 'active'`. Non-owners receive `{ success: false, error: "Unauthorized: Only the active primary owner can modify branch details." }`. | `{ success: true, data: { message: "Branch information successfully updated." } }`<br>OR<br>`{ success: false, error: string, fieldErrors?: Record<string, string> }` | Calls `update_branch_configuration` SECURITY DEFINER RPC. Revalidates workspace paths. Logs audit trail. |

*Response Contract Note:* Server Actions in Next.js return typed result objects (`OrganizationActionResult`), NOT HTTP 403 status codes. Frontend code must evaluate `result.success` and display `result.error`.

---

## 3. High-Priority Integration Risks & Guardrails for Codex

### Risk 1: VAT & SSCL Independent Registration Controls vs. Existing Tax Schema
* **The Hazard:** The approved UI exploration or mockups may illustrate separate toggle controls for "VAT Registration" and "SSCL Registration".
* **Backend Invariant:** In the database (Migration 11) and validation schema, business tax status is currently captured via a single dropdown field `taxStatus` (`'standard'`, `'vat_registered'`, `'exempt'`, `'simplified'`) and an optional Tax ID `taxId`. Independent dual VAT/SSCL toggles are **NOT YET IMPLEMENTED** (scheduled for a future post-stabilization migration).
* **Mandatory Guardrail:** Codex must NOT submit invented properties (such as `isVatRegistered: boolean` or `ssclRegistrationNumber: string`) to `updateBusinessConfigurationAction`. The settings form MUST bind its tax section to `taxStatus` and `taxId`. Any visual VAT/SSCL toggles in mockups must either map to `taxStatus` or be held in draft until backend schema migration is authorized.

### Risk 2: Subdomain Proxy Routing & Relative Path Traps
* **The Hazard:** If frontend components generate links with `/tenant/[slug]/...`, the Next.js proxy will return **404 Not Found** because `/tenant` is strictly an internal rewrite prefix blocked from direct external requests.
* **Backend Invariant:** When a user is inside `https://acme.stack37.com`, the internal rewrite makes `/settings` map to `/tenant/acme/settings`.
* **Mandatory Guardrail:**
  - Within workspace layouts, use simple root-relative links: `<Link href="/settings">Settings</Link>`, `<Link href="/">Overview</Link>`.
  - In cross-organization switchers (like `/select-organization` or header dropdowns), ALWAYS use `getTenantWorkspaceUrl(org.slug, currentHost)` to generate absolute cross-subdomain URLs (`http://acme.localhost:3000/` or `https://acme.stack37.com/`).

### Risk 3: Non-Owner Permission Handling in Settings
* **The Hazard:** If a regular staff member (non-owner) navigates to Settings and attempts to save, the backend returns `{ success: false, error: "Unauthorized: Only the active primary owner can modify business settings." }`.
* **Backend Invariant:** Enforced at server action level and PostgreSQL RLS.
* **Mandatory Guardrail:** Codex must inspect `initialData.canEdit` passed from the Server Component. When `canEdit === false`:
  - Disable all inputs, selects, and submit buttons.
  - Render an informative read-only advisory banner: *"You are viewing business settings in read-only mode. Only the Primary Owner can make modifications."*

### Risk 4: In-Flight Double Submissions & Loading States
* **The Hazard:** Rapid double-clicking on "Create Workspace" or "Save Changes" can spawn concurrent RPC executions, resulting in duplicate key race conditions or confusing UI flashes.
* **Backend Invariant:** Although `createBusinessAction` features an idempotency guard, frontends must prevent redundant server calls.
* **Mandatory Guardrail:** All buttons and forms must manage an in-flight submission lock (e.g., `isSubmittingRef.current = true`), set `aria-busy="true"`, and show a disabled loading state until the server action returns.

### Risk 5: Scanner-Proof Intermediate Email Confirmation
* **The Hazard:** Automated email crawlers and security scanners inspect email confirmation links. If the confirmation route consumes the token on initial GET load, the token is destroyed before the human user clicks it.
* **Backend Invariant:** The intermediate card at `/auth/confirm` must NEVER call `confirmOtpAction` automatically inside a `useEffect`.
* **Mandatory Guardrail:** The card must display a friendly verification prompt with a clear button (*"Confirm and continue"*). `confirmOtpAction` must execute exclusively upon the deliberate user click event.

### Risk 6: 15-Minute Password Recovery Token Window
* **The Hazard:** Calling `resetPasswordAction` without having completed the OTP confirmation will fail with an unauthorized error.
* **Backend Invariant:** When `confirmOtpAction` processes `type === 'recovery'`, it sets an HTTP-only cookie `sb-recovery-token` that expires in exactly 900 seconds (15 minutes).
* **Mandatory Guardrail:** The frontend must guide the user smoothly through the workflow: Link -> Confirm Card -> Reset Password Form -> Success Notice -> Login. If the token expires, display a clear prompt to request a new reset link.

---

## 4. Known Limitations & Unfinished Capabilities

To prevent confusion, the following capabilities are explicitly classified as **INCOMPLETE / UNBUILT** and must NOT be assumed in application logic:
1. **Independent VAT & SSCL Registration Checkboxes:** Not in database schema; existing control is single `taxStatus` dropdown.
2. **Paid Subscription Checkout:** No live Stripe/Lemon Squeezy integration; trial expires after 7 days without self-serve billing.
3. **Automated Trial Expiration Locking:** Backend checks trial status, but mandatory trial-expiry lockout wall is scheduled for Pre-Launch.
4. **Team Member Invitations & Management:** Blocked until Priorities 1–5 are accepted.
5. **ERP Modules (Sales, Purchasing, Inventory, Finance):** Strictly paused under CEO governance.
