import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from '../../src/components/ui/button';
import { Input } from '../../src/components/ui/input';
import { WorkspaceOverview } from '../../src/components/tenant/workspace-overview';

describe('Frontend semantic controls', () => {
  it('renders a styled link as one anchor without a nested button or runtime slot error', () => {
    const html = renderToStaticMarkup(<Button asChild><a href="/settings">Open settings</a></Button>);
    expect(html).toContain('href="/settings"');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('type="button"');
  });
  it('blocks repeated submissions while loading and exposes busy state', () => {
    const html = renderToStaticMarkup(<Button type="submit" isLoading>Save changes</Button>);
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
  });
  it('associates input errors with the field for assistive technology', () => {
    const html = renderToStaticMarkup(<Input id="email" label="Email" error="Check your email" />);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="email-error"');
    expect(html).toContain('id="email-error"');
  });
  it('does not invent a plan or trial period when subscription data is missing', () => {
    const html = renderToStaticMarkup(
      <WorkspaceOverview
        organization={{ name: 'Example Business', slug: 'example' }}
        membership={{ is_owner: true, status: 'active' }}
        data={null}
      />,
    );
    expect(html).toContain('Subscription details unavailable');
    expect(html).not.toContain('7 days left in trial');
    expect(html).not.toContain('Standard');
  });
});
