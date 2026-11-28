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
  const isVercel = hostname.endsWith('.vercel.app');
  const port = rawPort && /^\d+$/.test(rawPort) ? `:${rawPort}` : '';

  let origin = 'https://mybusiness.stack37.com';
  if (isLocal) {
    origin = `http://mybusiness.localhost${port}`;
  } else if (isVercel || (hostname && hostname !== 'stack37.com' && !hostname.endsWith('.stack37.com'))) {
    // Preserve the active host for Vercel preview deployments (*.vercel.app) or preview aliases
    origin = `https://${hostname}${port}`;
  }

  return `${origin}/w/${encodeURIComponent(slug)}`;
}
