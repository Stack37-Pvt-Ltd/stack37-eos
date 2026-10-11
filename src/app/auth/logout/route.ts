import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

/**
 * Rejects GET requests with 405 Method Not Allowed to eliminate
 * cross-site image / link CSRF logout vulnerabilities.
 */
export async function GET() {
  return new NextResponse('Method Not Allowed. Logout requires POST.', {
    status: 405,
    headers: {
      Allow: 'POST',
    },
  });
}

/**
 * Processes logout requests via POST.
 * 
 * Scope:
 * - 'local' (default): Clears session on current browser/device.
 * - 'global': Revokes refresh token family globally on Supabase Auth server.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');

  // Strict Cross-Origin CSRF Defense:
  // Validate that Origin (or Referer) matches the server's expected host
  if (origin) {
    try {
      const originHost = new URL(origin).host.split(':')[0];
      const expectedHost = host?.split(':')[0];
      if (originHost !== expectedHost) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Cross-origin logout request rejected.' },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Malformed origin header.' },
        { status: 403 }
      );
    }
  } else {
    const referer = request.headers.get('referer');
    if (referer) {
      try {
        const refererHost = new URL(referer).host.split(':')[0];
        const expectedHost = host?.split(':')[0];
        if (refererHost !== expectedHost) {
          return NextResponse.json(
            { success: false, error: 'Forbidden: Cross-origin logout request rejected.' },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Malformed referer header.' },
          { status: 403 }
        );
      }
    }
  }

  let scope: 'local' | 'global' = 'local';

  try {
    const body = await request.json();
    if (body?.scope === 'global') {
      scope = 'global';
    }
  } catch {
    // If request has no JSON body, proceed with default local scope
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope });

  if (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to log out.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, scope });
}
