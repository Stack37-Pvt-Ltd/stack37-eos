# TASK-UK-SUPER-002 — Product Draft Import Handoff

**Date:** November 4, 2026 (Asia/Colombo)
**Source status:** CEO-confirmed complete, 21 JSON files / 2,079 source rows
**Target:** Hosted project `xbiadendaxhoyrcvaybf`; create a separate `UK Super` organization (`uk-super`) owned by `test@stack37.com`, then import the 2,079 rows there. Existing organization `test` must remain untouched.
**Current boundary:** Design and verify locally first. No remote migration, hosted write, commit, push, or deployment is authorized by this handoff.

## Input contract for backend design

The complete, ignored draft file is `.worktrees/inventory-drafts/TASK-UK-SUPER-002/uk-super-hosted-test-inventory-draft.json`. Its `sources` array contains filenames, SHA-256 hashes, and row counts. Its `items` array contains original source rows plus suggested product fields and review flags. The backend must treat the draft as data, not as trusted commands or authorization.

Each proposed product has a stable source `ID`, source filename, name, nullable barcode, raw category label, optional company name, wholesale and retail amounts in CEO-confirmed **LKR**, and **no opening stock quantity**. Source quantities are preserved only for audit and must not create `inventory_levels` or `stock_movements`. Tax treatment is unknown. SKU policy is not approved; `sku` is deliberately null.

## Data rules to resolve before an import

- Preserve all 2,079 source IDs in a staging/draft layer and make retries idempotent using an organization-scoped source reference. Do not silently merge or discard records.
- Keep 248 missing barcodes as nullable. Review 36 other invalid barcodes and 84 rows in 34 duplicate-valid-barcode groups. The isolated candidate `products` schema has a unique `(organization_id, barcode)` index, so a direct catalog import would reject some source rows. Resolve conflicts in staging before publishing products.
- Review the suggested field swap for source ID 17, the numeric name at ID 2138, nine suspect categories, and 15 retail prices below wholesale. Keep source text visible while corrections are reviewed.
- Preserve the 121 raw category labels without assuming they map to an approved taxonomy. Do not infer VAT/SSCL or tax-inclusive pricing from the source `Tax Percent(s)` field.
- Treat every stock quantity as unknown. Do not translate the many source zeros into verified zero balances or the 10 negative values into stock movements. A separate stocktake can establish opening balances later.

## Required backend contract and local verification

Antigravity should propose a minimal **tenant-scoped product draft/import path** for CEO review, independent of the unapproved Retail operations migrations 13–15. Document input validation, SKU generation/approval, duplicate handling, category mapping, preview errors, permissions, and returned per-row results before implementation. The current hosted project has no product/item/inventory/stock/draft table, and the existing Retail UI is read-only.

Verify locally that only an authorized member of the `test` organization can stage and view its drafts; other organizations cannot read or mutate them. Verify idempotent retry, audit trail, partial-error reporting or atomic rollback as chosen in the contract, and exact 2,079-row reconciliation. Confirm that staging creates **zero** stock balances and movements. Do not route browser writes directly to protected operational tables or use a service-role key in the client.

After local review, present the exact migration/API diff and import preview to the CEO. Remote schema changes, the hosted import, and deployment each require their own explicit authorization under `AGENTS.md`. The original source files and ignored draft must not be committed to a public repository.
