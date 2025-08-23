import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBAdapter } from '@/lib/dynamodb-adapter'; 
import { UserStatus } from '@/models/User';
import { z } from 'zod'; // ADDED: Import Zod
import * as AWS from 'aws-sdk';

// Zod Schema for the token
const VerifyEmailQuerySchema = z.object({
  token: z.string().length(64, "Invalid token format").regex(/^[a-f0-9]+$/, "Token must be hexadecimal")
});

// This interface should reflect the fields our adapter's getUserByEmailVerificationToken might return
// and what updateUser might accept for these specific fields.
interface CustomAdapterUserFields {
    id: string;
    email: string;
    emailVerified?: Date | string | null; 
    emailVerificationToken?: string | null;
    emailVerificationTokenExpires?: Date | string | null; 
    status?: UserStatus;
}

const adapter = DynamoDBAdapter() as any; // Cast to any to allow custom method calls
const dynamoDb = new AWS.DynamoDB.DocumentClient();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenFromQuery = searchParams.get('token');

  const validationResult = VerifyEmailQuerySchema.safeParse({ token: tokenFromQuery });

  if (!validationResult.success) {
    console.error("[Verify Email Token Validation Error]", validationResult.error.flatten().fieldErrors);
    const errorRedirectUrl = new URL('/signin', process.env.NEXT_PUBLIC_APP_URL || request.url);
    errorRedirectUrl.searchParams.set('error', 'InvalidVerificationLink');
    errorRedirectUrl.searchParams.set('message', 'The verification link is invalid or malformed.');
    return NextResponse.redirect(errorRedirectUrl.toString());
  }

  const validatedToken = validationResult.data.token;

  try {
    // Use the casted adapter
    const user = await adapter.getUserByEmailVerificationToken?.(validatedToken) as CustomAdapterUserFields | null;

    if (!user) {

      const errorRedirectUrl = new URL('/signin', process.env.NEXT_PUBLIC_APP_URL || request.url);
      errorRedirectUrl.searchParams.set('error', 'Verification');
      errorRedirectUrl.searchParams.set('email', ''); // Can't send email as we don't know it
      errorRedirectUrl.searchParams.set('message', 'This verification link is invalid or has expired.');
      return NextResponse.redirect(errorRedirectUrl.toString());
    }
    
    let isTokenExpired = false;
    if (user.emailVerificationTokenExpires) {
        const expiryDate = new Date(user.emailVerificationTokenExpires as string | Date); // Ensure Date constructor gets a valid type
        if (!isNaN(expiryDate.getTime()) && expiryDate < new Date()) {
            isTokenExpired = true;
        }
    }

    if (isTokenExpired) {

        // Use the casted adapter for updateUser
        await adapter.updateUser?.({
            id: user.id,
            emailVerificationToken: null,
            emailVerificationTokenExpires: null,
        } as Partial<CustomAdapterUserFields> & { id: string }); // Cast the partial update object
        const errorRedirectUrl = new URL('/signin', process.env.NEXT_PUBLIC_APP_URL || request.url);
        errorRedirectUrl.searchParams.set('error', 'Verification');
        errorRedirectUrl.searchParams.set('email', user.email);
        errorRedirectUrl.searchParams.set('message', 'This verification link has expired. Please request a new one.');
        return NextResponse.redirect(errorRedirectUrl.toString());
    }

    if (user.status !== 'pending_verification') {

        if (user.emailVerificationToken === validatedToken) {
             // Use the casted adapter for updateUser
             await adapter.updateUser?.({
                id: user.id,
                emailVerificationToken: null,
                emailVerificationTokenExpires: null,
            } as Partial<CustomAdapterUserFields> & { id: string });
        }
        const infoRedirectUrl = new URL('/signin', process.env.NEXT_PUBLIC_APP_URL || request.url);
        infoRedirectUrl.searchParams.set('info', 'AlreadyVerified');
        infoRedirectUrl.searchParams.set('message', 'Your email may have already been verified, or your account is in a different state. Please try signing in.');
        return NextResponse.redirect(infoRedirectUrl.toString());
    }

    const now = new Date();

    // Directly construct the update params for DynamoDB instead of relying on adapter's updateUser
    // Use REMOVE instead of setting to null to avoid GSI validation errors
    const updateParams: AWS.DynamoDB.DocumentClient.UpdateItemInput = {
        TableName: process.env.DYNAMODB_USERS_TABLE!,
        Key: { id: user.id },
        UpdateExpression: 'SET #status = :status, emailVerified = :verified, dateModified = :modified REMOVE emailVerificationToken, emailVerificationTokenExpires',
        ExpressionAttributeNames: {
            '#status': 'status' // 'status' is a reserved keyword in DynamoDB
        },
        ExpressionAttributeValues: {
            ':status': 'active',
            ':verified': now.toISOString(),
            ':modified': now.toISOString(),
            ':pendingStatus': 'pending_verification'
        },
        ConditionExpression: 'attribute_exists(id) AND #status = :pendingStatus'
    };



    
    try {
        const updateResult = await dynamoDb.update(updateParams).promise();

    } catch (updateError: any) {
        console.error("[Verify Email] DynamoDB update failed. Error details:", JSON.stringify(updateError, null, 2));
        console.error("[Verify Email] Error code:", updateError.code);
        console.error("[Verify Email] Error message:", updateError.message);
        
        if (updateError.code === 'ConditionalCheckFailedException') {
            console.error(`[Verify Email] Conditional check failed for user ${user.email}. Current status in DB might not be 'pending_verification'.`);
            console.error("[Verify Email] This suggests the user's status in the database is not what we expected.");
             const infoRedirectUrl = new URL('/signin', process.env.NEXT_PUBLIC_APP_URL || request.url);
            infoRedirectUrl.searchParams.set('info', 'AlreadyVerified');
            infoRedirectUrl.searchParams.set('message', 'Account status mismatch. Please try signing in or contact support.');
            return NextResponse.redirect(infoRedirectUrl.toString());
        }
        
        // For any other error, redirect with specific error details
        const errorRedirectUrl = new URL('/signin', process.env.NEXT_PUBLIC_APP_URL || request.url);
        errorRedirectUrl.searchParams.set('error', 'VerificationUpdateFailed');
        errorRedirectUrl.searchParams.set('email', user.email);
        errorRedirectUrl.searchParams.set('message', `Database update failed: ${updateError.message || 'Unknown error'}`);
        return NextResponse.redirect(errorRedirectUrl.toString());
    }
    


    // Redirect to a specific page on successful verification
    const verificationSuccessUrl = new URL('/auth/verification-success', process.env.NEXT_PUBLIC_APP_URL);
    return NextResponse.redirect(verificationSuccessUrl);

  } catch (error) {
    console.error("Email Verification API Error:", error);
    // On any error, redirect to signin with a generic error
    const signInUrl = new URL('/signin', process.env.NEXT_PUBLIC_APP_URL);
    signInUrl.searchParams.set('error', 'Verification');
    // If we can extract the email from the error or a failed lookup, add it.
    // This is a generic catch-all, so might not have email context.
    // The specific checks above handle adding the email param.
    return NextResponse.redirect(signInUrl);
  }
} 
