export interface UserOrganization {
  id: string;
  name: string;
  slug: string;
  provisioning_status: string;
  is_owner: boolean;
  status: string;
}

/**
 * Constructs cross-subdomain workspace URLs for organization switching.
 * Client-safe utility function with no server-only dependencies.
 */
export function getTenantWorkspaceUrl(slug: string, currentHost = ''): string {
  const cleanHost = currentHost.split(':')[0] || 'localhost';
  const port = currentHost.includes(':') ? `:${currentHost.split(':')[1]}` : '';
  const isLocal = cleanHost.endsWith('localhost') || cleanHost === 'localhost' || cleanHost === '127.0.0.1';

  if (isLocal) {
    return `http://${slug}.localhost${port}/`;
  }
  return `https://${slug}.stack37.com/`;
}
