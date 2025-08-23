import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBAdapter } from '@/lib/dynamodb-adapter';
import crypto from 'crypto';

const adapter = DynamoDBAdapter();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ message: 'Token is required.' }, { status: 400 });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await adapter.getUserByPasswordResetToken(hashedToken);

    if (!user || !user.passwordResetExpires) {
      return NextResponse.json({ message: 'Invalid token.' }, { status: 400 });
    }

    if (new Date(user.passwordResetExpires) < new Date()) {
      return NextResponse.json({ message: 'Token has expired.' }, { status: 400 });
    }

    return NextResponse.json({ message: 'Token is valid.' });

  } catch (error) {
    console.error('Error in verify-reset-token:', error);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
} 
