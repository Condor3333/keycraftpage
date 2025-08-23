import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/../auth';
import { s3, S3_MIDI_LIBRARY_BUCKET } from '@/lib/aws-config';
import { z } from 'zod';

// Zod validation schemas
const MidiDownloadQuerySchema = z.object({
  file: z.string().min(1, "File path is required").max(500, "File path too long")
});

const UserSessionSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  hasPaid: z.boolean(),
  activePlans: z.array(z.string()).optional(),
});

// Define tier limits
const TIER_LIMITS = {
  free: 0,      // Free users: no MIDI library access
  tier1: 50,    // Tier 1: 50 downloads/month
  tier2: 200,   // Tier 2: 200 downloads/month
  premium: -1,  // Premium: unlimited
};

// Track user downloads (in production, use Redis or database)
const userDownloads = new Map<string, { count: number; resetDate: Date }>();

export async function GET(request: NextRequest) {
  try {
    // 1. Authentication validation
    const session = await auth();
    
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Validate user session with Zod
    const userValidation = UserSessionSchema.safeParse({
      userId: session.user.id,
      hasPaid: session.user.hasPaid === true,
      activePlans: session.user.activePlans,
    });

    if (!userValidation.success) {
      return NextResponse.json({ 
        error: "Invalid user session", 
        details: userValidation.error.errors 
      }, { status: 400 });
    }

    const { userId } = userValidation.data;
    const userTier = getUserTier(session.user);
    
    // 3. Validate query parameters with Zod
    const filePath = request.nextUrl.searchParams.get('file');
    const queryValidation = MidiDownloadQuerySchema.safeParse({ file: filePath });

    if (!queryValidation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryValidation.error.errors },
        { status: 400 }
      );
    }

    const validatedFilePath = queryValidation.data.file;

    // 4. Sanitize and validate file path
    const sanitizedPath = sanitizeFilePath(validatedFilePath);
    if (!sanitizedPath) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 400 }
      );
    }
    
    try {
      // Generate pre-signed URL using the same pattern as working project routes
      const presignedUrl = await s3.getSignedUrlPromise('getObject', {
        Bucket: S3_MIDI_LIBRARY_BUCKET,
        Key: sanitizedPath,
        Expires: 3600 // 1 hour
      });

      return NextResponse.json({
        downloadUrl: presignedUrl,
        expiresIn: 3600,
        remainingDownloads: 'unlimited'
      });
      
    } catch (s3Error: any) {
      if (s3Error.code === 'NoSuchKey') {
        return NextResponse.json(
          { error: 'MIDI file not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to access MIDI file' },
        { status: 500 }
      );
    }



  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper functions
function getUserTier(user: any): 'free' | 'tier1' | 'tier2' | 'premium' {
  if (!user.hasPaid) return 'free';
  if (user.activePlans?.includes('tier2')) return 'tier2';
  if (user.activePlans?.includes('tier1')) return 'tier1';
  return 'free';
}

function sanitizeFilePath(filePath: string): string | null {
  // Remove any path traversal attempts
  const cleanPath = filePath.replace(/\.\./g, '').replace(/\/\//g, '/');
  
  // Only allow .mid files
  if (!cleanPath.endsWith('.mid')) {
    return null;
  }
  
  // Remove leading slash if present
  return cleanPath.startsWith('/') ? cleanPath.slice(1) : cleanPath;
}

function getUserDownloadCount(userId: string): number {
  const userData = userDownloads.get(userId);
  if (!userData) return 0;
  
  // Reset count if it's a new month
  const now = new Date();
  if (now.getMonth() !== userData.resetDate.getMonth() || now.getFullYear() !== userData.resetDate.getFullYear()) {
    userDownloads.delete(userId);
    return 0;
  }
  
  return userData.count;
}

function incrementUserDownloadCount(userId: string): void {
  const currentCount = getUserDownloadCount(userId);
  userDownloads.set(userId, {
    count: currentCount + 1,
    resetDate: new Date(),
  });
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}
