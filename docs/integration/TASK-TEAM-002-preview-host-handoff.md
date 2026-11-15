# TASK-TEAM-002 — Preview host routing handoff

**Status:** CEO-directed exact-host routing correction implemented in TASK-TEAM-002 commit `e4ac490`; Preview build and public route smoke passed. Signed-in auth/roster behavior remains unverified.
**Date:** November 16, 2026 (Asia/Colombo)
**Owner boundary:** Antigravity owns host validation, authentication redirects, and tenant security. Codex owns the Team UI and approved frontend integration after the backend contract is recorded.

## Goal and current evidence

The CEO selected completion of the existing non-production Team Management preview. Migration 13 remains unapplied, invitation acceptance remains disabled, and no live-data-changing test is authorized. The preview branch `codex/task-team-002-preview` at `03f3881` deployed successfully, but a read-only request to its assigned `stack37-tv4j4r6y8-stack37.vercel.app` host returned the application's tenant-host 404. The local Team tab and route are present, and the prior local suite passed 232/232 unit tests, TypeScript, scoped ESLint, and production build. The preview is **not yet a working Team-tab demonstration**.

Deployment Protection has not been verified. A read-only Vercel project inspection returned 403 because the current connector lacks access to the `team_stack37` scope, and the Vercel CLI is unavailable in this checkout. Confirm protection with authorized team access before treating the deployed URL as private.

The current routing and auth assumptions span several files:

| File | Existing behavior that the preview contract must address |
| --- | --- |
| `src/proxy.ts` | Derives the tenant from `*.stack37.com` or `*.localhost`; rejects the assigned `*.vercel.app` host; blocks direct `/tenant/*` paths and removes client-supplied `x-tenant-slug`. |
| `src/lib/auth/host.ts` | Approves callback hosts only for local development and `*.stack37.com`. |
| `src/lib/auth/tenant-utils.ts` | Generates workspace links under `*.stack37.com` for non-local hosts, which would leave the preview. |
| `src/lib/supabase/server.ts` | Keeps auth cookies host-only; this must remain true on any preview host. |

## Backend contract required before implementation

Antigravity should record and approve a preview-only contract covering:

1. **Trusted host source and exact matching:** Which Vercel deployment or assigned preview hostnames are trusted, how their identity is established server-side, and how production and arbitrary `*.vercel.app` hosts remain rejected. Do not trust a client-supplied forwarded host or tenant header.
2. **Tenant identity:** How a preview URL identifies an organization without treating an arbitrary URL path, query value, or header as authorization. The existing authenticated membership guard and RLS boundary must continue to decide access.
3. **Auth lifecycle:** Which preview host may receive login, callback, recovery, and session cookies; how redirects stay on the preview without granting the corporate site auth cookies or redirecting to Production.
4. **Workspace links:** How organization selection, Team navigation, and sign-out stay on the intended preview host while preserving production behavior.
5. **Negative cases:** Unknown preview hosts, reserved subdomains, direct `/tenant/*` access, spoofed `x-tenant-slug`/forwarded host, cross-organization access, and unauthenticated/suspended members must remain denied.

The contract should name the affected files, configuration keys, input and return shapes, validation rules, and error/redirect behavior in `docs/TASKS.md` before dependent implementation. Codex can then implement only the frontend or integration portion explicitly assigned to it. Antigravity must author or review any changes to `src/proxy.ts`, `src/lib/auth/host.ts`, authentication behavior, or tenant security helpers.

## CEO-directed Preview correction — November 16, 2026

The CEO requested a usable Preview from the completed local Team UI work. The new deployment initially returned the app's 404 because this branch's proxy did not recognize Vercel's own Preview host or `/w/{tenantSlug}/...` paths. This correction is restricted to `src/proxy.ts` and `src/lib/auth/host.ts`:

- Trust the request host only when it equals the deployment's normalized `VERCEL_URL` or `VERCEL_BRANCH_URL` exactly and `VERCEL_ENV` equals `preview`.
- On that exact host only, keep shared authentication routes at the root and rewrite `/w/{tenantSlug}/{path}` to the existing `/tenant/{tenantSlug}/{path}` route after validating slug shape and reserved values. Remove any client-supplied tenant header before setting the validated slug; continue rejecting direct `/tenant/*` access.
- Permit auth callback/confirmation requests only on that same exact Preview host, local approved hosts, or existing `stack37.com` hosts. Arbitrary `*.vercel.app` and Production host behavior remain unchanged.
- Forward the validated public pathname to the tenant layout so an unauthenticated employee returns to the requested workspace page after sign-in.
- The tenant guard, RLS, and server-side role checks remain authoritative. The Team UI remains read-only in Preview; this routing patch does not enable writes.

Unit coverage was added in `tests/unit/proxy-routing.test.ts` and `tests/unit/auth-actions.test.ts`; 57/57 focused tests, TypeScript, scoped ESLint, and `git diff --check` passed. The exact route implementation is in `src/proxy.ts`, `src/lib/auth/host.ts`, and `src/app/tenant/[tenantSlug]/layout.tsx`. Preview `dpl_4x9vXdLPDYL2CQmJXCubcq6nf8t3` for commit `e4ac490` is READY; `/login` and `/w/uk-super/settings/team` resolve to sign-in on both deployment and branch URLs. Direct `/tenant/*` remains rejected. No database call, migration, live-data mutation, or Production deployment is part of this correction.

The Team page keeps write actions disabled in Preview because it shares the Production Supabase integration. For full Retail POS and inventory screens, use the separate TASK-UK-SUPER-004 Preview at `https://stack37-74n4a3m4t-stack37.vercel.app`; unauthenticated requests to `/w/uk-super/retail` return sign-in. Signed-in workflow checks remain for CEO review.

## Verification and release boundary

- Run the existing unit, typecheck, scoped lint, and production-build gates after integration.
- Verify a read-only page load for the preview's registration/login and Team route, including the intended tenant-host behavior and negative host cases.
- Confirm the intended Vercel Deployment Protection setting using authorized access to the `team_stack37` project.
- Verify Team layout at 375px and desktop width without using live-data-changing actions.
- Do not claim real invitation acceptance, Migration 13, real database security, or complete employee workflow verification from these preview checks.
- No Production deployment, `main` push, database migration, or invitation-acceptance activation is authorized by TASK-TEAM-002.
