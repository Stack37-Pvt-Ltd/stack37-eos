# TASK-UK-SUPER-004 — Implementation and live release plan

**Prepared:** 15 November 2026 (Asia/Colombo)

**Owner:** ChatGPT Codex (CEO reassigned implementation in this conversation)

**Candidate:** `codex/task-uk-super-004-ops`

**Current status:** Migrations 15 and 16 are live. Commits `50f0025c4fa2a25018e365ae8e5ff7b0fb33d813` and author-corrected follow-up `7e41f02cc3ea590f8e202b240ab478c5acb8ff7b` are pushed to the task branch. Preview deployment `dpl_145YHTSkUXz6b2qpDYwL2d2jBcmM` for `7e41f02` is READY. Production site remains unchanged.

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
| Unit tests | VERIFIED | 265/265 passed across 17 test files. |
| Retail migration 16 logic | VERIFIED — IN MEMORY ONLY | PGlite test passed sale, adjustment, replay guard, stock rollback, dashboard, audit and role-seeding cases. Auth/permission helpers are stubs; no RLS/JWT proof. |
| Scoped lint and whitespace | VERIFIED | ESLint and `git diff --check` passed for scoped files. |
| Production build | VERIFIED ON VERCEL; LOCAL WINDOWS BUILD NEEDS WORK | Vercel remote build compiled, typechecked, generated 12/12 static pages and completed. Local Windows worker output still fails with `EPERM` creating `.next` route directories. |
| Live Migrations 15 and 16 | VERIFIED — SCHEMA ONLY | Both recorded as `20261115171617` and `20261115171739`; core objects, RLS enablement and write grants checked read-only. No fixture writes. |
| Real Supabase RLS/JWT | NOT CHECKED | Docker Desktop cannot start and the Supabase CLI is unavailable. The isolated branch quote was $0.01344/hour and the CEO declined its creation. PGlite tests stub authorization helpers and do not prove RLS/JWT isolation. |
| Email invitation delivery | NOT CHECKED | Provider credentials and actual delivery have not been exercised. |
| Public Preview smoke | VERIFIED | `/login` returned HTTP 200. `/w/uk-super/retail` and `/w/uk-super/settings/team` both route unauthenticated visitors to the sign-in page. |
| Authenticated browser flow, 375px and desktop | NOT CHECKED | Requires an authenticated test account; operational actions must be reviewed without writing unapproved business records. |
| Opening stock and sale policy | NEEDS CEO DECISION | All imported products have zero stock. A physical count is required. Tax and card processing remain external/unimplemented. |
| Vercel Preview and production deployment | PREVIEW READY; PRODUCTION NOT STARTED | Preview deployment `dpl_145YHTSkUXz6b2qpDYwL2d2jBcmM` for commit `7e41f02` is READY and public routing smoke checks pass. The earlier deployment was blocked by its author email; the follow-up uses the verified GitHub identity. The Vercel CLI is unavailable. No production deployment has happened. |

## Go/no-go rule

Do not release if the build, isolated database tests, invitation flow, branch/role authorization, stock reconciliation, mobile layout, backup, or rollback check fails. The 2–4 hour window is achievable only if these checks pass without code changes and the required environments are already available. Current evidence does not support promising a safe live release inside that window.

**Next action:** The candidate is ready for CEO review on Vercel Preview: `https://stack37-74n4a3m4t-stack37.vercel.app`. Before production, the CEO/store operator must supply an approved signed-in test account and confirm stock-count, tax, receipt, and payment handling; Codex can then verify the authenticated UI and security paths without creating unapproved sales or stock records. Production promotion remains pending, and the 2–4 hour estimate was conditional on these gates.
