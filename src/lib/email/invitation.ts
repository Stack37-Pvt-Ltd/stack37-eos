/**
 * Transactional Email Dispatcher for Team Invitations
 * Task: TASK-TEAM-001 (FEAT-TEAM-001)
 *
 * Captures outgoing mail via Local Supabase Mailpit (port 54324) in development
 * and testing environments. Zero real emails are dispatched.
 */

export interface SendInvitationEmailOptions {
  to: string;
  organizationName: string;
  inviterName: string;
  roleName: string;
  branchName: string;
  actionUrl: string;
  expiryDays?: string;
  logoUrl?: string;
}

/**
 * Escapes characters for HTML text and attribute context to prevent XSS / markup injection.
 */
export function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validates and sanitizes a URL for use in href / src attributes.
 * Allows only http and https protocols. Fails closed with '#' on unsafe protocols (e.g. javascript:).
 */
export function sanitizeUrl(urlStr: string): string {
  try {
    const trimmed = String(urlStr).trim();
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '#';
    }
    return escapeHtml(parsed.href);
  } catch {
    return '#';
  }
}

export function renderInvitationEmailHtml(options: SendInvitationEmailOptions): string {
  const orgName = escapeHtml(options.organizationName);
  const inviterName = escapeHtml(options.inviterName);
  const roleName = escapeHtml(options.roleName);
  const branchName = escapeHtml(options.branchName);
  const toEmail = escapeHtml(options.to);
  const expiry = escapeHtml(options.expiryDays || '7 days');
  const logo = sanitizeUrl(options.logoUrl || 'https://mybusiness.stack37.com/logo.png');
  const actionUrl = sanitizeUrl(options.actionUrl);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>You have been invited to join ${orgName}</title></head>
<body style="margin:0;background:#eaf1f7;font-family:Geist,Arial,sans-serif;color:#172334">
<div style="display:none;max-height:0;overflow:hidden">You have been invited to join ${orgName} on My Business by STACK37.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eaf1f7"><tr><td align="center" style="padding:28px 16px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border:1px solid #dce4ee;background:white">
<tr><td style="padding:32px 28px 20px"><img src="${logo}" width="166" height="31" alt="STACK37" style="display:block;width:166px;height:auto;border:0"></td></tr>
<tr><td style="padding:0 28px 28px">
<h1 style="margin:0 0 16px;font-size:25px;line-height:1.25;letter-spacing:-.5px;font-weight:600">Join ${orgName}</h1>
<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#475569"><strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> on My Business by STACK37.</p>
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border:1px solid #dce4ee;background:#f8fafc;width:100%">
<tr><td style="padding:12px 16px;font-size:13px;color:#475569">
<div style="margin-bottom:6px"><strong>Assigned Role:</strong> ${roleName}</div>
<div><strong>Operating Branch:</strong> ${branchName}</div>
</td></tr>
</table>
<table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#172334" style="background:#172334"><a href="${actionUrl}" style="display:inline-block;padding:15px 22px;color:white;font-size:13px;font-weight:600;text-decoration:none">Accept invitation &rarr;</a></td></tr></table>
<p style="margin:28px 0 0;padding-top:22px;border-top:1px solid #dce4ee;color:#475569;font-size:12px;line-height:1.7">This invitation was sent to ${toEmail} and is valid for ${expiry}. If you were not expecting this invitation, you can safely ignore this email.</p>
</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #dce4ee;color:#526784;font-size:12px;line-height:1.6">My Business by STACK37</td></tr>
</table></td></tr></table></body></html>`;
}

export function renderInvitationEmailText(options: SendInvitationEmailOptions): string {
  const expiry = options.expiryDays || '7 days';

  return `Join ${options.organizationName} on My Business by STACK37

${options.inviterName} has invited you to join ${options.organizationName} on My Business by STACK37.

Assigned Role: ${options.roleName}
Operating Branch: ${options.branchName}

Accept invitation: ${options.actionUrl}

This invitation was sent to ${options.to} and is valid for ${expiry}. If you were not expecting this invitation, you can safely ignore this email.

My Business by STACK37`;
}

/**
 * Dispatch an invitation email.
 * In local/testing, forwards to local Mailpit (port 54324) if accessible.
 * Fails gracefully and returns { delivered: false, error } so caller can take appropriate action.
 */
export async function sendInvitationEmail(
  options: SendInvitationEmailOptions
): Promise<{ delivered: boolean; error?: string }> {
  const html = renderInvitationEmailHtml(options);
  const text = renderInvitationEmailText(options);
  const subject = `You have been invited to join ${options.organizationName} on STACK37`;

  const mailpitBaseUrl = process.env.MAILPIT_URL || (process.env.NODE_ENV === 'test' ? null : 'http://127.0.0.1:54324');
  if (!mailpitBaseUrl) {
    return { delivered: false, error: 'Mailpit omitted in unit test environment' };
  }

  try {
    const res = await fetch(`${mailpitBaseUrl}/api/v1/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        From: {
          Email: 'noreply@stack37.com',
          Name: 'STACK37',
        },
        To: [
          {
            Email: options.to,
          },
        ],
        Subject: subject,
        Text: text,
        HTML: html,
      }),
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      return { delivered: true };
    } else {
      const errText = await res.text().catch(() => 'Mailpit HTTP error');
      return { delivered: false, error: `Mailpit rejected message: ${errText}` };
    }
  } catch (err) {
    return {
      delivered: false,
      error: err instanceof Error ? err.message : 'Mail delivery unavailable',
    };
  }
}
