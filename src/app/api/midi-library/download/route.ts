import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/../../auth';
import { s3, S3_MIDI_LIBRARY_BUCKET, dynamoDb, DYNAMODB_USERS_TABLE } from '@/lib/aws-config';
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

// Download limits by tier
const DOWNLOAD_LIMITS = {
  free: 0,
  tier1: 10,
  tier2: -1  // -1 means unlimited
} as const;

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
      hasPaid: (session.user as any).hasPaid === true,
      activePlans: (session.user as any).activePlans,
    });

    if (!userValidation.success) {
      return NextResponse.json({ 
        error: "Invalid user session", 
        details: userValidation.error.errors 
      }, { status: 400 });
    }

    const { userId } = userValidation.data;
    const userTier = getUserTier(session.user as any);
    
    // 3. Check download quota before proceeding
    const quotaCheck = await checkDownloadQuota(userId, userTier);
    if (!quotaCheck.canDownload) {
      return NextResponse.json({
        error: 'Download quota exceeded',
        remaining: quotaCheck.remaining,
        limit: quotaCheck.limit,
        resetDate: quotaCheck.resetDate,
        tier: userTier
      }, { status: 429 });
    }

    // 4. Validate query parameters with Zod
    const filePath = request.nextUrl.searchParams.get('file');
    const queryValidation = MidiDownloadQuerySchema.safeParse({ file: filePath });

    if (!queryValidation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryValidation.error.errors },
        { status: 400 }
      );
    }

    const validatedFilePath = queryValidation.data.file;

    // 5. Sanitize and validate file path
    const sanitizedPath = sanitizeFilePath(validatedFilePath);
    if (!sanitizedPath) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 400 }
      );
    }
    
    try {
      // 6. Generate pre-signed URL
      const presignedUrl = await s3.getSignedUrlPromise('getObject', {
        Bucket: S3_MIDI_LIBRARY_BUCKET,
        Key: sanitizedPath,
        Expires: 3600 // 1 hour
      });

      // 7. Update download count (atomic operation)
      await incrementDownloadCount(userId);

      // 8. Get updated quota info for response
      const updatedQuota = await checkDownloadQuota(userId, userTier);

      return NextResponse.json({
        downloadUrl: presignedUrl,
        expiresIn: 3600,
        remainingDownloads: updatedQuota.remaining,
        limit: updatedQuota.limit,
        tier: userTier
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
    console.error('Error in MIDI download:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper functions
function getUserTier(user: any): 'free' | 'tier1' | 'tier2' {
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

async function checkDownloadQuota(userId: string, userTier: 'free' | 'tier1' | 'tier2') {
  const userParams = {
    TableName: DYNAMODB_USERS_TABLE,
    Key: { id: userId }
  };

  const userResult = await dynamoDb.get(userParams).promise();
  const user = userResult.Item;

  if (!user) {
    throw new Error('User not found');
  }

  const currentMidiDownloads = user.midiDownloads || {
    count: 0,
    resetDate: new Date().toISOString(),
    lastDownloadDate: new Date().toISOString(),
    totalDownloads: 0
  };

  const updatedMidiDownloads = checkAndResetMonthly(currentMidiDownloads);
  const downloadLimit = DOWNLOAD_LIMITS[userTier];
  const remainingDownloads = downloadLimit === -1 ? -1 : Math.max(0, downloadLimit - updatedMidiDownloads.count);

  return {
    remaining: remainingDownloads,
    limit: downloadLimit,
    used: updatedMidiDownloads.count,
    canDownload: downloadLimit === -1 || remainingDownloads > 0,
    resetDate: getNextResetDate(updatedMidiDownloads.resetDate)
  };
}

function checkAndResetMonthly(midiDownloads: any) {
  const currentDate = new Date();
  const resetDate = new Date(midiDownloads.resetDate);
  
  // Check if we're in a new month
  if (currentDate.getFullYear() > resetDate.getFullYear() || 
      currentDate.getMonth() > resetDate.getMonth()) {
    return {
      count: 0,
      resetDate: currentDate.toISOString(),
      lastDownloadDate: midiDownloads.lastDownloadDate,
      totalDownloads: midiDownloads.totalDownloads
    };
  }
  
  return midiDownloads;
}

function getNextResetDate(currentResetDate: string): string {
  const resetDate = new Date(currentResetDate);
  const nextMonth = new Date(resetDate.getFullYear(), resetDate.getMonth() + 1, 1);
  return nextMonth.toISOString();
}

async function incrementDownloadCount(userId: string) {
  const currentDate = new Date().toISOString();
  
  const updateParams = {
    TableName: DYNAMODB_USERS_TABLE,
    Key: { id: userId },
    UpdateExpression: `
      SET midiDownloads.#count = if_not_exists(midiDownloads.#count, :zero) + :increment,
          midiDownloads.lastDownloadDate = :currentDate,
          midiDownloads.totalDownloads = if_not_exists(midiDownloads.totalDownloads, :zero) + :increment,
          midiDownloads.resetDate = if_not_exists(midiDownloads.resetDate, :currentDate),
          dateModified = :currentDate
    `,
    ExpressionAttributeNames: {
      '#count': 'count'
    },
    ExpressionAttributeValues: {
      ':increment': 1,
      ':zero': 0,
      ':currentDate': currentDate
    },
    ReturnValues: 'ALL_NEW'
  };

  try {
    await dynamoDb.update(updateParams).promise();
  } catch (error) {
    console.error('Error incrementing download count:', error);
    throw error;
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}
