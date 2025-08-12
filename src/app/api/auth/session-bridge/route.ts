import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../../auth';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'No session found' }, { status: 401 });
    }

    // Return the session data in a format the app can use
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

    const response = NextResponse.json(sessionData);
    
    // Set CORS headers for the IP address
    response.headers.set('Access-Control-Allow-Origin', 'http://192.168.2.19:3001');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

    return response;
  } catch (error) {
    console.error('Session bridge error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function OPTIONS(req: NextRequest) {
  const response = new NextResponse(null, { status: 200 });
  response.headers.set('Access-Control-Allow-Origin', 'http://192.168.2.19:3001');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}
