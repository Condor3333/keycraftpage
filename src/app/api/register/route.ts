import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
// import clientPromise from "@/lib/mongodb"; // Remove MongoDB
import { dynamoDb, DYNAMODB_USERS_TABLE } from "@/lib/aws-config"; // Import DynamoDB client and table name
// import { QueryInput, PutItemInput } from "aws-sdk/clients/dynamodb"; // Remove this
import AWS from 'aws-sdk'; // Import AWS to access the namespace
import { Resend } from 'resend';
import WelcomeEmail from '@/emails/WelcomeEmail'; // Adjust path if needed
import crypto from 'crypto'; // Import crypto
import type { UserStatus } from "@/models/User"; // Import UserStatus
import { v4 as uuidv4 } from 'uuid'; // For generating user IDs if needed
import { z } from 'zod'; // Added import for Zod

// User structure for DynamoDB
interface NewUserDynamo {
  id: string; // Primary key
  firstName: string;
  lastName: string;
  name: string; // Combined name
  email: string; // GSI partition key
  hashedPassword?: string;
  emailVerified?: string | null; // ISO Date string or null
  hasPaid?: boolean;
  activePlans?: string[];
  emailVerificationToken?: string | null;
  emailVerificationTokenExpires?: string | null; // ISO Date string or null
  status: UserStatus;
  dateCreated: string; // ISO Date string
  dateModified: string; // ISO Date string
  accounts?: any[]; // For potential OAuth linking consistency
}

// Define Zod schema for registration input
const RegisterUserSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50, "First name too long"),
  lastName: z.string().min(1, "Last name is required").max(50, "Last name too long"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters long").max(100, "Password too long"),
});

export async function POST(req: Request) {
  const resend = new Resend(process.env.RESEND_API_KEY); // Initialize Resend here
  try {
    const body = await req.json();

    // Validate with Zod
    const validationResult = RegisterUserSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { message: "Invalid registration data.", errors: validationResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { firstName, lastName, email, password } = validationResult.data; // Use validated data

    // Check if user exists using GSI on email
    const queryParams: AWS.DynamoDB.DocumentClient.QueryInput = {
        TableName: DYNAMODB_USERS_TABLE,
        IndexName: 'Email-Index', // Assumes a GSI named Email-Index with email as partition key
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: { ':email': email.toLowerCase() }, // DocumentClient handles marshalling for QueryInput too
    };
    
    const existingUserResult = await dynamoDb.query(queryParams).promise();

    if (existingUserResult.Items && existingUserResult.Items.length > 0) {
      const existingUser = existingUserResult.Items[0] as NewUserDynamo;
      if (existingUser.status === 'pending_verification') {
        // TODO: Optionally re-send verification email logic here (similar to adapter)
        return NextResponse.json(
          { message: "Registration pending. Please check your email to verify your account. If you haven\'t received it, try again in a few minutes or contact support.", code: "PENDING_VERIFICATION" }, 
          { status: 409 }
        );
      }
      return NextResponse.json(
        { message: "User with this email already exists and is active.", code: "USER_EXISTS_ACTIVE" }, 
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4(); // Generate a unique ID for the new user
    const now = new Date();
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    // const emailVerificationTokenExpires = new Date(Date.now() + 1 * 60 * 1000); // 1 minute
    const emailVerificationTokenExpires = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours


    const newUserDocument: NewUserDynamo = {
      id: userId,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      email: email.toLowerCase(),
      hashedPassword,
      emailVerified: null,
      hasPaid: false,
      activePlans: [],
      emailVerificationToken,
      emailVerificationTokenExpires: emailVerificationTokenExpires.toISOString(),
      status: 'pending_verification',
      dateCreated: now.toISOString(),
      dateModified: now.toISOString(),
      accounts: [], // Initialize accounts array
    };

    const putParams: AWS.DynamoDB.DocumentClient.PutItemInput = {
        TableName: DYNAMODB_USERS_TABLE,
        Item: newUserDocument,
        ConditionExpression: 'attribute_not_exists(id) AND attribute_not_exists(email)', // Prevent race conditions
    };

    try {
        await dynamoDb.put(putParams).promise();
    } catch (putError: any) {
        if (putError.code === 'ConditionalCheckFailedException') {
            // This means either the ID or email (if GSI PK also checked) already exists.
            // We already queried by email, so this might indicate an ID collision (highly unlikely with UUIDs)
            // or a very fast race condition. For now, assume email exists.
            console.error("Register API: ConditionalCheckFailedException on put, likely email exists:", putError);
            return NextResponse.json(
              { message: "User with this email may have just been registered. Try logging in or check your email.", code: "USER_EXISTS_CONFLICT" }, 
              { status: 409 }
            );
        }
        console.error("Register API: Error creating user in DynamoDB:", putError);
        return NextResponse.json(
            { message: "Error creating user." },
            { status: 500 }
        );
    }
    
    // Send Welcome Email with verification link
    if (process.env.RESEND_API_KEY && process.env.FROM_EMAIL && process.env.NEXT_PUBLIC_APP_URL) {
      try {
        const activationLink = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/verify-email?token=${emailVerificationToken}`;
        const emailResponse = await resend.emails.send({
          from: process.env.FROM_EMAIL,
          to: [newUserDocument.email],
          subject: 'Welcome to Keycraft! Please Complete Your Registration',
          react: WelcomeEmail({ 
            userName: newUserDocument.firstName, 
            activationLink
          })
        });

        if (emailResponse.error) {
          console.error("Failed to send welcome/verification email:", emailResponse.error);
        } else if (emailResponse.data && emailResponse.data.id) {
          console.log("Welcome/verification email sent successfully:", emailResponse.data.id);
        } else {
          console.warn("Welcome/verification email may have sent, but no ID was returned.");
        }
      } catch (emailError) {
        console.error("Exception caught while sending verification email:", emailError);
      }
    } else {
      console.warn("RESEND_API_KEY, FROM_EMAIL, or NEXT_PUBLIC_APP_URL not set. Skipping welcome/verification email.");
    }

    // Return a success response with email and notice type
    return NextResponse.json(
      {
        success: true,
        message: "Registration initiated. Please check your email to verify your account.", 
        email: newUserDocument.email,
        notice: 'pending_verification' // Explicitly pass the notice type
      },
      { status: 201 }
    );

  } catch (error) {
    if (error instanceof z.ZodError) { // Catch Zod specific errors if safeParse isn't used directly before
        return NextResponse.json({ message: "Validation failed", errors: error.flatten().fieldErrors }, { status: 400 });
    }
    console.error("Registration API error:", error);
    return NextResponse.json(
      { message: "An internal server error occurred." },
      { status: 500 }
    );
  }
} 