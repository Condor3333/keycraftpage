import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBAdapter, CustomAdapterUser } from '@/lib/dynamodb-adapter';
import { auth } from '@/../auth';

const TRANSCRIPTION_LIMIT = 10;

function getCurrentMonthString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized - No session' }, { status: 401 });
    }
    const userId = session.user.id;
    const adapter = DynamoDBAdapter();
    const user = await (adapter.getUser!(userId)) as CustomAdapterUser;
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }
    const currentMonth = getCurrentMonthString();
    let transcriptionCount = user.transcriptionCount ?? 0;
    let transcriptionMonth = user.transcriptionMonth ?? currentMonth;
    if (transcriptionMonth !== currentMonth) {
      transcriptionCount = 0;
    }
    return NextResponse.json({
      remaining: Math.max(0, TRANSCRIPTION_LIMIT - transcriptionCount),
      limit: TRANSCRIPTION_LIMIT
    });
  } catch (error) {
    return NextResponse.json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
} 