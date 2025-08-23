import { ObjectId } from 'mongodb';


export type UserStatus = 'pending_verification' | 'active' | 'suspended' | 'banned';

// This interface should mirror the attributes defined in your DynamoDB adapter
// (e.g., CustomAdapterUser in dynamodb-adapter.ts)
// It serves as a reference for the structure of a user item stored in DynamoDB.
export interface UserDynamoDBItem {
  id: string; // Primary key (e.g., UUID)
  email: string; // GSI partition key for Email-Index
  name?: string | null; // Full name, often derived from firstName and lastName or from OAuth profile
  firstName?: string | null;
  lastName?: string | null;
  hashedPassword?: string | null; // Only if using credentials provider
  emailVerified?: string | null; // ISO Date string for when email was verified (consistent with adapter)
  image?: string | null; // URL to user's profile image
  
  status: UserStatus;
  dateCreated: string; // ISO Date string
  dateModified: string; // ISO Date string

  // OAuth related fields (managed by NextAuth adapter)
  // Structure here is illustrative; see AdapterAccount in 'next-auth/adapters'
  accounts?: Array<{
    provider: string;
    providerAccountId: string;
    type: string; // e.g. "oauth", "email", "credentials"
    // access_token?: string;
    // expires_at?: number;
    // refresh_token?: string;
    // scope?: string;
    // id_token?: string;
    // session_state?: string;
  }> | null;
  // providerCompositeKey?: string | null; // GSI for getUserByAccount: provider|providerAccountId - usually handled by adapter internally

  // Stripe Customer ID - Essential for linking DynamoDB user to Stripe Customer
  stripeCustomerId?: string | null;
  
  // Subscription/Payment related fields (examples, manage these based on your Stripe integration)
  // These are useful to have denormalized on the user item for quick checks, 
  // but the source of truth is Stripe.
  hasPaid?: boolean; // Simple flag, might be true if any activePlan exists
  activePlans?: string[]; // Could be an array of Stripe Price IDs or your internal plan identifiers
  subscriptionId?: string | null; // Stripe Subscription ID if they have an active subscription
  subscriptionStatus?: string | null; // e.g., 'active', 'trialing', 'past_due', 'canceled', 'unpaid'
  currentPeriodEnd?: string | null; // ISO Date string for subscription renewal/expiry date from Stripe
  
  // Email verification specific (often managed by NextAuth adapter or your custom logic)
  emailVerificationToken?: string | null;
  emailVerificationTokenExpires?: string | null; // ISO Date string (consistent with adapter)
}

// Note: The User class with MongoDB-specific methods (save, findByEmail, etc.) has been removed.
// User data operations are now primarily handled by the DynamoDBAdapter configured in auth.ts.
// This file now focuses on defining the TypeScript interface for the User item in DynamoDB.

// Example helper function (optional, can be expanded or moved):
/**
 * Gets the full name of a user.
 * Prioritizes firstName and lastName, falls back to name, then to null.
 */
export function getUserFullName(
  user: Pick<UserDynamoDBItem, 'firstName' | 'lastName' | 'name'>
): string | null {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  return user.name || null;
} 
