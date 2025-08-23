import type { DefaultSession, User as DefaultUser } from "next-auth";
// For v5, JWT type might be from "@auth/core/jwt" or "next-auth/jwt" depending on specific v5 version/imports.
// Let's assume for now that if needed, it would be handled by inference or explicit typing in callbacks.

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      /** The user's unique ID. */
      id: string;
      hasPaid?: boolean;
      activePlans?: string[];
      status?: string;
      emailVerified?: Date | null;
    } & DefaultSession["user"]; // Extends the default user properties (name, email, image)
  }

  // Optional: Interface for the User object if you need to type it more specifically
  // in authorize or as the `user` param in the session callback (from adapter).
  // This helps ensure the fields you expect from your DB are typed when passed to JWT callback.
  interface User extends DefaultUser {
    id: string; 
    // Add any other custom properties from your database user record that you pass to JWT
    firstName?: string | null;
    lastName?: string | null;
    hasPaid?: boolean;
    activePlans?: string[];
    status?: string;
    emailVerified?: Date | null;
    // Potentially others like hashedPassword if adapter returns it to authorize, though not usually passed to JWT.
  }
}

// Optional: If you customize the JWT in the jwt callback and need to type it.
// For Auth.js v5, the module can be "@auth/core/jwt" or sometimes just "next-auth/jwt" if using compatibility layers.
declare module "next-auth/jwt" { // Or "@auth/core/jwt"
  interface JWT {
    /** OpenID ID Token */
    id?: string;
    hasPaid?: boolean;
    activePlans?: string[];
    status?: string;
    emailVerified?: Date | null;
    firstName?: string | null;
    lastName?: string | null;
    // other custom fields from your jwt callback
  }
} 
