import { describe, expect, it } from 'vitest';
import { getTeamReturnPath } from '../../src/components/tenant/workspace-paths';

describe('public Team return paths', () => {
  it('passes the public workspace subpath; the backend adds the trusted preview prefix', () => {
    expect(getTeamReturnPath()).toBe('/settings/team');
  });
});
