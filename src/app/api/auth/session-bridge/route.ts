import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { z } from 'zod';

const DEFAULT_APP_ORIGIN = process.env.NEXT_PUBLIC_APP_EDITOR_URL || 'http://app.keycraft.org:3001';
const ALLOWED_ORIGINS = new Set<string>([
  DEFAULT_APP_ORIGIN,
  process.env.NEXT_PUBLIC_APP_ORIGIN || DEFAULT_APP_ORIGIN,
]);

// Zod schema for origin validation
const OriginSchema = z.string().url().refine((origin) => {
  return ALLOWED_ORIGINS.has(origin);
}, {
  message: "Origin not allowed"
}).optional();

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
    // Validate origin header
    const origin = req.headers.get('origin');
    const originValidation = OriginSchema.safeParse(origin);
    
    if (origin && !originValidation.success) {
      const res = NextResponse.json({ 
        error: 'Invalid origin', 
        details: originValidation.error.errors 
      }, { status: 403 });
      return withCors(res, null);
    }

    const session = await auth();
    if (!session || !session.user) {
      const res = NextResponse.json({ error: 'No session found' }, { status: 401 });
      return withCors(res, origin);
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
    return withCors(res, origin);
  } catch (error) {
    console.error('Session bridge error:', error);
    const res = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    return withCors(res, origin);
  }
}

export async function OPTIONS(req: NextRequest) {
  const res = new NextResponse(null, { status: 200 });
  return withCors(res, req.headers.get('origin'));
}
