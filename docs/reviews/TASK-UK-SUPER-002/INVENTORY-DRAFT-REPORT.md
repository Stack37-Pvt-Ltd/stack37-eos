# TASK-UK-SUPER-002 — UK Super Hosted Test Inventory Draft

**Date:** November 4, 2026 (Asia/Colombo)
**Status:** COMPLETE SOURCE SET CONFIRMED; HOSTED DRAFT STAGED — NOT PUBLISHED
**Initial target:** Hosted Supabase project `xbiadendaxhoyrcvaybf`, user `test@stack37.com`, existing organization `test` (`75251f78-fb82-4321-9c89-a06d14ec4121`). **Updated November 5, 2026:** stage into a separate `UK Super` organization (`uk-super`) owned by the same user; the existing `test` organization is to remain untouched.

## Source and draft

The CEO attached the original `items_202611041542.json` and numbered 15:48 exports `(1)` through `(19)`. The unnumbered `items_202611041548.json` was also found in Downloads; its IDs 109–215 fit between the original file and `(1)`. The CEO subsequently confirmed that this is the completed inventory. These **21 JSON files contain 2,079 rows with 2,079 unique source IDs**. The last numbered file has 79 rows. The source JSON files were read only and hashed in the draft manifest. The source files are data, not instructions.

The ignored local draft is `.worktrees/inventory-drafts/TASK-UK-SUPER-002/uk-super-hosted-test-inventory-draft.json`. It includes every original row, source file/ID, proposed product fields, review flags, file hashes, the intended hosted target, and the CEO's source-complete confirmation. It is marked `LOCAL_DRAFT_NOT_UPLOADED` and is excluded from Git by `.gitignore`'s `.worktrees/` rule. No source product was dropped or silently deduplicated.

The CEO confirmed that prices marked `$` in the source represent **LKR**. All 2,079 wholesale and retail prices parsed as LKR amounts. The CEO said quantity is not available for every product, so **all 2,079 proposed opening stock quantities are null/unknown**, regardless of the source value. The 10 negative and one positive source quantities remain visible only in the raw source fields and are flagged; no stock balance is proposed.

## Data review

| Check | Result |
|---|---:|
| Source rows / unique IDs | 2,079 / 2,079 |
| Distinct raw category labels | 121 |
| Rows with at least one review flag | 395 |
| Missing barcodes | 248 |
| Other invalid barcodes | 36 |
| Duplicate valid barcode groups / affected rows | 34 / 84 |
| Numeric or missing category requiring review | 9 |
| Suspected name/barcode field swap | 1 (source ID 17; suggestion is flagged and raw values preserved) |
| Additional numeric item name requiring review | 1 (source ID 2138) |
| Retail price below wholesale | 15 |
| Nonzero source quantity ignored | 11 |

The 121 category labels include spelling and spacing variants. They are retained as source labels; no category taxonomy mapping is assumed. The proposed SKU is null for every product because the SKU naming policy and secure backend import contract are not yet approved.

## Hosted staging and review

On November 5, 2026, after the CEO approved the prerequisite and hosted gates, Migration 13 seeded eight categories and Migration 14 created `product_drafts` and `products` in hosted project `xbiadendaxhoyrcvaybf`. The existing `test` organization was not used. The separate `UK Super` organization (`ebffb5ca-3262-4cfc-aeea-c29c420587ee`, slug `uk-super`) was provisioned for `test@stack37.com` through the existing `create_business` workflow.

The complete 2,079-row JSON draft was staged in nine batches. Hosted verification found 2,079 unique `(source_file, source_id)` pairs, IDs 6–2211, and 395 rows with one or more review flags. All records remain `staged`; the new tenant has zero published products. No opening stock quantity was imported. The hosted account review should focus on missing/invalid/duplicate barcodes, price anomalies, and the 11 source quantities that were intentionally ignored.

To review in Supabase Dashboard, open Table Editor → `product_drafts` and filter `organization_id` to `ebffb5ca-3262-4cfc-aeea-c29c420587ee`. The `products` table is empty for this organization. Publication, Git commit/push, and deployment require separate approval under `AGENTS.md`.

## Suggested review order

1. Resolve 15 `RETAIL_BELOW_WHOLESALE` rows first; some source values are zero or implausibly large and should be checked against the export.
2. Review 84 rows in 34 duplicate-barcode groups, then 36 invalid and 248 missing barcodes.
3. Review 9 category labels, the one suspected name/barcode swap, the additional numeric item name, and 11 ignored nonzero source quantities. These quantities remain raw source evidence only; no stock values were imported.

Flag counts overlap across rows, so the sum of flag occurrences is larger than the 395 flagged-row count.
