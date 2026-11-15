# TASK-UK-SUPER-004 — Implementation and live release plan

**Prepared:** 15 November 2026 (Asia/Colombo)

**Owner:** ChatGPT Codex (CEO reassigned implementation in this conversation)

**Candidate:** `codex/task-uk-super-004-ops`

**Current status:** Migrations 15 and 16 are live; commit `50f0025c4fa2a25018e365ae8e5ff7b0fb33d813` is pushed to the task branch. Preview deployment `dpl_9FCnvG5nMqixmD8Lxv8RKdErTcYm` is BLOCKED because its commit author email is not verified on the connected GitHub profile. Production site remains unchanged.

## What is in the candidate

The candidate connects the UK Super retail page to branch scoped product and stock reads, current dashboard totals, atomic sale recording and stock adjustment actions. It adds employee role/branch assignment, based on the existing staff invitation and access workflow. The point of sale accepts cash or a card payment marked as processed elsewhere. It does not handle card authorization, tax calculation, till reconciliation or legally approved receipts.

Current UK Super product drafts are still staged and there is no trusted opening stock. Imported products begin at zero on hand. A responsible pilot must count and enter stock before checkout can sell products.

## Release sequence and estimates

The 2–4 hour estimate is conditional on a successful build, protected Preview, approved test account and production rollback path. The CEO selected the live EOS database instead of the quoted paid isolated branch. Each stage remains a gate; elapsed time does not override a failed check.

| Elapsed time | Task | Evidence required | Owner |
|---|---|---|---|
| 0:00–0:20 | Resolve the local production-build blocker; review exact file and migration diff. | Production build succeeds; branch and task scope reviewed. | Codex |
| 0:20–1:00 | Apply and verify Migration 15, then Migration 16 on the CEO-selected EOS Supabase project. | Both versions recorded; required columns, RPCs, RLS enablement and direct-write grants checked read-only. No operational sales, stock or invitation fixtures written. | Codex — VERIFIED |
| 1:00–1:40 | Create a protected Vercel Preview from this candidate; check auth entry routes and use only read-only actions against live UK Super data. | Preview build is ready; login and operational UI checked at 375px and desktop. No live transactions or stock changes created for testing. | Codex — BLOCKED by Vercel team configuration |
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
| Production build | NEEDS WORK | Geist is self-hosted; webpack compiles and typechecks but Windows worker output fails with `EPERM` creating `.next` route directories. |
| Live Migrations 15 and 16 | VERIFIED — SCHEMA ONLY | Both recorded as `20261115171617` and `20261115171739`; core objects, RLS enablement and write grants checked read-only. No fixture writes. |
| Real Supabase RLS/JWT | NOT CHECKED | Docker Desktop cannot start and the Supabase CLI is unavailable. The isolated branch quote was $0.01344/hour and the CEO declined its creation. PGlite tests stub authorization helpers and do not prove RLS/JWT isolation. |
| Email invitation delivery | NOT CHECKED | Provider credentials and actual delivery have not been exercised. |
| Browser flow, 375px and desktop | NOT CHECKED | Requires an authenticated staging/test account. |
| Opening stock and sale policy | NEEDS CEO DECISION | All imported products have zero stock. A physical count is required. Tax and card processing remain external/unimplemented. |
| Vercel Preview and production deployment | PREVIEW BLOCKED; PRODUCTION NOT STARTED | Candidate commit is pushed. Vercel deployment `dpl_9FCnvG5nMqixmD8Lxv8RKdErTcYm` is `BLOCKED` because the author email did not match the authenticated GitHub profile. A follow-up task commit is being prepared with the verified identity. The Vercel CLI is unavailable. No production deployment has happened. |

## Go/no-go rule

Do not release if the build, isolated database tests, invitation flow, branch/role authorization, stock reconciliation, mobile layout, backup, or rollback check fails. The 2–4 hour window is achievable only if these checks pass without code changes and the required environments are already available. Current evidence does not support promising a safe live release inside that window.

**Next action:** Codex pushes a follow-up commit using the verified GitHub author identity. Vercel should then build a new Preview; Codex checks the build and reviews signed-in flows without writing live UK Super business records. Production promotion remains pending until Preview and real authenticated security checks pass. The 2–4 hour estimate remains conditional.
