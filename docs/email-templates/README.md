# Authentication email visual handoff — TASK-STAB-004

These HTML and matching text files implement the approved visual presentation locally. They are **draft assets, not activated templates**. This repository contains no active confirmation/recovery template configuration; hosted authentication settings have not been read or changed.

- `{{ACTION_URL}}`: substitute the **unchanged existing intermediate-confirmation URL** from Antigravity's active email contract. Do not replace it with a direct OTP verification link or change token parameters, redirects, or expiry policy.
- `{{LOGO_URL}}`: substitute the publicly reachable HTTPS URL of the official logo when a deployment is separately authorized. Local preview uses `/stack37-logo.webp`.
- Keep the existing sender configuration. The approved presentation specifies `STACK37 <noreply@stack37.com>`; this task does not activate or verify that sender.
- Recovery copy correctly describes the **15-minute session after deliberate confirmation**, which is what the existing backend enforces. It does not claim the initial email token expires after 15 minutes.
- Emails use table layouts, a maximum width of 560px, square navy actions and a system/Arial fallback where the mail client cannot render Geist. Both variants have text alternatives.
- Antigravity must map the placeholders to the existing hosted template contract and verify mail delivery/client behavior before activation. No live service changes are authorized by this visual handoff.

Preview after `node tests/ui/serve.mjs`: `http://127.0.0.1:3002/email/confirmation` and `http://127.0.0.1:3002/email/recovery`.
