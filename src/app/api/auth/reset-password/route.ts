import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBAdapter } from '@/lib/dynamodb-adapter';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const adapter = DynamoDBAdapter();

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ message: 'Token and password are required.' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ message: 'Password must be at least 8 characters long.' }, { status: 400 });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await adapter.getUserByPasswordResetToken(hashedToken);

    if (!user || !user.id || !user.passwordResetExpires) {
      return NextResponse.json({ message: 'Invalid or expired token.' }, { status: 400 });
    }

    if (new Date(user.passwordResetExpires) < new Date()) {
      return NextResponse.json({ message: 'Token has expired.' }, { status: 400 });
    }

    if (!adapter.updateUser) {
        throw new Error('Adapter method is not defined');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await adapter.updateUser({
      id: user.id,
      hashedPassword: hashedPassword,
      passwordResetToken: null,
      passwordResetExpires: null,
      status: user.status === 'pending_verification' ? 'active' : user.status,
      emailVerified: user.emailVerified || new Date(),
    } as any);

    return NextResponse.json({ message: 'Password has been reset successfully. You will be redirected to sign in.' });

  } catch (error) {
    console.error('Error in reset-password:', error);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
} 