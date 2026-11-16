# TASK-UK-SUPER-004 — Implementation and live release plan

**Prepared:** 15 November 2026 (Asia/Colombo)

**Owner:** ChatGPT Codex (CEO reassigned implementation in this conversation)

**Candidate:** `codex/task-uk-super-004-ops`

**Current status:** Migrations 15 and 16 are live. Commits `50f0025c4fa2a25018e365ae8e5ff7b0fb33d813` and author-corrected follow-up `7e41f02cc3ea590f8e202b240ab478c5acb8ff7b` are pushed to the task branch. Preview deployment `dpl_145YHTSkUXz6b2qpDYwL2d2jBcmM` for `7e41f02` is READY. Production site remains unchanged.

**Production authorization:** CEO approved deploying the UK Super candidate to Production on 16 November 2026. This authorizes the release action, subject to the mandatory go/no-go checks below; it does not satisfy checks that remain unverified.

## What is in the candidate

The candidate connects the UK Super retail page to branch scoped product and stock reads, current dashboard totals, atomic sale recording and stock adjustment actions. It adds employee role/branch assignment, based on the existing staff invitation and access workflow. The point of sale accepts cash or a card payment marked as processed elsewhere. It does not handle card authorization, tax calculation, till reconciliation or legally approved receipts.

Current UK Super product drafts are still staged and there is no trusted opening stock. Imported products begin at zero on hand. A responsible pilot must count and enter stock before checkout can sell products.

## Release sequence and estimates

The 2–4 hour estimate is conditional on a successful build, protected Preview, approved test account and production rollback path. The CEO selected the live EOS database instead of the quoted paid isolated branch. Each stage remains a gate; elapsed time does not override a failed check.

| Elapsed time | Task | Evidence required | Owner |
|---|---|---|---|
| 0:00–0:20 | Resolve the local production-build blocker; review exact file and migration diff. | Production build succeeds; branch and task scope reviewed. | Codex |
| 0:20–1:00 | Apply and verify Migration 15, then Migration 16 on the CEO-selected EOS Supabase project. | Both versions recorded; required columns, RPCs, RLS enablement and direct-write grants checked read-only. No operational sales, stock or invitation fixtures written. | Codex — VERIFIED |
| 1:00–1:40 | Create a protected Vercel Preview from this candidate; check auth entry routes and use only read-only actions against live UK Super data. | Preview build is READY and `/login` returns HTTP 200. Unauthenticated public workspace routes correctly reach sign-in. Signed-in UI review at 375px and desktop remains incomplete; no live transactions or stock changes were created for testing. | Codex — PARTIAL |
| 1:40–2:00 | Review tax, receipt, payment handling, opening-stock count and production rollback decisions. | CEO approves operational limitations and release configuration. | CEO |
| 2:00–2:30 | If all prior gates pass, migrate the approved target database and deploy the reviewed build. | Approved backup exists; migration result and deployment URL/version recorded. | CEO authorizes; Codex executes |
| 2:30–3:00 | Run production read-only and controlled transaction smoke checks; monitor error logs and confirm rollback readiness. | Dashboard values match records; one approved sale/adjustment test is reconciled; no auth or tenant leakage. | Codex + store operator |
| 3:00–4:00 | Contingency for fixes or rollback. | Any failed gate stops release and returns to staging/local work. | Codex |

## Current gate status

| Gate | Status | Evidence / blocker |
|---|---|---|
| Task branch and local scope | VERIFIED | Isolated branch and worktree created; shared worktrees preserved. |
| TypeScript | VERIFIED | `npm run typecheck` passed. |
| Unit tests | VERIFIED | 270/270 passed across 19 test files after the Retail UI corrections on 16 November. |
| Retail migration 16 logic | VERIFIED — IN MEMORY ONLY | PGlite test passed sale, adjustment, replay guard, stock rollback, dashboard, audit and role-seeding cases. Auth/permission helpers are stubs; no RLS/JWT proof. |
| Scoped lint and whitespace | VERIFIED | ESLint and `git diff --check` passed for scoped files. |
| Production build | VERIFIED ON VERCEL; LOCAL WINDOWS BUILD NEEDS WORK | Vercel remote build compiled, typechecked, generated 12/12 static pages and completed. Local Windows worker output still fails with `EPERM` creating `.next` route directories. |
| Live Migrations 15 and 16 | VERIFIED — SCHEMA ONLY | Both recorded as `20261115171617` and `20261115171739`; core objects, RLS enablement and write grants checked read-only. No fixture writes. |
| Real Supabase RLS/JWT | NOT CHECKED | Docker Desktop cannot start and the Supabase CLI is unavailable. The isolated branch quote was $0.01344/hour and the CEO declined its creation. PGlite tests stub authorization helpers and do not prove RLS/JWT isolation. |
| Email invitation delivery | NOT CHECKED | Provider credentials and actual delivery have not been exercised. |
| Public Preview smoke | VERIFIED | `/login` returned HTTP 200. `/w/uk-super/retail` and `/w/uk-super/settings/team` both route unauthenticated visitors to the sign-in page. |
| Authenticated browser flow, 375px and desktop | NEEDS WORK | The prior Preview showed “Retail data unavailable” because the page treated the many-to-one embedded branch object as an array. The fix and category-specific Retail tab are deployed to Preview `dpl_6rm1CyvecuszVbtL76rUgDfmGxqt` (commit `fccdefc`); its unauthenticated Retail route reaches sign-in. Signed-in browser verification and mobile review remain unchecked. Team previously loaded after about 10 seconds and showed Preview read-only mode. No operational action was submitted. |
| Opening stock and sale policy | NEEDS CEO DECISION | All imported products have zero stock. A physical count is required. Tax and card processing remain external/unimplemented. |
| Vercel Preview and production deployment | PREVIEW READY; PRODUCTION NOT STARTED | Preview deployment `dpl_6rm1CyvecuszVbtL76rUgDfmGxqt` for commit `fccdefc` is READY and its unauthenticated Retail route returns sign-in. The custom domain `mybusiness.stack37.com` is verified on this Vercel project but aliases Production deployment `dpl_3fKc8z73hHX7WzrtGwSZB49tmzuR` (commit `0d7a2fe`), which returns 404 on `/w/uk-super`. The Preview change has not been promoted to Production. |

## Post-authorization check (16 November 2026)

The CEO approved Production deployment. Before publishing, Codex re-ran `npm run typecheck` (passed) and `npm run test:unit` (265/265 passed in 17 files). Read-only SQL metadata checks against the live EOS database confirmed RLS is enabled on `inventory_balances`, `retail_sales`, `retail_sale_items`, and `stock_movements`. They also confirmed `adjust_inventory`, `record_retail_sale`, `update_staff_assignment`, and `get_retail_dashboard` are SECURITY DEFINER routines with an empty `search_path`, executable by `authenticated` and not `anon`. The migration source contains membership, permission, and branch-assignment checks inside these routines. These checks inspect schema/ACL metadata and source logic only; they do not simulate a real signed-in user's JWT or prove cross-tenant denial at runtime.

Codex also inspected the already signed-in Vercel Preview session without submitting forms. `/w/uk-super/retail` displayed “Retail data unavailable” and “No assigned branch”; dashboard totals were unavailable. The Team page took about 10 seconds to finish loading, then displayed the primary-owner roster and the expected Preview read-only banner. A read-only aggregate query against live EOS found one UK Super branch, one active member, and one membership with a branch assignment. Retail's unavailable-data alert therefore needs a runtime query/configuration investigation. No form was submitted.

The source inspection identified the Retail error: the `membership_branches.branch_id → branches` relation is many-to-one, so PostgREST returns an embedded branch as an object. The page called `.map()` on that object; its catch-all handler hid the TypeError and showed the misleading database/unassigned-branch alerts. The local correction normalizes either object or array shapes. The tenant layout already passed the business category into `WorkspaceFrame`, but the frame dropped it before `WorkspaceNavigation`; the local correction now adds the Retail & E-Commerce top-level tab only for that category. Other categories keep the existing navigation. The fixes are frontend-only.

Local verification after correction: 270/270 unit tests across 19 files, TypeScript, scoped ESLint, and `git diff --check` passed. Commit `fccdefcc9217bfaac671eaf55694ffc55d2cda8b` is pushed to `codex/task-uk-super-004-ops`. Preview `dpl_6rm1CyvecuszVbtL76rUgDfmGxqt` is READY at https://stack37-c5z5ydx0d-stack37.vercel.app. An unauthenticated request to `/w/uk-super/retail` returns the sign-in page (HTTP 200, matched route `/login`). The authenticated view and category tab still need owner confirmation.

The reported custom-domain 404 is separately verified: Vercel lists `mybusiness.stack37.com` as verified on this project and as an alias of Production deployment `dpl_3fKc8z73hHX7WzrtGwSZB49tmzuR`, built from `main` commit `0d7a2fe`. A request to `https://mybusiness.stack37.com/w/uk-super` returns HTTP 404, while `/login` returns HTTP 200. Thus the custom domain is reaching the old Production build; it is not a DNS verification issue. No domain assignment or Production deployment was changed.

**Release decision: NOT DEPLOYED.** The prior signed-in Retail Preview check failed before this frontend correction; the newly deployed Preview has only been checked unauthenticated so far. Team previously loaded slowly. Real JWT/RLS and authenticated employee/owner role paths have not been exercised; invitation email delivery and mobile review remain unchecked; there is no approved physical opening-stock count; and a production backup/rollback check is not evidenced here. All product stock is seeded to zero, so checkout correctly cannot sell until a store operator enters physically counted stock. No production deployment, sale, stock adjustment, or invitation write was made in this check. Production remains on its prior deployment.

**Next required step:** The CEO verifies the signed-in Retail data and category-specific tab at the Preview URL below, including desktop and 375px mobile. The store operator/CEO then supplies the approved opening-stock count and confirms pilot payment/tax/receipt handling; Codex completes the remaining security, invitation, backup, and rollback checks before any Production release. The custom domain will continue to serve the existing Production build until a separately gated Production release includes the `/w/uk-super` route.

## Go/no-go rule

Do not release if the build, isolated database tests, invitation flow, branch/role authorization, stock reconciliation, mobile layout, backup, or rollback check fails. The 2–4 hour window is achievable only if these checks pass without code changes and the required environments are already available. Current evidence does not support promising a safe live release inside that window.

**Next action:** CEO reviews the signed-in Preview at https://stack37-c5z5ydx0d-stack37.vercel.app/w/uk-super/retail and confirms the Retail tab appears for UK Super. Production authorization is recorded, but Production remains held by the open go/no-go gates. The CEO/store operator supplies the opening-stock count and pilot payment/tax/receipt decisions; Codex completes remaining security, invitation, mobile, backup, and rollback checks. The 2–4 hour estimate was conditional on these gates.
