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
