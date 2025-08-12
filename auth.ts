import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
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
        secure: isProd,
        domain: isProd ? '.keycraft.org' : undefined,
      },
    },
    callbackUrl: {
      name: isProd ? `__Secure-authjs.callback-url` : `authjs.callback-url`,
      options: {
        sameSite: isProd ? 'none' : 'lax',
        path: '/',
        secure: isProd,
        domain: isProd ? '.keycraft.org' : undefined,
      },
    },
    csrfToken: {
      name: isProd ? `__Secure-authjs.csrf-token` : `authjs.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: isProd ? 'none' : 'lax',
        path: '/',
        secure: isProd,
        domain: isProd ? '.keycraft.org' : undefined,
      },
    },
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      allowDangerousEmailAccountLinking: true, 
      profile(profile) { // Added profile function to map more fields
        // console.log("AUTH.TS Google Profile received:", JSON.stringify(profile));
        return {
          id: profile.sub, // Standard Google ID
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          firstName: profile.given_name, // Map given_name to firstName
          lastName: profile.family_name, // Map family_name to lastName
          // These will be set by our customAdapter.createUser
          // hasPaid: false, 
          // activePlans: [],
        };
      },
    }),
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
          // OAuth user trying to sign in with password
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
                 // Token resend conditions not met
            }
            
            throw new Error("PENDING_VERIFICATION"); 
        }
        // **** END OF CRITICAL CHECK ****

        const combinedName = (userFromDb.firstName && userFromDb.lastName) 
                           ? `${userFromDb.firstName} ${userFromDb.lastName}` 
                           : userFromDb.name;

        const authorizedUser = {
            id: userFromDb.id!, 
            email: userFromDb.email,
            name: combinedName,
            image: userFromDb.image,
            // Add firstName and lastName to be available in the JWT callback
            firstName: userFromDb.firstName,
            lastName: userFromDb.lastName,
            emailVerified: userFromDb.emailVerified,
            status: userFromDb.status,
        };
        // User authorized successfully

        // Check if user has verified their email
        if (!userFromDb.emailVerified) {
          // Account not verified
          // Throwing a specific error that can be caught by the UI
          const error = new Error("Account not verified. Please check your email.") as any;
          error.code = "Verification"; // Custom property to be handled by the UI
          throw error;
        }

        // Check if the user's account status is 'active'
        if (userFromDb.status !== 'active') {
          // Account not active
          // Throwing a specific error that can be caught by the UI
          const error = new Error("Account not active. Please contact support.") as any;
          error.code = "AccountStatus"; // Custom property to be handled by the UI
          throw error;
        }

        return authorizedUser; 
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: '/signin', 
  },
  callbacks: {
    async jwt({ token, user, account, trigger, profile, session }) {
      // This callback is called whenever a JWT is created or updated.
      // `user` is only available on first sign-in.
      // `token` contains the data that will be encrypted in the JWT.

      // 1. Initial sign in - Persist the user's id and other details to the token
      if (user) {
        // console.log("AUTH.TS JWT Initial User object:", JSON.stringify(user, null, 2));

        // When a user signs in (e.g., via Google or credentials), `user` is available.
        // We need to fetch the full user record from our database to get all custom fields.
        const dbUser = await customAdapter.getUser!(user.id) as CustomDbUser | null;
        
        if (dbUser) {
          // console.log("AUTH.TS JWT Found dbUser:", JSON.stringify(dbUser, null, 2));
          token.id = dbUser.id;
          token.hasPaid = dbUser.hasPaid; // Comes from DB
          token.activePlans = dbUser.activePlans;
          token.status = dbUser.status;
          token.emailVerified = dbUser.emailVerified;
          
          // Use names from DB if available, fall back to provider's info
          const firstName = dbUser.firstName || (profile as any)?.given_name;
          const lastName = dbUser.lastName || (profile as any)?.family_name;
          if (firstName) token.firstName = firstName;
          if (lastName) token.lastName = lastName;
        } else if (user) {
           // This might happen if a user is in the auth provider but not yet in our DB
           // The adapter's createUser should handle this, but as a fallback:
           token.id = user.id;
        }
      }

      // 2. Handle session updates (e.g., user updates their profile or enters beta code)
      if (trigger === "update" && session) {
        // The `session` object is passed when `update(newData)` is called from the client.
        // We merge this new data directly into the token.
        if (session.hasPaid) token.hasPaid = session.hasPaid;
        if (session.activePlans) token.activePlans = session.activePlans;

        // Optionally, refetch from DB to get other potential updates, but for beta code,
        // the direct update is more reliable.
      }

      return token;
    },
    async session({ session, token }) {
      // This callback is called whenever a session is checked.
      // `token` object comes from the `jwt` callback.
      // We are taking the data from the token and putting it into the session object.
      // This is what the client-side code will see.
      
      // console.log("AUTH.TS Session Callback - Token:", JSON.stringify(token, null, 2));

      if (token.id && session.user) {
        session.user.id = token.id as string;
      }

      // Default hasPaid from token (which comes from DB)
      if (typeof token.hasPaid === 'boolean' && session.user) {
        session.user.hasPaid = token.hasPaid;
      }

      if (token.activePlans && session.user) {
        session.user.activePlans = token.activePlans as string[];
      }
      if (token.status && session.user) {
        session.user.status = token.status as string;
      }
      if (token.emailVerified && session.user) {
        session.user.emailVerified = token.emailVerified as Date | null;
      }
      
      // Add firstName and lastName to the session user object
      if (token.firstName && session.user) {
        (session.user as any).firstName = token.firstName;
      }
      if (token.lastName && session.user) {
        (session.user as any).lastName = token.lastName;
      }

      // console.log("AUTH.TS Session Callback - Final Session:", JSON.stringify(session, null, 2));
      return session;
    },
  },
}); 