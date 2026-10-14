# STACK37 EOS — TASK-STAB-004 Implementation & Verification Report

**Status:** READY_FOR_REVIEW\
**Date:** October 14, 2026 (Asia/Colombo)\
**Branch / baseline:** `feature/phase1-foundation` at `d17ed63a48e2313df0f5406d9074f9076b788721`\
**Evidence level:** Local source changes, local checks, local browser preview. Uncommitted; not deployed.

## Executive summary

TASK-STAB-004 applies the CEO-approved TASK-STAB-003 design to existing STACK37 EOS workflows. It uses the official STACK37 logo, the existing Geist font setup, white and pale blue-grey surfaces, navy square buttons, restrained blue/violet accents, concise copy, and horizontal workspace navigation without a fixed left sidebar.

The existing authentication, business registration, workspace selection/routing, Headquarters, trial, and Business Settings workflows remain connected to their existing source actions and guards. No backend files, database files, authentication security, RLS, migrations, or live services were changed. No ERP modules or functional independent VAT/SSCL controls were added.

The interface and local regression evidence are ready for CEO review and joint TASK-STAB-005 integration testing.

## Implemented

- **Shared design:** Brand tokens and responsive layout rules; official logo asset; reusable Brand, Button, Input, Alert and Card presentation; square controls; focus and reduced-motion behavior.
- **Authentication:** Login, account registration, verify-email notice, scanner-proof confirmation card, forgot-password, reset-password, and access-denied views. Existing password validation, anti-enumeration responses, callback behavior, explicit confirmation click, and recovery path remain in place.
- **Business registration:** New-workspace form keeps existing name, slug and country inputs, reserved-slug validation, country selection, owner display, submission errors and loading state. Success retains the returned workspace, Primary Owner, plan/trial information, and directory continuation.
- **Organization/workspace selection:** Workspace directory and switcher preserve the existing membership data and `getTenantWorkspaceUrl` cross-subdomain behavior.
- **Workspace shell and overview:** Horizontal Overview/Business Settings navigation; no fixed sidebar. The overview displays organization, role/access, resolver-provided subscription and branch information, and settings entry. Missing subscription data is shown as unavailable instead of an assumed plan/trial.
- **Business Settings:** Business identity, contact/address, regional/tax, and Headquarters sections retain current fields, action payloads, validation/error display, success messaging, owner-only readonly behavior, and HQ IDs. The exact readonly advisory from the canonical handoff is displayed. Tax UI binds only to existing `taxId` and `taxStatus`.
- **Loading and duplicate-submit protection:** Synchronous in-flight refs, disabled/loading buttons, and `aria-busy` semantics cover auth, confirmation, business registration, settings and HQ submissions.
- **Email concepts:** Confirmation and recovery HTML/text drafts in `docs/email-templates/`. They are not activated in the hosted auth provider and use explicit URL/logo placeholders.

## TASK-STAB-005A handoff comparison

Reviewed the user-supplied shared copy, the repository's canonical [backend readiness specification](../../integration/backend_integration_readiness.md), and current source. The detailed comparison is in [BACKEND-HANDOFF-REVIEW.md](BACKEND-HANDOFF-REVIEW.md).

The canonical specification matches the implementation for the scanner-proof flow, the `sb-recovery-token` 15-minute cookie, structured settings action results, owner-only action checks, current tax fields, relative workspace links, and alphabetical branch fallback. The shared copy had earlier errors about HTTP 403 and recovery-cookie naming.

Source-level qualifications:

- `createBusinessSchema` accepts optional `categoryId`, but the action and current UI do not pass/use it; canonical handoff notes this.
- `createBusinessAction` prefers Standard but can fall back to the lowest-priced public plan; therefore returned plan is not always Standard.
- `getBusinessConfiguration` defaults `canEdit` to true if called without its optional membership ID. Current route passes the guard-verified ID and both update actions independently verify an active Primary Owner.
- The canonical spec says the settings resolver returns `null` for unauthorized users; source returns readonly configuration for non-owners, relying on the tenant guard for access and save actions for write authorization. The overview no longer displays raw permission IDs as if they were human-readable permission codes.
- `getWorkspaceOperationalData` selects an assigned branch, otherwise the first alphabetically ordered branch. Current UI displays resolver output.
- Live Supabase migration/RLS state and Antigravity's remote readiness assertions were not independently checked during this frontend task.

## Verification

### Automated

- `npx vitest run tests/unit --exclude '**/.worktrees/**'`: **12 files, 170 tests passed**.
- `npm run typecheck`: passed.
- `npx eslint src tests/unit/frontend-presentation.test.tsx`: passed with no warnings.
- `npm run build`: passed; optimized production build compiled, type-checked, and generated 12 static pages.
- `git diff --check`: passed after removing Markdown trailing spaces.
- Confirmed no diff in backend action/auth/validation, proxy, migration, database, DB-test or integration-test paths.

### Browser and interaction review

Used the existing application for auth/read-only screens and `tests/ui/serve.mjs` for local fixture screens. The fixture renders actual frontend components with mocked data/actions and does not connect to live auth or Supabase.

- Checked 11 existing screen states and both email drafts at 375px and 1440px. Layout evidence JSON is in this directory.
- Reviewed login, signup validation, forgot/reset forms, email confirmation click-only behavior, business-registration slug validation/success/slow state, workspace directory/switcher, horizontal navigation, Settings tabs and responsive forms.
- With mocked actions, verified settings/business and HQ payloads, success/error/field-error states, owner readonly behavior and save locking.
- No real signup, login, confirmation token, password update, organization creation, workspace switch, settings save, email dispatch, or database mutation was performed.

## Final quality gate update

The original default unit-test command also discovered the separate `.worktrees/backend-safeguards/` Git worktree. It duplicated project test files and brought in tests outside this checkout's `tests/unit/` boundary. The root `test:unit` script now excludes `**/.worktrees/**` while continuing to scan all project unit tests.

The five historically reported failures were three `resetPasswordAction` cases (missing, expired, and another user's recovery cookie) that threw while calling `.get` on the result of `cookies()`, and two `confirmOtpAction` cases (unapproved host and blank token hash) that threw while calling `.get` on the result of `headers()`. The reported stack location was before each case's expected security assertion. This is consistent with absent request-store mocks in that historical run, not a demonstrated authorization bypass. The current worktree test source supplies both mocks, and all five cases pass when rerun. I could not reproduce the historical failure or establish exactly why those mocks were absent in that run; therefore the individual historical mock failure is **not conclusively attributable** beyond the test-harness/request-store boundary. No application security defect was confirmed, and neither Antigravity's test nor its assertions were changed.

The root checkout's own suite contains 12 unit-test files (170 tests); the default test command is now restricted to those project tests. Antigravity's isolated worktree remains untouched.

### Authorization and subscription review

- The optional `userMembershipId` parameter still makes `getBusinessConfiguration` default `canEdit` to `true` when omitted. The actual tenant Settings route supplies the guard-verified `membership.id`. Both business and Headquarters update actions separately require an authenticated user and active Primary Owner membership before writing. This is a call-site caveat, not an authorization path reachable through the current Settings route. Keep the ID supplied in any future call site; the backend owner owns any API hardening.
- Business registration prefers the public Standard plan and falls back to the lowest-priced public plan only if Standard is absent. It still requires a public plan and invokes the existing `create_business` RPC, which owns organization/owner/HQ/trial creation. This affects the returned plan label/tier if the catalog is misconfigured; the UI does not use that fallback to grant access. Workspace display is sourced from the organization's subscription row and shows unavailable when no subscription exists. Trial status is derived from stored subscription status and `trial_end`. Subscription authorization and trial-expiry enforcement remain backend responsibilities; this UI does not assert an entitlement based on the fallback.

No auth, registration, workspace switching, settings action, validation, schema, migration, tenant guard, proxy, or backend source contract was changed for this final gate. The only runtime configuration change is the unit-test discovery exclusion.

The default `npm run lint` exits successfully but reports one unused-variable warning from that same nested checkout. Scoped ESLint on `src` and the new presentation test passes cleanly.

## Screenshots

Auth screenshots are from the existing local application. Workspace/settings/registration screenshots are from the clearly labelled mock-action review fixture.

- Login: [desktop](login-desktop.png) · [mobile](login-mobile.png)
- Workspace overview: [desktop](overview-desktop.png) · [mobile](overview-mobile.jpg)
- Business Settings: [desktop](settings-desktop.png) · [mobile](settings-mobile.png)
- Business registration: [desktop](registration-desktop.png) · [mobile](registration-mobile.jpg)
- Email drafts: [confirmation](email-confirmation-desktop.jpg) · [recovery](email-recovery-desktop.jpg)

## Changed files

**Application presentation**
- `src/app/globals.css`, `src/app/layout.tsx`
- `src/app/registration/page.tsx`, `src/app/select-organization/page.tsx`
- `src/app/tenant/[tenantSlug]/layout.tsx`, `src/app/tenant/[tenantSlug]/page.tsx`, `src/app/tenant/[tenantSlug]/settings/page.tsx`
- `src/components/auth/auth-shell.tsx`, `confirm-card.tsx`, `forgot-password-form.tsx`, `login-form.tsx`, `reset-password-form.tsx`, `signup-form.tsx`, `verify-email-card.tsx`
- `src/components/organization/registration-form.tsx`, new `registration-shell.tsx`
- `src/components/tenant/access-denied.tsx`, `business-configuration-form.tsx`, `organization-switcher.tsx`, new `workspace-directory.tsx`, `workspace-frame.tsx`, `workspace-navigation.tsx`, `workspace-overview.tsx`
- `src/components/ui/alert.tsx`, `button.tsx`, `card.tsx`, `input.tsx`, new `brand.tsx`
- new `public/stack37-logo.webp`

**Design/evidence**
- new approved-reference archive `docs/references/TASK-STAB-003-approved-design.html`
- new drafts `docs/email-templates/{confirmation,recovery}.{html,txt}` and README
- new `tests/ui/review-fixture.tsx`, `tests/ui/serve.mjs`, `tests/unit/frontend-presentation.test.tsx`
- updated `PROJECT_STATE.md`, `docs/TASKS.md`, `docs/ROADMAP.md`, `docs/DESIGN_STANDARDS.md`, `docs/DECISIONS.md`
- new review evidence and `BACKEND-HANDOFF-REVIEW.md` in this directory

The newly available `docs/integration/backend_integration_readiness.md` and the separate `.worktrees/` checkout were not created or modified by this task.

## Remaining for review and joint integration

- CEO visual review/acceptance of TASK-STAB-004.
- Antigravity confirmation or correction of the plan fallback and optional resolver membership-ID caveat.
- Joint TASK-STAB-005 real backend walkthrough of auth, registration/HQ/trial, workspace switching, readonly permissions, settings persistence, and email delivery.
- Separate hosted email-template configuration and real mail-client verification.
- No task acceptance, commit, push, merge, or deployment has been performed.
