import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { DynamoDBAdapter } from "./src/lib/dynamodb-adapter";
import bcrypt from "bcryptjs";
import type { AdapterUser } from "next-auth/adapters";
import type { User as NextAuthUserType, Session as NextAuthSessionType } from "next-auth";
import { Resend } from 'resend';
import WelcomeEmail from './src/emails/WelcomeEmail';
import crypto from 'crypto';
import type { UserStatus } from './src/models/User';
import { z } from 'zod';

const isProd = process.env.NODE_ENV === 'production';
const cookieDomain = process.env.AUTH_COOKIE_DOMAIN || '.keycraft.org';

// Zod Schema for Credentials
const CredentialsSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required") // Basic presence check, actual complexity rules are separate
});

// Define a more specific User type for what's in your DB (DynamoDB context)
interface CustomDbUser extends AdapterUser { 
  // id is string from AdapterUser
  name?: string | null;
  image?: string | null; // Could be S3 key or URL
  hashedPassword?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  hasPaid?: boolean;
  activePlans?: string[];
  emailVerificationToken?: string | null;
  emailVerificationTokenExpires?: Date | null; // Store as ISO string in DB, Date in app
  status?: UserStatus;
  dateCreated?: string; // Store as ISO string
  dateModified?: string; // Store as ISO string
  accounts?: Array<any>; // For linked OAuth accounts
  sessions?: Array<any>; // For sessions (if embedding, though separate table is better)
  // Any other fields you store in DynamoDB user table
}

// The custom adapter instantiation
const customAdapter = DynamoDBAdapter(); 

// The original createUser logic in the adapter itself will handle defaults like hasPaid, activePlans, status.
// We don't need to override adapter.createUser here anymore if the adapter itself sets these defaults.

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
  adapter: customAdapter, // Use the DynamoDB adapter
  cookies: {
    sessionToken: {
      name: isProd ? `__Secure-next-auth.session-token` : `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: isProd ? 'none' : 'lax',
        path: '/',
        secure: isProd, // false in dev over http
        domain: cookieDomain,
      },
    },
    callbackUrl: {
      name: isProd ? `__Secure-authjs.callback-url` : `authjs.callback-url`,
      options: {
        sameSite: isProd ? 'none' : 'lax',
        path: '/',
        secure: isProd,
        domain: cookieDomain,
      },
    },
    csrfToken: {
      name: isProd ? `__Secure-authjs.csrf-token` : `authjs.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: isProd ? 'none' : 'lax',
        path: '/',
        secure: isProd,
        domain: cookieDomain,
      },
    },
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Credentials authorization attempt
        
        // ADDED: Validate credentials with Zod
        const validationResult = CredentialsSchema.safeParse(credentials);
        if (!validationResult.success) {
          // Invalid credentials format
          // For security, don't reveal which field was wrong, just a generic error.
          throw new Error("Invalid email or password format."); 
        }

        const { email, password } = validationResult.data; // Use validated data

        // Fetch user from DynamoDB using the adapter or direct SDK call
        const userFromDb = await customAdapter.getUserByEmail!((email).toLowerCase()) as CustomDbUser | null;

        if (!userFromDb) {
          // User not found
          // Throw an error that can be caught by the sign-in page to show a generic "invalid credentials" message.
          // NextAuth.js will map this to a "CredentialsSignin" error by default if we return null.
          return null;
        }
        // User found in database

        if (!userFromDb.hashedPassword) {
          // User without password (shouldn't happen with credentials-only auth)
          throw new Error("SOCIAL_SIGNIN_NO_PASSWORD"); // Custom error code
        }

        const passwordsMatch = await bcrypt.compare(password, userFromDb.hashedPassword);

        if (!passwordsMatch) {
            // Password mismatch
            // Returning null is the standard way to indicate credentials failure.
            // NextAuth will automatically throw a CredentialsSignin error.
            return null;
        }

        // **** START OF CRITICAL CHECK ****
        if (userFromDb.status === 'pending_verification' || !userFromDb.emailVerified) {
            // User requires email verification

            const tokenIsMissingOrExpired = !userFromDb.emailVerificationToken || 
                                          (userFromDb.emailVerificationTokenExpires && userFromDb.emailVerificationTokenExpires < new Date());

            if (userFromDb.status === 'pending_verification' && tokenIsMissingOrExpired) {
                // Generating new verification token
                const newVerificationToken = crypto.randomBytes(32).toString('hex');
                const newVerificationTokenExpires = new Date(Date.now() + 1 * 60 * 1000); // 1 minute expiry

                await customAdapter.updateUser!({
                    id: userFromDb.id!,
                    emailVerificationToken: newVerificationToken,
                    emailVerificationTokenExpires: newVerificationTokenExpires,
                } as Partial<CustomDbUser> & Pick<CustomDbUser, "id">); // Cast to CustomDbUser parts
                // New verification token saved

                // Send the new verification email
                if (process.env.RESEND_API_KEY && process.env.FROM_EMAIL && process.env.NEXT_PUBLIC_APP_URL) {
                    try {
                        const resend = new Resend(process.env.RESEND_API_KEY);
                        const userNameForEmail = userFromDb.firstName || userFromDb.name?.split(' ')[0] || 'there';
                        const activationLink = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/verify-email?token=${newVerificationToken}`;
                        
                        // Sending new verification email

                        const emailResponse = await resend.emails.send({
                            from: process.env.FROM_EMAIL,
                            to: [userFromDb.email], 
                            subject: 'Keycraft - Please Verify Your Account',
                            react: WelcomeEmail({ 
                                userName: userNameForEmail,
                                activationLink
                            })
                        });

                        if (emailResponse.error) {
                            // Failed to resend verification email
                        } else if (emailResponse.data && emailResponse.data.id) {
                            // Verification email sent successfully
                        } else {
                            // Verification email sent (no ID returned)
                        }
                    } catch (emailError) {
                        // Exception during email sending
                    }
                } else {
                    // Email environment variables not configured
                }
            } else if (userFromDb.emailVerificationToken) {
                // User has existing verification token
            } else {
                // User has no verification token
            }

            // User requires email verification - return null to prevent sign-in
            return null;
        }
        // **** END OF CRITICAL CHECK ****

        // User is verified and active - return user object for NextAuth
        return {
          id: userFromDb.id,
          name: userFromDb.name,
          email: userFromDb.email,
          image: userFromDb.image,
          firstName: userFromDb.firstName,
          lastName: userFromDb.lastName,
          hasPaid: userFromDb.hasPaid,
          activePlans: userFromDb.activePlans,
          status: userFromDb.status,
          emailVerified: userFromDb.emailVerified,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Persist user data in the token
      if (user) {
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.hasPaid = user.hasPaid;
        token.activePlans = user.activePlans;
        token.status = user.status;
        token.emailVerified = user.emailVerified;
      }
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client
      if (token) {
        session.user.id = token.sub!;
        session.user.firstName = token.firstName as string;
        session.user.lastName = token.lastName as string;
        session.user.hasPaid = token.hasPaid as boolean;
        session.user.activePlans = token.activePlans as string[];
        session.user.status = token.status as UserStatus;
        session.user.emailVerified = token.emailVerified as Date;
      }
      return session;
    },
  },
  pages: {
    signIn: '/signin',
    error: '/auth/error',
  },
  session: {
    strategy: "jwt",
  },
}); 