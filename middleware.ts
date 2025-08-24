import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// --- START Rate Limiting Initialization ---
let redisClient: Redis | null = null;
let saveRateLimiter: Ratelimit | null = null;
let loadRateLimiter: Ratelimit | null = null;
let contactRateLimiter: Ratelimit | null = null;
let signInRateLimiter: Ratelimit | null = null; // Added for sign-in attempts
let registerRateLimiter: Ratelimit | null = null; // Added for registration attempts
let videoToMidiRateLimiter: Ratelimit | null = null; // Added for video-to-midi operations
let authRateLimiter: Ratelimit | null = null; // Added for auth operations
let midiDownloadRateLimiter: Ratelimit | null = null; // Added for MIDI downloads
let projectDeleteRateLimiter: Ratelimit | null = null; // Added for project deletion
let stripeRateLimiter: Ratelimit | null = null; // Added for Stripe operations

// Rate limiting setup
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (redisUrl && redisToken) {
  try {
    redisClient = Redis.fromEnv();

    // Save Project Rate Limiter
    saveRateLimiter = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(5, '60 s'), 
      analytics: true,
      prefix: 'keycraft_ratelimit_project_save',
    });


    // Load Projects Rate Limiter
    loadRateLimiter = new Ratelimit({ 
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(15, '60 s'), 
      analytics: true,
      prefix: 'keycraft_ratelimit_project_load',
    });


    // Contact Form Rate Limiter
    contactRateLimiter = new Ratelimit({ 
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(5, '60 m'), 
      analytics: true,
      prefix: 'keycraft_ratelimit_contact_form',
    });


    // Sign-in Rate Limiter
    signInRateLimiter = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(15, '15 m'), // 15 attempts per 15 minutes
      analytics: true,
      prefix: 'keycraft_ratelimit_signin',
    });


    // Register Rate Limiter
    registerRateLimiter = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(10, '60 m'), // 10 attempts per 60 minutes
      analytics: true,
      prefix: 'keycraft_ratelimit_register',
    });

    // Video-to-MIDI Rate Limiter (resource-intensive operations)
    videoToMidiRateLimiter = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(10, '60 m'), // 10 transcriptions per hour
      analytics: true,
      prefix: 'keycraft_ratelimit_video_to_midi',
    });

    // Auth Operations Rate Limiter (password reset, verification, etc.)
    authRateLimiter = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(10, '60 m'), // 10 auth operations per hour
      analytics: true,
      prefix: 'keycraft_ratelimit_auth_ops',
    });

    // MIDI Download Rate Limiter
    midiDownloadRateLimiter = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(50, '60 m'), // 50 downloads per hour
      analytics: true,
      prefix: 'keycraft_ratelimit_midi_download',
    });

    // Project Delete Rate Limiter
    projectDeleteRateLimiter = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(20, '60 m'), // 20 deletions per hour
      analytics: true,
      prefix: 'keycraft_ratelimit_project_delete',
    });

    // Stripe Operations Rate Limiter
    stripeRateLimiter = new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(5, '60 m'), // 5 checkout sessions per hour
      analytics: true,
      prefix: 'keycraft_ratelimit_stripe',
    });


  } catch (error) {
    // Redis initialization failed - rate limiting disabled
    redisClient = null;
    saveRateLimiter = null;
    loadRateLimiter = null;
    contactRateLimiter = null;
    signInRateLimiter = null;
    registerRateLimiter = null;
    videoToMidiRateLimiter = null;
    authRateLimiter = null;
    midiDownloadRateLimiter = null;
    projectDeleteRateLimiter = null;
    stripeRateLimiter = null;
  }
} else {
  // Redis environment variables not set - rate limiting disabled
  redisClient = null;
  saveRateLimiter = null;
  loadRateLimiter = null;
  contactRateLimiter = null;
  signInRateLimiter = null;
  registerRateLimiter = null;
  videoToMidiRateLimiter = null;
  authRateLimiter = null;
  midiDownloadRateLimiter = null;
  projectDeleteRateLimiter = null;
  stripeRateLimiter = null;
}
// --- END Rate Limiting Initialization ---

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [
      process.env.NEXT_PUBLIC_MAIN_SITE_URL || 'https://www.keycraft.org',
      process.env.NEXT_PUBLIC_APP_EDITOR_URL || 'https://app.keycraft.org'
    ]
  : [
      process.env.NEXT_PUBLIC_MAIN_SITE_URL || 'http://keycraft.org:3000',
      process.env.NEXT_PUBLIC_APP_EDITOR_URL || 'http://app.keycraft.org:3001'
    ];

// Helper function to add CORS headers to any response
const addCorsHeaders = (response: NextResponse, origin: string | null) => {
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  response.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  return response;
};

export async function middleware(req: NextRequest) {
  const origin = req.headers.get('origin');
  const { pathname } = req.nextUrl;

  // Block access to the tutorial page and redirect to the homepage
  if (req.nextUrl.pathname.startsWith('/tutorial')) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Handle OPTIONS preflight requests first
  if (req.method === 'OPTIONS') {
    const response = new Response(null, { status: 204 });
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    }
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    response.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    return response;
  }

  // Helper for Rate Limit Response
  const rateLimitResponse = (limit: number, remaining: number, reset: number, endpointName: string) => {
    // Rate limit exceeded
    
    const message = `Too many ${endpointName} attempts. Please try again later.`;
    const allowOrigin = process.env.NODE_ENV === 'production' ? 'https://keycraft.org' : (origin || 'http://keycraft.org:3000');

    if (endpointName === 'sign-in') {
      return new NextResponse(JSON.stringify({ error: "RateLimit", message: message }), {
        status: 429,
        headers: {
          'Access-Control-Allow-Origin': allowOrigin,
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Expose-Headers': 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset',
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': new Date(reset).toISOString(), 
        },
      });
    }

    // Default to plain text for other endpoints
    return new NextResponse(message, {
      status: 429,
      headers: {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Expose-Headers': 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset',
        'Content-Type': 'text/plain',
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': new Date(reset).toISOString(), 
      },
    });
  };

  // Rate Limiting Logic
  const applyRateLimiter = async (limiter: Ratelimit | null, endpointName: string) => {
    if (!limiter || !redisClient) return null;
    const forwardedFor = req.headers.get('x-forwarded-for');
    const clientIp = (req as any).ip;
    const identifier = forwardedFor ? forwardedFor.split(',')[0].trim() : clientIp || '127.0.0.1';
    try {
      const { success, limit, remaining, reset } = await limiter.limit(identifier);
      if (!success) return rateLimitResponse(limit, remaining, reset, endpointName);
    } catch (error) {
      // Rate limiting error - allowing request
    }
    return null;
  };

  if (req.method === 'POST') {
    if (pathname.startsWith('/api/projects/save')) {
      const response = await applyRateLimiter(saveRateLimiter, 'project save');
      if (response) return response;
    }
    if (pathname.startsWith('/api/notation/convert')) {
      const response = await applyRateLimiter(saveRateLimiter, 'notation convert');
      if (response) return response;
    }
    if (pathname.startsWith('/api/send-contact-email')) {
      const response = await applyRateLimiter(contactRateLimiter, 'contact form');
      if (response) return response;
    }
    if (pathname.startsWith('/api/register')) {
      const response = await applyRateLimiter(registerRateLimiter, 'registration');
      if (response) return response;
    }
    if (pathname.startsWith('/api/auth/callback/credentials')) {
      const response = await applyRateLimiter(signInRateLimiter, 'sign-in');
      if (response) return response;
    }
    // Video-to-MIDI operations
    if (pathname.startsWith('/api/video-to-midi/upload')) {
      const response = await applyRateLimiter(videoToMidiRateLimiter, 'video-to-midi upload');
      if (response) return response;
    }
    // Auth operations
    if (pathname.startsWith('/api/auth/reset-password')) {
      const response = await applyRateLimiter(authRateLimiter, 'password reset');
      if (response) return response;
    }
    if (pathname.startsWith('/api/auth/send-password-reset')) {
      const response = await applyRateLimiter(authRateLimiter, 'password reset request');
      if (response) return response;
    }
    if (pathname.startsWith('/api/auth/resend-verification')) {
      const response = await applyRateLimiter(authRateLimiter, 'verification resend');
      if (response) return response;
    }
    // Stripe operations
    if (pathname.startsWith('/api/stripe/create-checkout-session')) {
      const response = await applyRateLimiter(stripeRateLimiter, 'stripe checkout');
      if (response) return response;
    }
  }

  if (req.method === 'GET') {
    if (pathname.startsWith('/api/projects/load')) {
      const response = await applyRateLimiter(loadRateLimiter, 'project load');
      if (response) return response;
    }
    // Video-to-MIDI operations
    if (pathname.startsWith('/api/video-to-midi/quota')) {
      const response = await applyRateLimiter(videoToMidiRateLimiter, 'video-to-midi quota');
      if (response) return response;
    }
    if (pathname.startsWith('/api/video-to-midi/status/')) {
      const response = await applyRateLimiter(videoToMidiRateLimiter, 'video-to-midi status');
      if (response) return response;
    }
    // Auth operations
    if (pathname.startsWith('/api/auth/verify-reset-token')) {
      const response = await applyRateLimiter(authRateLimiter, 'reset token verification');
      if (response) return response;
    }
    if (pathname.startsWith('/api/auth/verify-email')) {
      const response = await applyRateLimiter(authRateLimiter, 'email verification');
      if (response) return response;
    }
    if (pathname.startsWith('/api/auth/session-bridge')) {
      const response = await applyRateLimiter(authRateLimiter, 'session bridge');
      if (response) return response;
    }
    // MIDI downloads
    if (pathname.startsWith('/api/midi-library/download')) {
      const response = await applyRateLimiter(midiDownloadRateLimiter, 'midi download');
      if (response) return response;
    }
  }

  if (req.method === 'DELETE') {
    if (pathname.startsWith('/api/projects/delete/')) {
      const response = await applyRateLimiter(projectDeleteRateLimiter, 'project deletion');
      if (response) return response;
    }
  }
  
  // --- START Original Auth Logic and Path Protection (simplified for brevity, keep your existing logic here) ---
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    // AUTH_SECRET configuration error
    return new NextResponse('Server configuration error.', { status: 500 });
  }

  const sessionCookieName = process.env.NODE_ENV === 'production' 
    ? '__Secure-next-auth.session-token' 
    : 'next-auth.session-token';

  const token = await getToken({ 
    req, 
    secret,
    cookieName: sessionCookieName
  });

  const requestHeaders = new Headers(req.headers); // For logging
  requestHeaders.set('x-pathname', pathname);
  // console.log(`MIDDLEWARE: Request for ${pathname}. Token: ${token ? JSON.stringify(token) : 'No token'}`);

  // Paths accessible to everyone, regardless of auth state
  const universallyPublicPaths = [
    '/', // Homepage
    '/signin',
    '/register',
    '/api/auth/', // NextAuth.js API routes
    '/api/register', // Public endpoint for creating new users
    '/api/webhooks',
    '/auth/error',
    // Add other truly public pages like /pricing, /terms, /contact
  ];

  // Paths accessible if logged in but email not yet verified
  const pendingVerificationAllowedPaths = [
    '/auth/verify-notice', // Page telling user to check email
    '/api/auth/session', // Needed for AuthContext in CRA to check session
    '/api/auth/signout', // Allow signout
  ];
  
  const isUniversallyPublicPath = universallyPublicPaths.some(p => {
    if (p === '/') {
        return pathname === '/'; // Exact match for root
    }
    if (p.endsWith('/')) {
        return pathname.startsWith(p); // Prefix match for directories like /api/auth/
    }
    // Exact match for other files like /signin
    return pathname === p;
  });

  if (isUniversallyPublicPath) {
    // If user is on /signin or /register but IS fully authenticated and verified, redirect to dashboard
    if ((pathname === '/signin' || pathname === '/register') && token && token.emailVerified && token.status === 'active') {
      // Redirecting authenticated user to dashboard
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    // 
    return addCorsHeaders(NextResponse.next(), origin);
  }

  // Allow access to Next.js internals and static assets
  if (pathname.startsWith('/_next/') || pathname.startsWith('/static/') || pathname.includes('.')) {
    // 
    return NextResponse.next();
  }
  
  // At this point, the path requires some level of authentication

  if (!token) {
    // 
    const signInUrl = new URL('/signin', req.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // User has a token. Now check email verification and status.
  const isPendingVerificationAllowedPath = pendingVerificationAllowedPaths.some(p => 
    pathname === p || pathname.startsWith(p + '/')
  );

  if (!token.emailVerified || token.status !== 'active') {
    if (isPendingVerificationAllowedPath) {
      // 
      return addCorsHeaders(NextResponse.next(), origin);
    }
    // console.log(`MIDDLEWARE: Token exists but not verified/active (EmailVerified: ${token.emailVerified}, Status: ${token.status}). Path ${pathname} requires verification. Redirecting to /auth/verify-notice.`);
    // Redirect to a page asking them to verify their email
    // Add a query param to indicate it came from middleware to avoid loops if verify-notice itself is protected badly
    const verifyUrl = new URL('/auth/verify-notice', req.url);
    if (!req.nextUrl.searchParams.has('fromMiddleware')) { // Basic loop prevention
        verifyUrl.searchParams.set('fromMiddleware', 'true');
        verifyUrl.searchParams.set('email', token.email as string || '');
    }
    return NextResponse.redirect(verifyUrl);
  }

  // If token exists, email is verified, and status is active, allow access.
  // 
  return addCorsHeaders(NextResponse.next(), origin);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}; 
