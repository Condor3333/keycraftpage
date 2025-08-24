import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/../../auth';
import { dynamoDb, DYNAMODB_USERS_TABLE } from '@/lib/aws-config';
import { DynamoDBAdapter } from '@/lib/dynamodb-adapter';
import { z } from 'zod';

// Zod validation schemas
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
    
    // Debug logging
    console.log('User quota check:', {
      userId,
      hasPaid: (session.user as any).hasPaid,
      activePlans: (session.user as any).activePlans,
      userTier,
      sessionUser: session.user
    });
    
    // 3. Get user's current download data
    const userParams = {
      TableName: DYNAMODB_USERS_TABLE,
      Key: { id: userId }
    };

    const userResult = await dynamoDb.get(userParams).promise();
    const user = userResult.Item;

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // 4. Check and potentially reset monthly quota
    // Initialize midiDownloads if it doesn't exist
    const currentMidiDownloads = user.midiDownloads || {
      count: 0,
      resetDate: new Date().toISOString(),
      lastDownloadDate: new Date().toISOString(),
      totalDownloads: 0
    };

    const updatedMidiDownloads = checkAndResetMonthly(currentMidiDownloads);
    
    // 5. Get download limit for user's tier
    const downloadLimit = DOWNLOAD_LIMITS[userTier];
    const remainingDownloads = downloadLimit === -1 ? -1 : Math.max(0, downloadLimit - updatedMidiDownloads.count);

    // 6. Calculate next reset date
    const nextResetDate = getNextResetDate(updatedMidiDownloads.resetDate);

    // 7. If midiDownloads was missing, update the user record
    if (!user.midiDownloads) {
      try {
        const adapter = DynamoDBAdapter();
        await adapter.initializeMidiDownloads(userId);
        console.log('Initialized midiDownloads for user:', userId);
      } catch (updateError) {
        console.error('Error initializing midiDownloads:', updateError);
        // Continue without failing the request
      }
    }

    return NextResponse.json({
      remaining: remainingDownloads,
      limit: downloadLimit,
      used: updatedMidiDownloads.count,
      totalDownloads: updatedMidiDownloads.totalDownloads,
      resetDate: nextResetDate,
      tier: userTier,
      canDownload: downloadLimit === -1 || remainingDownloads > 0
    });

  } catch (error) {
    console.error('Error checking MIDI quota:', error);
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

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}
