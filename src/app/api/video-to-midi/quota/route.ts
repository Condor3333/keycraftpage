import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBAdapter, CustomAdapterUser } from '@/lib/dynamodb-adapter';
import { auth } from '@/../auth';
import { z } from 'zod';

// Validation schema for user session
const UserSessionSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  hasPaid: z.boolean(),
  activePlans: z.array(z.string()).optional(),
});

// MODIFIED: Tier-based transcription limits
const getTranscriptionLimit = (hasPaid: boolean, activePlans?: string[]) => {
  if (!hasPaid) return 0; // Free tier: no transcriptions
  if (activePlans?.includes('tier1')) return 5; // Tier 1: 5 transcriptions/month
  if (activePlans?.includes('tier2')) return 20; // Tier 2: 20 transcriptions/month
  return 0; // Default to no access if no plans found
};

function getCurrentMonthString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export async function GET(req: NextRequest) {
  try {
    // 1. Authentication validation
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized - No session' }, { status: 401 });
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

    const { userId, hasPaid, activePlans } = userValidation.data;
    
    // 3. Check tier-based access
    const transcriptionLimit = getTranscriptionLimit(hasPaid, activePlans);
    
    if (transcriptionLimit === 0) {
      return NextResponse.json({ 
        code: 'PAYMENT_REQUIRED', 
        message: 'AI Transcription is a premium feature. Please upgrade your account to use this feature.' 
      }, { status: 403 });
    }
    
    // 4. Get user data from database
    const adapter = DynamoDBAdapter();
    const user = await (adapter.getUser!(userId)) as CustomAdapterUser;
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // 5. Calculate quota
    const currentMonth = getCurrentMonthString();
    let transcriptionCount = user.transcriptionCount ?? 0;
    let transcriptionMonth = user.transcriptionMonth ?? currentMonth;
    
    if (transcriptionMonth !== currentMonth) {
      transcriptionCount = 0;
    }

    const remaining = Math.max(0, transcriptionLimit - transcriptionCount);

    return NextResponse.json({
      remaining,
      limit: transcriptionLimit,
      used: transcriptionCount,
      currentMonth,
      tier: hasPaid ? (activePlans?.includes('tier2') ? 'tier2' : 'tier1') : 'free'
    });

  } catch (error) {
    console.error('Quota check error:', error);
    return NextResponse.json({ 
      message: 'Server error', 
      error: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
} 
