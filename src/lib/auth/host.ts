/**
 * Validates whether the incoming request host is an approved STACK37 EOS host.
 * 
 * Policy:
 * 1. Local development: 'localhost', '127.0.0.1', and '*.localhost' (e.g. mybusiness.localhost, tenant.localhost).
 * 2. Production: 'mybusiness.stack37.com' and '*.stack37.com' tenant subdomains.
 * 3. Apex 'stack37.com' and 'www.stack37.com' are strictly blocked (marketing site, must receive zero auth cookies).
 * 
 * Prevents DNS rebinding, cross-site callback manipulation, and session leakage.
 */
export function isApprovedCallbackHost(host: string): boolean {
  if (!host) return false;
  const cleanHost = host.split(':')[0].toLowerCase();

  // Local development / testing environments
  if (
    cleanHost === 'localhost' ||
    cleanHost === '127.0.0.1' ||
    cleanHost.endsWith('.localhost')
  ) {
    return true;
  }

  // Production EOS hosts (mybusiness or tenant subdomains)
  if (cleanHost === 'mybusiness.stack37.com' || cleanHost.endsWith('.stack37.com')) {
    // Specifically block corporate website apex and reserved external subdomains
    if (cleanHost === 'stack37.com' || cleanHost === 'www.stack37.com') {
      return false;
    }
    return true;
  }

  return false;
}
