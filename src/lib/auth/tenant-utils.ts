export interface UserOrganization {
  id: string;
  name: string;
  slug: string;
  provisioning_status: string;
  is_owner: boolean;
  status: string;
}

/**
 * Constructs canonical portal workspace URLs for organization switching.
 * Client-safe utility function with no server-only dependencies.
 */
export function getTenantWorkspaceUrl(slug: string, currentHost = ''): string {
  const [hostname, rawPort] = currentHost.trim().toLowerCase().split(':');
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');
  const port = rawPort && /^\d+$/.test(rawPort) ? `:${rawPort}` : '';
  const origin = isLocal ? `http://mybusiness.localhost${port}` : 'https://mybusiness.stack37.com';

  return `${origin}/w/${encodeURIComponent(slug)}`;
}
