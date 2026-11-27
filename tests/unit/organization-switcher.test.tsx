import { beforeEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => ({ pathname: '/', helper: vi.fn((slug: string) => `https://${slug}.stack37.com/`) }));
vi.mock('next/navigation', () => ({ usePathname: () => testState.pathname }));
vi.mock('../../src/lib/auth/tenant-utils', () => ({ getTenantWorkspaceUrl: testState.helper }));

import { getOrganizationWorkspaceHref } from '../../src/components/tenant/organization-switcher';

describe('Organization switcher URLs', () => {
  beforeEach(() => {
    testState.pathname = '/';
    testState.helper.mockClear();
  });

  it('keeps preview workspace switches on the same host using public /w routes', () => {
    expect(getOrganizationWorkspaceHref('northline', '/w/serendib/settings/team', 'stack37-tv4j4r6y8-stack37.vercel.app')).toBe('/w/northline/');
    expect(testState.helper).not.toHaveBeenCalled();
  });

  it('preserves production workspace URLs through the approved backend helper', () => {
    expect(getOrganizationWorkspaceHref('northline', '/settings/team', 'serendib.stack37.com')).toBe('https://northline.stack37.com/');
    expect(testState.helper).toHaveBeenCalledWith('northline', 'serendib.stack37.com');
  });
});
