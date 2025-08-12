import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBAdapter } from '@/lib/dynamodb-adapter';
import crypto from 'crypto';
import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';

if (!resendApiKey) {
  console.error('RESEND_API_KEY is not set. Email functionality will be disabled.');
}

const resend = resendApiKey ? new Resend(resendApiKey) : null;
const adapter = DynamoDBAdapter();

export async function POST(req: NextRequest) {
  if (!resend) {
    return NextResponse.json({ message: 'Email service is not configured.' }, { status: 503 });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ message: 'Email is required.' }, { status: 400 });
    }

    if (!adapter.getUserByEmail || !adapter.updateUser) {
        throw new Error('Adapter methods are not defined');
    }

    const user = await adapter.getUserByEmail(email);

    // Always return a success-like message to prevent user enumeration.
    if (!user || !user.id) {
      console.log(`Password reset requested for non-existent user: ${email}`);
      return NextResponse.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const passwordResetExpires = new Date(Date.now() + 3600000); // 1 hour from now

    await adapter.updateUser({
      id: user.id,
      passwordResetToken,
      passwordResetExpires,
    } as any);

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`;
    
    const emailHtml = `
      <h1>You requested a password reset</h1>
      <p>Click the link below to reset your password. This link is valid for 1 hour.</p>
      <a href="${resetUrl}" target="_blank" rel="noopener noreferrer">Reset Password</a>
      <p>If you did not request a password reset, please ignore this email.</p>
      <hr>
      <p><em>This is an automated message from KeyCraft.</em></p>
    `;

    await resend.emails.send({
      from: fromEmail,
      to: [user.email],
      subject: 'KeyCraft Password Reset Request',
      html: emailHtml,
    });

    return NextResponse.json({ message: 'If an account with that email exists, a password reset link has been sent.' });

  } catch (error) {
    console.error('Error in send-password-reset:', error);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
} 