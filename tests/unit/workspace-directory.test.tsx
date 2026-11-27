import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const state = vi.hoisted(() => ({ getTenantWorkspaceUrl: vi.fn() }));
vi.mock('../../src/lib/auth/tenant-utils', () => ({ getTenantWorkspaceUrl: state.getTenantWorkspaceUrl }));

import { WorkspaceDirectory } from '../../src/components/tenant/workspace-directory';

describe('workspace directory links', () => {
  it('uses the backend URL contract for each tenant and current preview host', () => {
    state.getTenantWorkspaceUrl.mockImplementation((slug: string) => `https://preview.example/w/${slug}/`);
    const html = renderToStaticMarkup(<WorkspaceDirectory organizations={[
      { id: 'org-a', name: 'Serendib', slug: 'serendib', provisioning_status: 'active', is_owner: true, status: 'active' },
    ]} host="preview.example" />);

    expect(state.getTenantWorkspaceUrl).toHaveBeenCalledWith('serendib', 'preview.example');
    expect(html).toContain('href="https://preview.example/w/serendib/"');
  });
});
