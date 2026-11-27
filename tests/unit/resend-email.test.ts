import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendInvitationEmail } from '../../src/lib/email/invitation';

describe('sendInvitationEmail - Resend.com & Mailpit integration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  const baseOptions = {
    to: 'cashier@uksuper.com',
    organizationName: 'UK Super',
    inviterName: 'Store Owner',
    roleName: 'Cashier',
    branchName: 'Headquarters',
    actionUrl: 'https://mybusiness.stack37.com/invite/accept?token=sampletoken12345678901234567890',
  };

  it('omits real email delivery when NODE_ENV is test and no override is present', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    delete process.env.RESEND_API_KEY;

    const result = await sendInvitationEmail(baseOptions);
    expect(result.delivered).toBe(false);
    expect(result.error).toMatch(/unit test/i);
  });

  it('dispatches to api.resend.com/emails with Bearer auth and correct payload when RESEND_API_KEY is present', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.RESEND_API_KEY = 're_test_key_12345';
    process.env.INVITATION_FROM_EMAIL = 'UK Super <invites@stack37.com>';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'resend_email_id_999' }),
    });
    globalThis.fetch = mockFetch;

    const result = await sendInvitationEmail(baseOptions);

    expect(result.delivered).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, requestInit] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(requestInit.method).toBe('POST');
    expect(requestInit.headers).toEqual({
      Authorization: 'Bearer re_test_key_12345',
      'Content-Type': 'application/json',
    });

    const parsedBody = JSON.parse(requestInit.body);
    expect(parsedBody.from).toBe('UK Super <invites@stack37.com>');
    expect(parsedBody.to).toEqual(['cashier@uksuper.com']);
    expect(parsedBody.subject).toBe('You have been invited to join UK Super on STACK37');
    expect(parsedBody.html).toContain('Join UK Super');
    expect(parsedBody.html).toContain('Cashier');
    expect(parsedBody.text).toContain('cashier@uksuper.com');
  });

  it('dispatches with template id and variables when RESEND_INVITATION_TEMPLATE_ID is present', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.RESEND_API_KEY = 're_test_key_12345';
    process.env.RESEND_INVITATION_TEMPLATE_ID = 'tpl_uk_super_invite_001';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'resend_email_id_1000' }),
    });
    globalThis.fetch = mockFetch;

    const result = await sendInvitationEmail(baseOptions);

    expect(result.delivered).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [, requestInit] = mockFetch.mock.calls[0];
    const parsedBody = JSON.parse(requestInit.body);
    expect(parsedBody.template).toEqual({
      id: 'tpl_uk_super_invite_001',
      variables: {
        INVITER_NAME: 'Store Owner',
        ORGANIZATION_NAME: 'UK Super',
        ROLE_NAME: 'Cashier',
        BRANCH_NAME: 'Headquarters',
        INVITE_URL: baseOptions.actionUrl,
      },
    });
  });

  it('handles Resend API rejection gracefully without throwing', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.RESEND_API_KEY = 're_test_key_invalid';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      text: async () => 'Domain not verified',
    });
    globalThis.fetch = mockFetch;

    const result = await sendInvitationEmail(baseOptions);
    expect(result.delivered).toBe(false);
    expect(result.error).toContain('Domain not verified');
  });

  it('handles network failure during Resend dispatch gracefully', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.RESEND_API_KEY = 're_test_key_network';

    const mockFetch = vi.fn().mockRejectedValue(new Error('Connection timed out'));
    globalThis.fetch = mockFetch;

    const result = await sendInvitationEmail(baseOptions);
    expect(result.delivered).toBe(false);
    expect(result.error).toBe('Connection timed out');
  });

  it('falls back to local Mailpit when RESEND_API_KEY is not configured', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    delete process.env.RESEND_API_KEY;
    process.env.MAILPIT_URL = 'http://127.0.0.1:54324';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => 'ok',
    });
    globalThis.fetch = mockFetch;

    const result = await sendInvitationEmail(baseOptions);
    expect(result.delivered).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:54324/api/v1/send', expect.anything());
  });
});
