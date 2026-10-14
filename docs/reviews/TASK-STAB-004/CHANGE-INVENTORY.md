# TASK-STAB-004 — Change Inventory for Controlled Integration

**Status:** CEO accepted October 14, 2026; inventory prepared for TASK-STAB-005.\
**Integration:** Not started. TASK-STAB-005 requires separate CEO authorization.

## Frontend application

### Shared foundation and page styling

- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/components/ui/alert.tsx`
- `src/components/ui/brand.tsx` (new)
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/input.tsx`
- `public/stack37-logo.webp` (new official brand asset)

### Authentication and account screens

- `src/components/auth/auth-shell.tsx`
- `src/components/auth/confirm-card.tsx`
- `src/components/auth/forgot-password-form.tsx`
- `src/components/auth/login-form.tsx`
- `src/components/auth/reset-password-form.tsx`
- `src/components/auth/signup-form.tsx`
- `src/components/auth/verify-email-card.tsx`

### Business registration and workspace

- `src/app/registration/page.tsx`
- `src/app/select-organization/page.tsx`
- `src/app/tenant/[tenantSlug]/layout.tsx`
- `src/app/tenant/[tenantSlug]/page.tsx`
- `src/app/tenant/[tenantSlug]/settings/page.tsx`
- `src/components/organization/registration-form.tsx`
- `src/components/organization/registration-shell.tsx` (new)
- `src/components/tenant/access-denied.tsx`
- `src/components/tenant/business-configuration-form.tsx`
- `src/components/tenant/organization-switcher.tsx`
- `src/components/tenant/workspace-directory.tsx` (new)
- `src/components/tenant/workspace-frame.tsx` (new)
- `src/components/tenant/workspace-navigation.tsx` (new)
- `src/components/tenant/workspace-overview.tsx` (new)

## Test and operational configuration

- `package.json` — unit-test script excludes nested `.worktrees` from the project test discovery boundary.
- `tests/unit/frontend-presentation.test.tsx` (new presentation regression coverage)
- `tests/ui/review-fixture.tsx` (new local mocked-action review fixture)
- `tests/ui/serve.mjs` (new local fixture server)

## Design, governance, handoff, and verification evidence

- `PROJECT_STATE.md`
- `docs/TASKS.md`
- `docs/DESIGN_STANDARDS.md`
- `docs/ROADMAP.md`
- `docs/DECISIONS.md`
- `docs/references/TASK-STAB-003-approved-design.html` (archived approved exploration)
- `docs/email-templates/README.md`
- `docs/email-templates/confirmation.html`
- `docs/email-templates/confirmation.txt`
- `docs/email-templates/recovery.html`
- `docs/email-templates/recovery.txt`
- `docs/reviews/TASK-STAB-004/REPORT.md`
- `docs/reviews/TASK-STAB-004/BACKEND-HANDOFF-REVIEW.md`
- `docs/reviews/TASK-STAB-004/FINAL-QUALITY-GATE.md`
- `docs/reviews/TASK-STAB-004/CHANGE-INVENTORY.md` (this inventory)
- `docs/reviews/TASK-STAB-004/desktop-layout-evidence.json`
- `docs/reviews/TASK-STAB-004/mobile-layout-evidence.json`
- `docs/reviews/TASK-STAB-004/email-layout-evidence.json`
- `docs/reviews/TASK-STAB-004/login-desktop.jpg`
- `docs/reviews/TASK-STAB-004/login-desktop.png`
- `docs/reviews/TASK-STAB-004/login-mobile.jpg`
- `docs/reviews/TASK-STAB-004/login-mobile.png`
- `docs/reviews/TASK-STAB-004/overview-desktop.jpg`
- `docs/reviews/TASK-STAB-004/overview-desktop.png`
- `docs/reviews/TASK-STAB-004/overview-mobile.jpg`
- `docs/reviews/TASK-STAB-004/registration-desktop.jpg`
- `docs/reviews/TASK-STAB-004/registration-mobile.jpg`
- `docs/reviews/TASK-STAB-004/settings-desktop.jpg`
- `docs/reviews/TASK-STAB-004/settings-desktop.png`
- `docs/reviews/TASK-STAB-004/settings-mobile.jpg`
- `docs/reviews/TASK-STAB-004/settings-mobile.png`
- `docs/reviews/TASK-STAB-004/email-confirmation-desktop.jpg`
- `docs/reviews/TASK-STAB-004/email-recovery-desktop.jpg`

## Explicitly outside this inventory

- Existing login, account registration, password reset, email confirmation and verification route handlers remain in place; their presentation is provided by the listed updated components. Existing auth actions and server-action contracts were preserved.
- `src/lib/actions/`, `src/lib/auth/`, `src/lib/validations/`, `src/proxy.ts`, database schemas and migrations, and live services were not modified by TASK-STAB-004.
- `docs/integration/backend_integration_readiness.md` is the preserved Antigravity handoff input; it was reviewed, not changed for this acceptance update.
- `.worktrees/backend-safeguards/` is Antigravity's isolated worktree and was not modified. Its uncommitted files are not part of this inventory.
- No commit, push, merge, deployment, or integration activity is included.

## Deferred hardening to track separately

1. `getBusinessConfiguration` has an optional membership ID and defaults `canEdit` to true when omitted. The current Settings route supplies the verified membership ID, and write actions independently enforce active Primary Owner access. Harden the resolver contract/default in a separately authorized backend task.
2. Business registration falls back to the lowest-priced public plan if the public Standard plan is missing. Review against approved commercial plan policy before launch. Do not conflate plan selection with entitlement authorization.
