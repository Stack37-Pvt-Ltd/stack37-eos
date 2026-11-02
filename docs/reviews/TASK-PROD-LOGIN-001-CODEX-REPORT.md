# TASK-PROD-LOGIN-001 — Codex Frontend Handoff

**Status:** `READY_FOR_REVIEW — FRONTEND PHASE; TEST BRANCH PUSHED, VERCEL BLOCKED`  
**Date:** November 2, 2026 (Asia/Colombo)  
**Workspace:** `C:\Users\nimth\Documents\Codex\task-prod-login-001`  
**Baseline:** `132e54a6bb303700eb132d6e967efbad82e3fda6`  
**Branch:** `codex/task-prod-login-001`  
**Implementation commit:** `b751787` — pushed to GitHub for a non-production preview

## Result

The app root page now redirects to `/login` when rendered. The existing login experience and its authentication actions were left unchanged. Geist Sans and Geist Mono now use local font files, so the production build no longer needs to fetch fonts from Google. The bundled fonts carry their SIL Open Font License notice.

This is a frontend-only change. It does not make the public production URL live. The source snapshot's existing `src/proxy.ts` still rewrites the `mybusiness` host root to `/registration` before the root page is rendered. Antigravity's reported proxy correction is still separate and was not copied into this workspace.

## Exact changed-file inventory

- `src/app/page.tsx` — replace starter page with `redirect('/login')`.
- `src/app/layout.tsx` — replace Google font imports with `next/font/local`; keep Geist CSS variables.
- `src/app/fonts/geist-latin.woff2` — Geist Sans Latin font subset.
- `src/app/fonts/geist-latin-ext.woff2` — Geist Sans Latin Extended subset.
- `src/app/fonts/geist-mono-latin.woff2` — Geist Mono Latin subset.
- `src/app/fonts/geist-mono-latin-ext.woff2` — Geist Mono Latin Extended subset.
- `src/app/fonts/OFL.txt` — SIL Open Font License 1.1 notice for the bundled Geist fonts. The upstream font project identifies Geist as OFL 1.1 licensed: [vercel/geist-font](https://github.com/vercel/geist-font).
- `tests/unit/app-root-routing.test.ts` — assert the root page invokes Next.js redirect to `/login`.
- `docs/TASKS.md` — register frontend handoff evidence and integration limitation.
- `PROJECT_STATE.md` — record isolated workspace and status.
- `docs/reviews/TASK-PROD-LOGIN-001-CODEX-REPORT.md` — this handoff.

No authentication action, proxy, Supabase logic, database schema, RLS, migration, or UK Super file was changed.

## Verification

| Check | Result |
|---|---|
| Unit suite | PASS — 195 tests across 14 files |
| TypeScript | PASS — `npm run typecheck` |
| ESLint | PASS — `npm run lint` |
| Production build | PASS — `npm run build -- --webpack` (Next.js 16.2.4) |
| `git diff --check` | PASS |
| Built login markup | PASS — generated `/login` HTML contains “Sign in” and the STACK37 logo |
| Local runtime `/login` | BLOCKED — root/proxy routing runs first; local snapshot has no `.env.local` Supabase config |
| Local runtime central `/` | NOT PASSING on this unintegrated baseline — `src/proxy.ts` rewrites it to `/registration`; request returned 500 because Supabase environment is absent |
| GitHub Vercel check | FAIL — Vercel returned its account deployment-blocked status |
| Vercel preview deployment | NOT CREATED — no deployment record or test URL exists for this branch |
| Public production URL | NOT CHECKED — no deployment or production request was authorized |

The default Turbopack build was also attempted and failed when its worker process could not start in the sandbox. Webpack build succeeded after workspace access was authorized. No authentication or write-action request was sent to Supabase.

## Compatibility and backend dependency

The frontend root redirect is compatible with the reported backend contract **only after** the backend proxy redirects the central host root to `/login` before any tenant rewrite. The current proxy in this snapshot contradicts that behavior by rewriting `mybusiness` root to `/registration`. Direct `src/app/page.tsx` execution and its unit test cannot override an earlier proxy rewrite.

Required backend-owned integration file:

- `src/proxy.ts` — Antigravity's separately reported central-host root redirect, retaining the existing tenant-host routing and cookie/query handling.

No backend file was imported or edited. A separate CEO-authorized local integration is needed to combine the proxy change, then runtime checks should use isolated auth configuration or a safe mocked route harness.

## Remaining risks / not claimed

- Public `https://mybusiness.stack37.com/login` was not visually inspected after deployment and there is no deployment ID because this task did not deploy.
- The central root URL still depends on Antigravity's uncommitted proxy patch and combined verification.
- Existing Supabase login, password recovery, account creation, safe return path, cookie, and company-domain behavior were not runtime-tested here; their code was not changed.
- Browser screenshot evidence was unavailable because the in-app browser could not connect to this isolated local server. The production build's prerendered login HTML and component tests are the available frontend evidence.

## Release boundary

The CEO authorized a test push. Only this isolated login-only diff was committed as `b751787` and pushed to `codex/task-prod-login-001`. No push to `main`, production deployment, promotion, merge, migration, live database change, or production request was performed. The original source worktree, including its UK Super uncommitted changes, was not modified. Vercel's account deployment-blocked gate prevented creation of a preview deployment. This frontend phase remains ready for CEO review; stop here pending the account block resolution and the separate proxy integration.
