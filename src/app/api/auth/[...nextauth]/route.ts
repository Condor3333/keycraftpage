// my-app/src/app/api/auth/[...nextauth]/route.ts
// This file re-exports the handlers from the root auth.ts file for Auth.js v5.

// Path relative to this file: my-app/src/app/api/auth/[...nextauth]/route.ts
// Target: PROJECT_ROOT/auth.ts
// ../ -> my-app/src/app/api/auth/
// ../../ -> my-app/src/app/api/
// ../../../ -> my-app/
// ../../../../ -> my-app/src/
// ../../../../../ -> my-app/
// ../../../../../../ -> PROJECT_ROOT/

import { handlers } from "../../../../../auth"; // 5 levels up to my-app root

export const { GET, POST } = handlers;

// All the previous V4 style NextAuth({}) configuration should be removed from this file.
// It is now centralized in the root auth.ts file. 