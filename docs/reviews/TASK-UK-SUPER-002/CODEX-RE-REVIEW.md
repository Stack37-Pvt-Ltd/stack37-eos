# TASK-UK-SUPER-002 — Codex re-review

**Date:** November 5, 2026 (Asia/Colombo)
**Decision:** READY_FOR_CEO_REVIEW — local backend candidate passes static re-review; CEO-authorized hosted migrations and staging were subsequently executed and verified.
**Review scope:** Candidate Migration 14, staging service, integration test, import contract, and Antigravity's November 5 verification report.

## Result

The revised candidate resolves the seven findings in [the original Codex backend review](CODEX-BACKEND-REVIEW.md) by static inspection:

1. **Anonymous RPC access:** All four RPCs revoke execution from `PUBLIC` and `anon`, grant it to `authenticated` and `service_role`, and reject null-authenticated callers except for the explicit service/superuser path (`supabase/migrations/20261104000014_14_product_draft_staging.sql:133-155, 290-312, 415-437, 657-672, 713-723`).
2. **Mutation authorization:** The three mutation RPCs require active membership plus owner, Administrator/Inventory Manager, or `inventory_edit`; the summary RPC permits active members (`:137-152, :294-309, :419-434, :662-669`). Joins are scoped by organization.
3. **Publishing validation:** Flagged drafts must be resolved; rejected drafts, missing/out-of-range retail prices, wholesale overflow, duplicate barcodes, and duplicate SKUs receive per-item errors. Numeric casts are bounded before insertion into `NUMERIC(12,2)` catalog columns (`:452-497, :499-569, :571-596`).
4. **Review preservation:** Re-staging updates only drafts still in `staged` status and with null resolution notes (`:212-224`).
5. **Integration-test safety:** The test aborts for non-loopback URLs, creates a random disposable organization, and deletes only that organization by its generated ID during cleanup (`tests/integration/product-draft-staging.test.ts:9-15, 84-95, 220-225`).
6. **Zero-stock evidence:** Tests assert table-not-found errors for stock tables and check that staged/catalog records have no quantity fields (`tests/integration/product-draft-staging.test.ts:670-723`).
7. **Source identity:** Tests compare staged source tuples with the 2,079-item draft set, check min/max IDs, and validate file counts (`tests/integration/product-draft-staging.test.ts:371-428`).

The contract's sample summary contained an arithmetic inconsistency: `total_staged` was 2,079, all other statuses were zero, but `staged` was 1,684. I corrected the sample to `staged: 2079` and marked the contract ready for CEO review as a local-only specification.

## Local verification limits

Antigravity reports that the candidate migration was applied to local Supabase and the isolated integration suite passed 20/20, along with 215/215 unit tests, typecheck, lint, and whitespace checks. Codex did not rerun these tests during static re-review. The hosted changes described below were performed only after CEO authorization. Git commit/push and deployment remain separate and were not performed.

## November 5 hosted execution and verification

After the CEO approved Migration 13, Codex applied the approved category seed (Migration 13) followed by the already-approved Migration 14 to hosted project `xbiadendaxhoyrcvaybf`. The migration list records versions `20261104190513` and `20261104190629`, in that order. Migration 13 seeded eight shared categories. Migration 14 created the staging and catalog tables. Its apply call returned a transport error, but read-only verification confirmed it had completed and appeared in migration history; it was not reapplied.

The CEO redirected the import to a separate **`UK Super` organization** owned by `test@stack37.com`; the existing `test` organization remains untouched. Codex provisioned the new organization (`ebffb5ca-3262-4cfc-aeea-c29c420587ee`, slug `uk-super`) through the existing `create_business` workflow with the public Standard plan. Hosted verification confirmed completed provisioning, active owner membership, and a seven-day trial.

Codex staged the reviewed 2,079-item JSON draft in nine batches through `stage_product_drafts`. Read-only verification confirmed 2,079 unique `(source_file, source_id)` rows across the source set, IDs from 6 to 2211, 395 flagged rows, and all rows in `staged` status with `staged_by` set to the account owner. The `products` table remains empty for this tenant. The category table contains eight rows. `stage_product_drafts` and `create_business` are not executable by `anon`; `authenticated` and `service_role` have staging execute privileges.

Supabase security/performance advisors reported existing project warnings plus notices involving Migration 14 (including an unindexed staged-by foreign key and RLS init-plan warnings). No advisor remediation was performed. The repository migration filenames (`20261028000013`, `20261104000014`) differ from the hosted versions assigned by the MCP migration tool (`20261104190513`, `20261104190629`); reconcile local migration history before any future CLI push. These hosted changes were authorized by the CEO. Product publication, Git commit/push, and deployment remain separate decisions and were not performed.
