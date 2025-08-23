import { NextResponse } from 'next/server';
import { dynamoDb, DYNAMODB_USERS_TABLE } from '@/lib/aws-config';
import { Resend } from 'resend';
import WelcomeEmail from '@/emails/WelcomeEmail';
import crypto from 'crypto';
import { z } from 'zod';
import AWS from 'aws-sdk';

// Zod schema for the request body
const ResendRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
});

// Define the structure of a User item in DynamoDB
interface UserDynamoDBItem {
  id: string;
  firstName: string;
  email: string;
  status: 'pending_verification' | 'active' | 'suspended';
  emailVerificationToken?: string | null;
  emailVerificationTokenExpires?: string | null;
}

export async function POST(req: Request) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const body = await req.json();

    // Validate the request body
    const validationResult = ResendRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ message: 'Invalid email provided.' }, { status: 400 });
    }

    const { email } = validationResult.data;

    // Find the user by email using the GSI
    const queryParams: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: DYNAMODB_USERS_TABLE,
      IndexName: 'Email-Index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': email.toLowerCase() },
    };

    const queryResult = await dynamoDb.query(queryParams).promise();

    if (!queryResult.Items || queryResult.Items.length === 0) {
      return NextResponse.json({ message: 'User with this email not found.' }, { status: 404 });
    }

    const user = queryResult.Items[0] as UserDynamoDBItem;

    // Check if user is already active
    if (user.status === 'active') {
      return NextResponse.json({ message: 'This account has already been verified.' }, { status: 400 });
    }
    
    // Check if user is not in a pending state
    if (user.status !== 'pending_verification') {
        return NextResponse.json({ message: `Cannot resend verification for an account with status: ${user.status}.`}, { status: 400 });
    }


    // Generate a new token and expiration date (24 hours from now)
    const newVerificationToken = crypto.randomBytes(32).toString('hex');
    const newExpirationDate = new Date();
    newExpirationDate.setHours(newExpirationDate.getHours() + 24);

    // Update the user in DynamoDB with the new token and expiration
    const updateParams: AWS.DynamoDB.DocumentClient.UpdateItemInput = {
      TableName: DYNAMODB_USERS_TABLE,
      Key: { id: user.id }, // Use the primary key `id` to update
      UpdateExpression: 'SET emailVerificationToken = :token, emailVerificationTokenExpires = :expires, dateModified = :modified',
      ExpressionAttributeValues: {
        ':token': newVerificationToken,
        ':expires': newExpirationDate.toISOString(),
        ':modified': new Date().toISOString(),
      },
      ReturnValues: 'NONE',
    };

    await dynamoDb.update(updateParams).promise();

    // Send the new verification email
    if (process.env.RESEND_API_KEY && process.env.FROM_EMAIL && process.env.NEXT_PUBLIC_APP_URL) {
      const activationLink = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/verify-email?token=${newVerificationToken}`;
      await resend.emails.send({
        from: process.env.FROM_EMAIL,
        to: [user.email],
        subject: 'Complete Your Keycraft Registration (New Link)',
        react: WelcomeEmail({
          userName: user.firstName,
          activationLink,
        }),
      });
      
    } else {
      console.warn('Resend API: Environment variables for sending email are not fully configured.');
    }

    return NextResponse.json({ message: 'A new verification email has been sent to your address.' }, { status: 200 });

  } catch (error) {
    console.error('Resend Verification API Error:', error);
    return NextResponse.json({ message: 'An internal server error occurred.' }, { status: 500 });
  }
} 
