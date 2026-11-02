import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

import { redirect } from 'next/navigation';
import HomePage from '../../src/app/page';

describe('central portal root page', () => {
  it('redirects visitors to the sign-in route', () => {
    HomePage();

    expect(redirect).toHaveBeenCalledWith('/login');
  });
});