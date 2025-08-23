import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../../auth';

const DEFAULT_APP_ORIGIN = process.env.NEXT_PUBLIC_APP_EDITOR_URL || 'http://app.keycraft.org:3001';
const ALLOWED_ORIGINS = new Set<string>([
  DEFAULT_APP_ORIGIN,
  process.env.NEXT_PUBLIC_APP_ORIGIN || DEFAULT_APP_ORIGIN,
]);

function withCors(response: NextResponse, origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : (process.env.NEXT_PUBLIC_APP_ORIGIN || DEFAULT_APP_ORIGIN);
  response.headers.set('Access-Control-Allow-Origin', allowed);
  response.headers.set('Vary', 'Origin');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      const res = NextResponse.json({ error: 'No session found' }, { status: 401 });
      return withCors(res, req.headers.get('origin'));
    }

    const sessionData = {
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        firstName: (session.user as any).firstName,
        lastName: (session.user as any).lastName,
        hasPaid: (session.user as any).hasPaid,
        activePlans: (session.user as any).activePlans,
        status: (session.user as any).status,
        emailVerified: (session.user as any).emailVerified,
      }
    };

    const res = NextResponse.json(sessionData);
    return withCors(res, req.headers.get('origin'));
  } catch (error) {
    console.error('Session bridge error:', error);
    const res = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    return withCors(res, req.headers.get('origin'));
  }
}

export async function OPTIONS(req: NextRequest) {
  const res = new NextResponse(null, { status: 200 });
  return withCors(res, req.headers.get('origin'));
}
