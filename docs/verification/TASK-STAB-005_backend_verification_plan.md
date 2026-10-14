# STACK37 EOS — TASK-STAB-005: Backend Security Verification Plan

**Document Version:** 1.0\
**Authority:** Chief Executive Officer, STACK37 (Pvt) Ltd\
**Author:** Google Antigravity (Backend Engineering & Security Verification Owner)\
**Status:** PROPOSED VERIFICATION PLAN (Awaiting CEO Review & Authorization)\
**Target Phase:** Priority 5 — `TASK-STAB-005` Integrated Verification\

---

## 1. Executive Summary & Objective

With the completion and CEO acceptance of `TASK-STAB-004` (Frontend UI Alignment) and `TASK-STAB-005B` (Backend Integration Safeguards & Memory Update), the project enters **Priority 5: Integrated Verification (`TASK-STAB-005`)**.

The objective of this plan is to design a rigorous, end-to-end backend security verification regime that bridges the gap between local unit mocks and the live Supabase infrastructure. While the 19 accepted unit tests verify application logic, Zod validation schemas, and edge proxy routing in isolation, only live execution against PostgreSQL can definitively prove that:
1. Row Level Security (RLS) policies cannot be bypassed.
2. Cross-tenant data leaks are physically impossible at the database engine level.
3. Multi-table provisioning operations roll back atomically upon failure.
4. GoTrue authentication sessions and cookies function securely across multi-tenant subdomains.

---

## 2. Review of the 19 Accepted Security Tests (Unit vs. Database Boundary)

The 19 security tests established in `tests/unit/backend-security-safeguards.test.ts` verify the application runtime layer. Below is the mapping of what each test proves and what remains to be validated against the live database:

| Scenario / Test ID | What the Unit Test Proves | Live Database Gap to Verify in STAB-005 |
| :--- | :--- | :--- |
| **Scenario 1: Cross-Org Isolation**<br>• `updateBusinessConfig` on foreign org<br>• `updateBranchConfig` on foreign org<br>• `getBusinessConfig` on foreign org | Application Server Action verifies membership in `organization_members` before invoking database RPCs; returns `{ success: false, error: 'Unauthorized...' }`. | Prove that even if an attacker executes raw SQL or calls `supabase.rpc('update_business_configuration')` directly, PostgreSQL RLS and the RPC's internal `auth.uid()` check raise an exception. |
| **Scenario 2: Non-Owner Restrictions**<br>• Admin blocked from business settings<br>• Staff blocked from branch config | Application Server Action strictly enforces `is_owner === true` and blocks non-owner members. | Prove that direct SQL updates to `organizations` and `branches` are completely revoked (`REVOKE UPDATE FROM authenticated`) and that RPC checks enforce sole ownership in the database engine. |
| **Scenario 3: Suspended User Lockout**<br>• Suspended user blocked from action<br>• Suspended user receives 403 reason | `verifyTenantAccess` inspects `status === 'active'` and sets `reason: 'suspended'`. Server actions filter by `status = 'active'`. | Prove that `private.get_user_orgs()` excludes suspended members from all `SELECT` queries across `organizations`, `branches`, `organization_members`, and `audit_logs`. |
| **Scenario 4: Auth & Recovery Tampering**<br>• Missing recovery cookie<br>• Expired recovery token<br>• User ID mismatch<br>• Invalid host origin<br>• Empty token hash | Cryptographic HMAC-SHA256 token verification works in Node.js runtime; tokens expire after 900s; user ID is cryptographically bound; origin checking stops phishing. | Prove that GoTrue password updates via `supabase.auth.updateUser` reject stale sessions and that recovery tokens cannot be replayed once consumed. |
| **Scenario 5: URL Routing & Subdomains**<br>• Internal `/tenant/*` returns 404<br>• Reserved subdomains return 404<br>• Client `x-tenant-slug` header stripped<br>• Whitespace slug returns not_a_member | Edge proxy cleanly rewrites requests, enforces 404 on reserved subdomains (`admin`, `api`, `auth`, `app`, `www`), and prevents header injection. | Prove that the Next.js middleware and proxy handle real browser requests with live cookies and rewrite properly to tenant routes. |
| **Scenario 6: Schema Invariants**<br>• Invalid currency (`BITCOIN`)<br>• Invalid country (`USA`)<br>• Whitespace branch name (`  `) | Zod schemas reject malformed payloads before database calls; returns structured `fieldErrors`. | Prove that PostgreSQL check constraints, currency allowlists, and IANA timezone validation against `pg_timezone_names` reject malformed direct inputs with error `23514`. |

---

## 3. Real Supabase Row Level Security (RLS) Verification

In production, client requests connect using the Supabase `authenticated` role with a JWT containing the user's UUID (`auth.uid()`). STACK37 EOS relies on database-level RLS policies to guarantee multi-tenancy.

### RLS Verification Requirements:
1. **Unbypassable Tenant Read Policies:**
   - Execute direct table selects using an authenticated client for `User Alpha`:
     ```sql
     -- Must return ONLY rows where organization_id belongs to User Alpha:
     SELECT * FROM public.organizations;
     SELECT * FROM public.organization_members;
     SELECT * FROM public.branches;
     SELECT * FROM public.subscriptions;
     SELECT * FROM public.domains;
     ```
   - **Assertion:** Zero rows belonging to `Tenant Beta` are returned, even if queried by primary key:
     ```ts
     const { data } = await clientAlpha.from('organizations').select('*').eq('id', tenantBetaOrgId);
     expect(data).toHaveLength(0);
     ```

2. **Revocation of Direct Table Writes (Audit Bypass Prevention):**
   - Migration 11 explicitly executed:
     ```sql
     REVOKE INSERT, UPDATE, DELETE ON public.organizations FROM public, anon, authenticated;
     REVOKE INSERT, UPDATE, DELETE ON public.branches FROM public, anon, authenticated;
     ```
   - **Assertion:** Direct client updates must fail with PostgreSQL permission denied:
     ```ts
     const { error } = await clientAlpha.from('organizations').update({ name: 'Hacked' }).eq('id', tenantAlphaOrgId);
     expect(error).not.toBeNull();
     expect(error.code).toBe('42501'); // insufficient_privilege
     ```

3. **Audit Log Access Restriction:**
   - Policy: `"Tenant Read Audit" ON public.audit_logs FOR SELECT USING (private.has_permission(organization_id, 'audit:read'))`.
   - **Assertion:** A standard member lacking `audit:read` receives 0 rows when querying `audit_logs`. An owner receives their organization's audit entries, but zero entries from other organizations.

---

## 4. Cross-Tenant Authorization Test Matrix

To test cross-tenant isolation, the test suite must provision two completely separate synthetic organizations and four distinct authenticated user personas:

### Synthetic Test Fixtures:
```
┌────────────────────────────────────────────────────────┐  ┌────────────────────────────────────────────────────────┐
│               TENANT ALPHA (test-alpha)                │  │                TENANT BETA (test-beta)                 │
│ Org ID: org-alpha-uuid                                 │  │ Org ID: org-beta-uuid                                  │
├────────────────────────────────────────────────────────┤  ├────────────────────────────────────────────────────────┤
│ • User A1 (Primary Owner):                             │  │ • User B1 (Primary Owner):                             │
│   owner-alpha@stack37-test.internal                    │  │   owner-beta@stack37-test.internal                     │
│ • User A2 (Team Member / Non-Owner):                   │  │                                                        │
│   staff-alpha@stack37-test.internal                    │  │                                                        │
│ • User A3 (Suspended Member):                          │  │                                                        │
│   suspended-alpha@stack37-test.internal                │  │                                                        │
└────────────────────────────────────────────────────────┘  └────────────────────────────────────────────────────────┘
```

### Execution Matrix:

| Test ID | Acting Persona | Target Resource / Action | Expected Result | Verification Check |
| :--- | :--- | :--- | :--- | :--- |
| **XT-01** | User A1 (Alpha Owner) | Read Tenant Beta via `.select()` | **0 rows returned** | RLS blocks cross-tenant discovery |
| **XT-02** | User A1 (Alpha Owner) | Read Tenant Beta branches | **0 rows returned** | RLS blocks cross-tenant branch access |
| **XT-03** | User A1 (Alpha Owner) | Invoke `update_business_configuration` targeting Tenant Beta ID | **PostgreSQL Exception Raised** | RPC `is_authorized` check raises `'Unauthorized...'` |
| **XT-04** | User A1 (Alpha Owner) | Invoke `update_branch_configuration` targeting Tenant Beta HQ branch | **PostgreSQL Exception Raised** | RPC blocks branch modification outside actor's organization |
| **XT-05** | User A2 (Alpha Staff) | Invoke `update_business_configuration` targeting Tenant Alpha ID | **PostgreSQL Exception Raised** | RPC enforces `is_owner = true`; non-owner staff rejected |
| **XT-06** | User A3 (Alpha Suspended) | Access `http://test-alpha.localhost:3000/` | **Access Denied (`reason: 'suspended'`)** | `verifyTenantAccess` redirects to suspended lockout card |
| **XT-07** | User A3 (Alpha Suspended) | Query `organizations` table directly | **0 rows returned** | `private.get_user_orgs()` filters `status = 'active'` |
| **XT-08** | User B1 (Beta Owner) | Read Tenant Alpha Audit Logs | **0 rows returned** | Audit log isolation confirmed |

---

## 5. Transaction Rollback & Constraint Integrity Verification

STACK37 EOS uses PostgreSQL transactions inside SECURITY DEFINER RPCs (`create_business`, `update_business_configuration`, `update_branch_configuration`). If an error occurs midway through a function, PostgreSQL rolls back all preceding changes within that call.

### Tests to Execute:

1. **Atomic Rollback on Duplicate Slug Collision:**
   - **Action:** Attempt to call `create_business` with slug `test-alpha` (which already exists).
   - **PostgreSQL Behavior:** Raises unique constraint violation `23505` (`organizations_slug_key`).
   - **Verification:**
     - Confirm Server Action maps `23505` to `{ success: false, fieldErrors: { slug: 'This workspace URL is already taken...' } }`.
     - Confirm NO new rows were committed to `organizations`, `organization_members`, `branches`, `subscriptions`, or `audit_logs`.

2. **Atomic Rollback on Invalid Slug Format:**
   - **Action:** Call `create_business` with illegal slug characters (e.g., `invalid_slug!`).
   - **PostgreSQL Behavior:** Check constraint `23514` (`organizations_slug_format`) raises exception.
   - **Verification:** Entire transaction rolls back; zero orphaned rows created.

3. **Atomic Rollback on Missing or Private Subscription Plan:**
   - **Action:** Pass an unseeded or private plan UUID to `create_business`.
   - **PostgreSQL Behavior:** Raises exception `'Invalid or private subscription plan selected.'`.
   - **Verification:** Organization record is never created; rollback is 100% complete.

4. **Headquarters Branch Uniqueness Constraint:**
   - **Invariant:** Migration 11 created index `idx_branches_org_headquarters` (`UNIQUE (organization_id) WHERE is_headquarters = true`).
   - **Action:** Attempt to insert a second branch with `is_headquarters = true` for the same organization via direct SQL.
   - **Verification:** Database rejects insert with unique constraint violation `23505`.

5. **Database-Side Currency & IANA Timezone Validation:**
   - **Action:** Call `update_business_configuration` directly via RPC with:
     - `p_currency = 'XXX'` (not in currency allowlist).
     - `p_timezone = 'Fake/Timezone'` (not in `pg_timezone_names`).
   - **Verification:** Database engine raises exception before mutating `organizations`.

---

## 6. Authentication Session & Subdomain Cookie Architecture

### Current Architectural Finding:
In `src/lib/supabase/proxy.ts` and `src/lib/supabase/server.ts`, the cookie options are configured as:
```ts
cookieOptions: {
  path: '/',
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  domain: undefined, // Enforce host-only
}
```
**Consequence:** When `domain` is undefined, browsers treat cookies as **host-only**. A cookie set at `mybusiness.localhost:3000` is **NOT** sent by the browser when making requests to `tenant-alpha.localhost:3000`.

### Subdomain Verification Plan:
1. **Intra-Subdomain Authentication (Standard):**
   - User signs in at `http://tenant-alpha.localhost:3000/login`.
   - Host-only cookie is set for `tenant-alpha.localhost:3000`.
   - User navigates to `http://tenant-alpha.localhost:3000/settings`.
   - **Expected Result:** Session is maintained; user context resolves successfully.

2. **Cross-Subdomain Navigation & Registration Transition:**
   - User completes registration at `http://mybusiness.localhost:3000/registration`.
   - Registration completes; application attempts to redirect to `http://tenant-alpha.localhost:3000/`.
   - **Verification Test:** Evaluate whether the session persists across subdomains.
   - **Architectural Requirement:** If seamless cross-subdomain access is required between registration, organization selection (`/select-organization`), and tenant workspaces, cookie domain must be scoped to `.localhost` (in development) and `.stack37.com` (in production), while excluding untrusted subdomains.

3. **Recovery Token Lifecycle & Expiration:**
   - Verify `sb-recovery-token` is scoped as `HttpOnly`, `SameSite: Lax`, and has an exact 900-second (15-minute) TTL.
   - Verify that after `resetPasswordAction` completes, the recovery token is invalidated and cannot be reused.

---

## 7. Business Settings Membership-ID Review & Fail-Closed Correction

### Vulnerability Analysis:
In `src/lib/auth/business-config.ts` (lines 186–195):
```ts
// CURRENT IMPLEMENTATION (FAIL-OPEN DEFECT):
let canEdit = true;
if (userMembershipId) {
  const { data: member } = await supabase
    .from('organization_members')
    .select('is_owner, status')
    .eq('id', userMembershipId)
    .maybeSingle();
  canEdit = Boolean(member?.is_owner === true && member?.status === 'active');
}
```

### Defects Identified:
1. **Fail-Open Default:** If `userMembershipId` is omitted, `canEdit` evaluates to `true`.
2. **Missing Organization Binding:** The query filters only on `id = userMembershipId`. If an actor supplies a valid membership ID from Organization B where they are an owner, and requests Organization A, the check could inadvertently grant `canEdit = true`.

### Proposed Fail-Closed Correction (Documented for CEO Review):
```ts
// PROPOSED FAIL-CLOSED SPECIFICATION:
// 1. canEdit must default to false.
// 2. userMembershipId is strictly required for edit permissions.
// 3. Query MUST bind both organization_id and id to enforce tenant boundary.
let canEdit = false;
if (userMembershipId) {
  const { data: member } = await supabase
    .from('organization_members')
    .select('is_owner, status')
    .eq('organization_id', organizationId) // Explicit tenant boundary
    .eq('id', userMembershipId)
    .maybeSingle();
  canEdit = Boolean(member?.is_owner === true && member?.status === 'active');
}
```
*Note: In accordance with restrictions, this correction will NOT be implemented without explicit CEO authorization.*

---

## 8. Registration Plan Fallback Review against Commercial Requirements

### Analysis of Current Implementation:
In `src/lib/actions/organization.ts` (lines 117–147):
```ts
// 1. First attempt: resolve 'Standard'
const { data: standardPlan } = await supabase
  .from('plans')
  .select('id, name')
  .eq('name', 'Standard')
  .eq('is_public', true)
  .maybeSingle();

let targetPlan = standardPlan;

// 2. Fallback: resolve lowest-priced public plan
if (!targetPlan && !standardPlanError) {
  const { data: fallbackPlan } = await supabase
    .from('plans')
    .select('id, name')
    .eq('is_public', true)
    .order('price', { ascending: true })
    .limit(1)
    .maybeSingle();
  targetPlan = fallbackPlan;
}
```

### Commercial Conflict & Policy Risk:
1. **Commercial Policy (DEC-006 & OQ-004):** Every registered organization receives a 7-day free trial on the default tier. Subscription pricing amounts and tier definitions remain under CEO review (`OQ-004`).
2. **Catalog Misconfiguration Risk:** If `Standard` is renamed (e.g. to `Growth` or `Professional`), sorting by `price ASC` will bind the new business to the lowest-priced tier (which might be a restricted starter tier or a $0 legacy plan), rather than the intended full-featured trial tier.
3. **Recommended Hardening:**
   - Introduce an explicit boolean `is_default_trial_tier` in `public.plans` (or an application constant).
   - If the designated trial plan cannot be resolved, registration should **fail closed** with an administrator configuration error, rather than guessing a tier based on price.

---

## 9. Test Environments, Credentials & Infrastructure Prerequisites

To execute `TASK-STAB-005` without jeopardizing existing records:

### Infrastructure Options:
* **Option A (Local Supabase CLI — Recommended for Initial Phase):**
  - Run local Supabase Docker stack via `npx supabase start`.
  - Executes Migrations 01–12 locally in a fully isolated container.
  - Generates zero network traffic to remote Supabase; 100% data isolation.
* **Option B (Remote Non-Production Supabase Instance):**
  - Use remote staging project with identical migrations applied.
  - Requires:
    - `NEXT_PUBLIC_SUPABASE_URL`: Target project URL.
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public anonymous key.
    - `SUPABASE_SERVICE_ROLE_KEY`: Used **strictly** by the test harness for creating and tearing down synthetic users.

### Environment Credentials Safeguard:
* The test execution script must verify that `NEXT_PUBLIC_SUPABASE_URL` is **NOT** a live production URL before executing write/delete fixtures.

---

## 10. Customer Data Protection & Safety Guards

To guarantee absolute protection of real or existing database records:

1. **Deterministic Synthetic Namespaces:**
   - All test organizations must use the prefix: `test-e2e-[timestamp]-[slug]`.
   - All test users must use synthetic internal email addresses: `[user]@stack37-test.internal`.
2. **Safe Automated Teardown:**
   - Teardown scripts must explicitly target only records matching the synthetic prefix:
     ```sql
     DELETE FROM public.organizations WHERE slug LIKE 'test-e2e-%';
     ```
   - Broad `DELETE`, `TRUNCATE`, or `DROP` commands are strictly forbidden under the `accidental-data-loss-prevention` rule.
3. **No Code Commits or Pushes:**
   - All verification scripts must run locally; no Git commits, merges, or pushes will occur until the CEO reviews and signs off on the final report.

---

## 11. Execution Sequence & Phased Timeline

```
┌────────────────────────────────────────────────────────────────────────┐
│             TASK-STAB-005 INTEGRATION VERIFICATION PHASES              │
├────────────────────────────────────────────────────────────────────────┤
│ Phase 1: Environment Readiness & Pre-Flight Checks                     │
│   • Verify test credentials and synthetic isolation guards.            │
│   • Confirm local Docker or staging database has Migrations 01–12.     │
├────────────────────────────────────────────────────────────────────────┤
│ Phase 2: Live Database RLS & Security Verification                     │
│   • Execute cross-tenant read isolation tests (XT-01 through XT-04).   │
│   • Execute non-owner and suspended member restrictions (XT-05–XT-08). │
│   • Verify revoked direct writes on organizations and branches.        │
├────────────────────────────────────────────────────────────────────────┤
│ Phase 3: Transaction Rollback & Constraint Integrity                   │
│   • Test atomic rollback on duplicate slug (23505).                    │
│   • Test atomic rollback on illegal slug regex (23514).                │
│   • Test Headquarters single-branch uniqueness index.                  │
│   • Test currency allowlist and IANA timezone enforcement.             │
├────────────────────────────────────────────────────────────────────────┤
│ Phase 4: Authentication Session & Subdomain Cookie Audit               │
│   • Test login session persistence within tenant subdomain.           │
│   • Audit cross-subdomain registration-to-tenant transition.           │
│   • Verify 15-minute recovery token expiry and replay prevention.      │
├────────────────────────────────────────────────────────────────────────┤
│ Phase 5: Joint End-to-End Regression with Redesigned UI                │
│   • Coordinate with Codex's accepted UI screens.                       │
│   • Run full registration, login, and business settings browser flows. │
├────────────────────────────────────────────────────────────────────────┤
│ Phase 6: Final Verification Report & CEO Handoff                       │
│   • Document all test outputs, pass counts, and evidence.              │
│   • Present findings to CEO and ChatGPT (Product Coordination).        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 12. Risks and Rollback Procedures

| Identified Risk | Severity | Mitigation Strategy | Rollback Procedure |
| :--- | :--- | :--- | :--- |
| **Accidental Production Mutation** | Critical | Strict test harness guard: aborts immediately if database URL matches production; synthetic `test-e2e-` prefix enforcement. | Automated teardown script deletes only synthetic records; remote backups intact. |
| **Subdomain Cookie Dropping** | High | Test both host-only and parent-domain cookie options in local browser tests before changing production settings. | Preserve current `domain: undefined` behavior; document SSO/re-auth requirement. |
| **RPC Exception Masking** | Medium | Assert specific PostgreSQL error codes (`23505`, `23514`, `P0001`) rather than generic string matching. | Refine Server Action error mappers to preserve underlying database exception details. |
| **Stale Test Fixtures** | Low | Implement robust `beforeAll` cleanup and `afterAll` teardown hooks in the test runner. | Execute targeted manual deletion of `slug LIKE 'test-e2e-%'`. |
