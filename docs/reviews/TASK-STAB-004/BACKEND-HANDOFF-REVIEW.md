# TASK-STAB-005A Backend Handoff Review

**Reviewed:** October 14, 2026\
**Compared sources:** CEO-supplied `STACK37_TASK-STAB-005A_Codex_Backend_Handoff.md`, canonical repository specification `docs/integration/backend_integration_readiness.md`, and current source code.\
**Scope:** Read-only backend contract verification for TASK-STAB-004. No backend or live service changes were made.

The canonical repository specification is a better match for the source than the supplied shared report copy. It correctly qualifies several items that the shared copy misstated. Both documents remain Antigravity-authored claims; repository code was used as the source of truth for implementation behavior.

## Verified contracts preserved in the UI

- **Authentication:** Login, signup, forgot password, reset password, confirmation, and logout use the existing server actions and their result objects. Generic login/recovery responses remain intact. Signup with email confirmation routes to the existing verification notice.
- **Confirmation and password recovery:** `ConfirmCard` invokes `confirmOtpAction` only in the explicit button submit handler. `resetPasswordAction` stays bound to the existing recovery session. UI changes do not alter auth security or action logic.
- **Business registration:** Form submits `{ name, slug, countryCode }`; preserves client validation, server error mapping, duplicate-click lock, and the returned workspace/owner/plan/trial continuation.
- **Tenant routing:** In-workspace navigation uses `/` and `/settings`. Cross-workspace links continue through `getTenantWorkspaceUrl`. Proxy and tenant guards are unchanged.
- **Business settings:** The page passes verified `membership.id` to `getBusinessConfiguration`. `canEdit` controls readonly fields/save controls and the advisory. Both save flows pass their current organization and HQ IDs and consume `success`, `error`, and `fieldErrors` as returned. The action's owner authorization remains authoritative.
- **Workspace detail presentation:** Resolver output is used for organization, assigned role, branch and subscription. Permission identifiers are not displayed as user-facing “codes”.
- **Tax:** The UI submits only existing `taxId` and `taxStatus`. No functional VAT or SSCL switches or invented payload properties were added.
- **Duplicate submissions:** Auth forms, confirmation, registration, business settings and HQ forms now use synchronous in-flight refs in addition to disabled/loading controls. A rerender delay cannot start a second action.
- **Trial display:** Dashboard text now reflects resolved subscription data. Missing subscription data displays “Unavailable” and “Subscription details unavailable”; it no longer invents a Standard plan or seven days remaining.

## Differences in the supplied shared copy and canonical specification

1. **Settings authorization status:** The supplied copy says non-owners receive HTTP 403. The source actions return a serializable `{ success: false, error }` object and do not set HTTP status 403. The canonical specification correctly describes the action result.

2. **Recovery cookie name:** The supplied copy calls it `sb-recovery-mode`. Source and canonical specification use `sb-recovery-token`, with an HTTP-only 900-second cookie after explicit recovery confirmation.

3. **Optional registration category:** The supplied copy lists optional `categoryId` as a registration action input. Current `createBusinessSchema` accepts it, but `createBusinessAction` ignores it and the current registration UI sends only name, slug, and country code. The canonical specification explicitly records this as a future-expansion field and says categorization happens in settings. UI follows current behavior.

4. **Branch fallback:** The supplied copy says the operational-data resolver defaults the assigned branch to Headquarters. Source selects an explicitly assigned branch, else the first branch in alphabetical name order, else `null`. The canonical specification accurately describes this. Workspace overview displays resolver data.

5. **Plan selection:** Source prefers public Standard, but when Standard is absent and a public plan exists, it falls back to the lowest-priced public plan. Thus the handoff's fixed `planName: 'Standard'` success wording is not guaranteed. The UI uses the returned `planName`.

6. **Optional membership ID in settings resolver:** `getBusinessConfiguration(organizationId, userMembershipId?)` initializes `canEdit = true` if the optional membership ID is omitted. The actual settings route passes the guard-verified membership ID, and both mutation actions independently enforce active Primary Owner status. This is a backend call-site contract caveat, not changed here.

7. **Resolver access and permissions wording:** Canonical text says `getBusinessConfiguration` returns `null` when the user is unauthorized. Source returns configuration with `canEdit: false` for a non-owner; the tenant route guard runs before the resolver, and server actions enforce the write gate. Also, `getWorkspaceOperationalData.permissions` contains selected `permission_id` values, not permission-code strings. Overview no longer renders those IDs.

## Evidence limits and remaining integration work

The attached copy asserts 169 passing tests and remote migrations 01–12. The canonical repository document asserts backend readiness. TASK-STAB-004 separately ran the current repository's unit suite (170 tests after adding one UI regression check), typecheck, scoped lint, and production build. This frontend task did not query Supabase, verify remote migration/RLS state, send real email, or perform live customer writes. These remain for joint TASK-STAB-005 verification.

## Result

The redesigned screens bind to the actual repository contracts and preserve their current security and business behavior. Differences that would require backend contract changes are documented, not changed. VAT/SSCL remains unimplemented.
