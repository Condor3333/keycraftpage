import { Adapter, AdapterUser, AdapterAccount, AdapterSession, VerificationToken } from 'next-auth/adapters';
import { dynamoDb, DYNAMODB_USERS_TABLE } from './aws-config'; // Assuming aws-config is in the same dir or adjust path
// Import DocumentClient specific types
import type {
    GetItemInput,
    UpdateItemInput,
    DeleteItemInput,
    QueryInput as BaseQueryInput, // Keep for reference if needed elsewhere, but prefer DocumentClient.QueryInput
    PutItemInput as BasePutItemInput // Keep for reference
} from 'aws-sdk/clients/dynamodb';
import AWS from 'aws-sdk'; // Import AWS to access the DocumentClient namespace
import { v4 as uuidv4 } from 'uuid';

// Custom User type that extends AdapterUser for our specific fields
// This should mirror the CustomDbUser in auth.ts for consistency
export interface CustomAdapterUser extends AdapterUser {
    name?: string | null;
    image?: string | null; // URL, not S3 key as per user request
    hashedPassword?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    hasPaid?: boolean;
    activePlans?: string[];
    emailVerificationToken?: string | null;
    emailVerificationTokenExpires?: Date | null; // Store as Date object in app, ISO string in DB
    passwordResetToken?: string | null;
    passwordResetExpires?: Date | null;
    status?: string; // e.g., 'pending_verification', 'active'
    dateCreated?: string; // ISO string
    dateModified?: string; // ISO string
    accounts?: AdapterAccount[];
    sessions?: AdapterSession[];
    providerCompositeKey?: string | null; // For GSI used by getUserByAccount
    // ADDED: AI transcription quota fields
    transcriptionCount?: number; // Number of AI transcriptions used this month
    transcriptionMonth?: string; // Month in format 'YYYY-MM'
}

interface CustomDynamoDBAdapter extends Adapter {
    getUserByEmailVerificationToken(token: string): Promise<CustomAdapterUser | null>;
    getUserByPasswordResetToken(token: string): Promise<CustomAdapterUser | null>;
}

// AdapterUser fields that NextAuth expects
// This function now expects a plain JavaScript object, as returned by DocumentClient
const toAdapterUser = (item: Record<string, any> | null): CustomAdapterUser | null => {
    if (!item) return null;
    return {
        id: item.id as string,
        email: item.email as string,
        // Ensure dates are correctly instantiated if they are strings
        emailVerified: item.emailVerified ? new Date(item.emailVerified as string) : null,
        emailVerificationTokenExpires: item.emailVerificationTokenExpires ? new Date(item.emailVerificationTokenExpires as string) : null,
        passwordResetExpires: item.passwordResetExpires ? new Date(item.passwordResetExpires as string) : null,
        expires: item.expires ? new Date(item.expires as string) : undefined, // For sessions embedded in user
        ...item, // spread the rest of the item properties
    } as CustomAdapterUser;
};

export function DynamoDBAdapter(): CustomDynamoDBAdapter {
  const AdapterInternals = {
    _getUserById: async (id: string): Promise<CustomAdapterUser | null> => {
        const params: AWS.DynamoDB.DocumentClient.GetItemInput = { // Use DocumentClient.GetItemInput
            TableName: DYNAMODB_USERS_TABLE,
            Key: { id: id } // DocumentClient uses plain JS objects for Key
        };
        const result = await dynamoDb.get(params).promise();
        return toAdapterUser(result.Item || null); // result.Item is already a JS object
    },
    _getUserByEmail: async (email: string): Promise<CustomAdapterUser | null> => {
        const params: AWS.DynamoDB.DocumentClient.QueryInput = { // Use DocumentClient.QueryInput
            TableName: DYNAMODB_USERS_TABLE,
            IndexName: 'Email-Index',
            KeyConditionExpression: 'email = :email',
            ExpressionAttributeValues: { ':email': email.toLowerCase() }, // Plain JS value
        };
        const result = await dynamoDb.query(params).promise();
        if (!result.Items || result.Items.length === 0) return null;
        return toAdapterUser(result.Items[0] || null); // result.Items are JS objects
    },
    _getUserByAccount: async ({ providerAccountId, provider }: { providerAccountId: string; provider: string }): Promise<CustomAdapterUser | null> => {
        const providerCompositeKeyValue = `${provider}|${providerAccountId}`; 
        const params: AWS.DynamoDB.DocumentClient.QueryInput = { // Use DocumentClient.QueryInput
            TableName: DYNAMODB_USERS_TABLE,
            IndexName: 'ProviderAccountIndex', 
            KeyConditionExpression: 'providerCompositeKey = :val',
            ExpressionAttributeValues: { ':val': providerCompositeKeyValue }, // Plain JS value
        };
        const result = await dynamoDb.query(params).promise();
        if (!result.Items || result.Items.length === 0) return null;
        return toAdapterUser(result.Items[0] || null); // result.Items are JS objects
    },
    _updateUser: async (user: Partial<CustomAdapterUser> & Pick<CustomAdapterUser, "id">): Promise<AdapterUser | null> => {
        // Updating user in database
        if (!user.id) throw new Error("User ID is required for update");
      
        const { id, ...userDataToUpdate } = user;
        (userDataToUpdate as any).dateModified = new Date().toISOString();
      
        const cleanUserData = Object.entries(userDataToUpdate).reduce((acc, [key, value]) => {
            if (value !== undefined) (acc as any)[key] = value;
            return acc;
        }, {});

        if (Object.keys(cleanUserData).length === 0) {
            return AdapterInternals._getUserById(id) as Promise<AdapterUser | null>; 
        }

        let updateExpression = 'SET ';
        const expressionAttributeNames: { [key: string]: string } = {};
        const expressionAttributeValues: { [key: string]: any } = {};
        
        let i = 0;
        for(const key in cleanUserData) {
            const attrName = `#k${i}`;
            const attrValue = `:v${i}`;
            updateExpression += `${i > 0 ? ', ' : ''}${attrName} = ${attrValue}`;
            expressionAttributeNames[attrName] = key;
            const val = (cleanUserData as any)[key];
            // For DocumentClient, assign values directly for most types
            // Dates should be ISO strings for consistency if not handled automatically by SDK marshalling
            if (val instanceof Date) {
                expressionAttributeValues[attrValue] = val.toISOString();
            } else {
                expressionAttributeValues[attrValue] = val;
            }
            i++;
        }
      
        const params: AWS.DynamoDB.DocumentClient.UpdateItemInput = { // Use DocumentClient.UpdateItemInput
          TableName: DYNAMODB_USERS_TABLE,
          Key: { id: id }, // Plain JS object for Key
          UpdateExpression: updateExpression,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
          ReturnValues: 'ALL_NEW',
        };
      
        try {
          const result = await dynamoDb.update(params).promise();
          return toAdapterUser(result.Attributes || null); 
        } catch (error) {
          // User update error
          throw error;
        }
    },
    _deleteSession: async (sessionToken: string): Promise<void> => {
        console.log("DynamoDBAdapter: _deleteSession (internal - INEFFICIENT)", sessionToken);
        const scanResult = await dynamoDb.scan({ TableName: DYNAMODB_USERS_TABLE }).promise(); // DocumentClient scan
        if (scanResult.Items) {
            for (const item of scanResult.Items) { // item is already a JS object
                const user = toAdapterUser(item);
                if (user && user.id && user.sessions) {
                    const initialLength = user.sessions.length;
                    const updatedSessions = user.sessions.filter(s => s.sessionToken !== sessionToken);
                    if (updatedSessions.length < initialLength) {
                        // Use internal _updateUser to avoid `this` context issues if deleteSession was called from elsewhere
                        await AdapterInternals._updateUser({
                            id: user.id,
                            sessions: updatedSessions,
                        } as Partial<CustomAdapterUser> & Pick<CustomAdapterUser, "id">);
                        console.log(`Deleted session ${sessionToken} for user ${user.id}`);
                        return; 
                    }
                }
            }
        }
        console.log(`Session ${sessionToken} not found to delete (internal).`);
    },
  };

  return {
    async createUser(user) {
      // Creating user in database
      const userId = user.id || uuidv4();
      const now = new Date();
      
      const userData: CustomAdapterUser = { // This is already a JS object
        id: userId,
        email: user.email.toLowerCase(),
        name: user.name,
        image: user.image,
        emailVerified: user.emailVerified instanceof Date ? user.emailVerified : null,
        // Defaults for custom fields
        status: (user as any).status || 'pending_verification',
        hasPaid: (user as any).hasPaid === undefined ? false : (user as any).hasPaid,
        activePlans: (user as any).activePlans || [],
        accounts: (user as any).accounts || [], 
        sessions: (user as any).sessions || [],
        dateCreated: now.toISOString(),
        dateModified: now.toISOString(),
      };
      
      // If provider (OAuth) user, it might contain `firstName` and `lastName`
      if ((user as any).firstName) userData.firstName = (user as any).firstName;
      if ((user as any).lastName) userData.lastName = (user as any).lastName;

      // DocumentClient put expects a plain JS object for Item
      const params: AWS.DynamoDB.DocumentClient.PutItemInput = { // Use DocumentClient.PutItemInput
        TableName: DYNAMODB_USERS_TABLE,
        Item: userData, // Pass the JS object directly
        ConditionExpression: 'attribute_not_exists(id)',
      };
      try {
        await dynamoDb.put(params).promise();
        return userData; // Return the CustomAdapterUser object we constructed
      } catch (error: any) {
        if (error.code === 'ConditionalCheckFailedException') {
          // User creation failed - duplicate ID or email
          // Optionally, try to fetch and return the existing user if that's the desired behavior.
          // For now, let the error propagate or throw a specific one.
        }
        // User creation error
        throw error;
      }
    },
    async getUser(id) {
  
      try {
        return await AdapterInternals._getUserById(id);
      } catch (error) {
        // Get user error
        return null;
      }
    },
    async getUserByEmail(email) {
  
      try {
        return await AdapterInternals._getUserByEmail(email);
      } catch (error) {
        // Get user by email error
        return null;
      }
    },
    async getUserByAccount({ providerAccountId, provider }) {
      console.log("DynamoDBAdapter: getUserByAccount", { providerAccountId, provider });
      try {
        return await AdapterInternals._getUserByAccount({ providerAccountId, provider });
      } catch (error) {
        console.error("DynamoDBAdapter: getUserByAccount error - ensure GSI 'ProviderAccountIndex' exists and uses 'providerCompositeKey'", error);
        return null; 
      }
    },

    async getUserByEmailVerificationToken(token: string) {
      console.log("DynamoDBAdapter: getUserByEmailVerificationToken", token.substring(0, 10) + "...");
      
      // We need to scan the table since we don't have a GSI on emailVerificationToken
      // In production, you might want to add a GSI for this
      const scanParams: AWS.DynamoDB.DocumentClient.ScanInput = {
        TableName: DYNAMODB_USERS_TABLE,
        FilterExpression: 'emailVerificationToken = :token',
        ExpressionAttributeValues: {
          ':token': token
        }
      };

      try {
        const result = await dynamoDb.scan(scanParams).promise();
        if (!result.Items || result.Items.length === 0) {
          console.log("DynamoDBAdapter: No user found with verification token");
          return null;
        }

        if (result.Items.length > 1) {
          console.warn(`DynamoDBAdapter: Multiple users found with same verification token: ${result.Items.length}`);
        }

        const userItem = result.Items[0];
        console.log("DynamoDBAdapter: Found user with verification token:", userItem.email, "Status:", userItem.status);
        return toAdapterUser(userItem);
      } catch (error) {
        console.error("DynamoDBAdapter: Error scanning for user by verification token:", error);
        throw error;
      }
    },
    async updateUser(user) {
        console.log("DynamoDBAdapter: updateUser", user);
        if (!user.id) throw new Error("User ID is required for update");
      
        const { id, ...userDataToUpdate } = user;
        (userDataToUpdate as any).dateModified = new Date().toISOString(); // Always update dateModified
      
        // Remove undefined keys, as DynamoDB update doesn't like them in ExpressionAttributeValues
        const cleanUserData = Object.entries(userDataToUpdate).reduce((acc, [key, value]) => {
            if (value !== undefined) (acc as any)[key] = value;
            return acc;
        }, {});

        if (Object.keys(cleanUserData).length === 0) {
            console.log("DynamoDBAdapter: updateUser - no fields to update for user", id);
            return await AdapterInternals._getUserById(id) as AdapterUser; // Must return AdapterUser
        }

        let updateExpression = 'SET ';
        const expressionAttributeNames: { [key: string]: string } = {};
        const expressionAttributeValues: { [key: string]: any } = {};
        
        let i = 0;
        for(const key in cleanUserData) {
            const attrName = `#k${i}`;
            const attrValue = `:v${i}`;
            updateExpression += `${i > 0 ? ', ' : ''}${attrName} = ${attrValue}`;
            expressionAttributeNames[attrName] = key;
            const val = (cleanUserData as any)[key];
            // For DocumentClient, assign values directly
            if (val instanceof Date) {
                 expressionAttributeValues[attrValue] = val.toISOString();
            } else {
                expressionAttributeValues[attrValue] = val;
            }
            i++;
        }
      
        const params: AWS.DynamoDB.DocumentClient.UpdateItemInput = { // Use DocumentClient.UpdateItemInput
          TableName: DYNAMODB_USERS_TABLE,
          Key: { id: id }, // Plain JS object for Key
          UpdateExpression: updateExpression,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
          ReturnValues: 'ALL_NEW',
        };
      
        try {
          const result = await dynamoDb.update(params).promise();
          return toAdapterUser(result.Attributes || null) as AdapterUser; // Must return AdapterUser
        } catch (error) {
          console.error("DynamoDBAdapter: updateUser error", error);
          throw error;
        }
      },
    async deleteUser(userId) {
      console.log("DynamoDBAdapter: deleteUser", userId);
      const params: AWS.DynamoDB.DocumentClient.DeleteItemInput = { // Use DocumentClient.DeleteItemInput
        TableName: DYNAMODB_USERS_TABLE,
        Key: { id: userId }, // Plain JS object for Key
        ReturnValues: 'ALL_OLD' 
      };
      try {
        const result = await dynamoDb.delete(params).promise();
        return toAdapterUser(result.Attributes || null); // result.Attributes is a JS object
      } catch (error) {
        console.error("DynamoDBAdapter: deleteUser error", error);
        return null; // Or throw error, depending on NextAuth expectation for failed delete
      }
    },
    async linkAccount(account) {
      console.log("DynamoDBAdapter: linkAccount", account);
      const { userId, provider, providerAccountId } = account;
      if (!userId) throw new Error("User ID is required to link account");

      const user = await AdapterInternals._getUserById(userId);
      if (!user) throw new Error(`User not found with id ${userId} to link account`);

      const currentAccounts = user.accounts || [];
      // Prevent duplicate linking
      if (currentAccounts.some(acc => acc.provider === provider && acc.providerAccountId === providerAccountId)) {
        return account; // Already linked
      }
      const newAccountList = [...currentAccounts, account];
      const providerCompositeKey = `${provider}|${providerAccountId}`;

      const params: AWS.DynamoDB.DocumentClient.UpdateItemInput = { // Use DocumentClient.UpdateItemInput
        TableName: DYNAMODB_USERS_TABLE,
        Key: { id: userId }, // Plain JS object for Key
        UpdateExpression: 'SET accounts = :accounts, providerCompositeKey = :pkVal, dateModified = :now',
        ExpressionAttributeValues: {
          ':accounts': newAccountList, // Pass the array of JS account objects directly
          ':pkVal': providerCompositeKey,
          ':now': new Date().toISOString(),
        },
      };
      try {
        await dynamoDb.update(params).promise();
        console.log(`DynamoDBAdapter: Account linked and providerCompositeKey set for user ${userId}`);
        return account;
      } catch (error) {
        console.error("DynamoDBAdapter: linkAccount error", error);
        throw error;
      }
    },
    async unlinkAccount(accountPick: Pick<AdapterAccount, "provider" | "providerAccountId">) {
        console.log("DynamoDBAdapter: unlinkAccount", accountPick);
        console.warn("DynamoDBAdapter: unlinkAccount is performing a scan, which is inefficient.");

        const scanResult = await dynamoDb.scan({ TableName: DYNAMODB_USERS_TABLE }).promise(); // DocumentClient scan
        if (!scanResult.Items) {
            console.warn("DynamoDBAdapter: unlinkAccount - no items found in scan.");
            return;
        }

        for (const item of scanResult.Items) { // item is already a JS object
            const user = toAdapterUser(item);
            if (user && user.id && user.accounts) {
                const accountIndex = user.accounts.findIndex(
                    (acc: AdapterAccount) => acc.provider === accountPick.provider && acc.providerAccountId === accountPick.providerAccountId
                );

                if (accountIndex > -1) {
                    const updatedAccounts = [
                        ...user.accounts.slice(0, accountIndex),
                        ...user.accounts.slice(accountIndex + 1),
                    ];
                    try {
                        await AdapterInternals._updateUser({
                            id: user.id,
                            accounts: updatedAccounts,
                            providerCompositeKey: null, // Remove providerCompositeKey if last OAuth of this type is unlinked? Or handle more granularly.
                                                       // For now, let's assume GSI key remains, or user has only one OAuth type.
                                                       // A more robust solution would check if other accounts from the same provider exist.
                        } as Partial<CustomAdapterUser> & Pick<CustomAdapterUser, "id">);
                        console.log(`DynamoDBAdapter: Unlinked account ${accountPick.provider} for user ${user.id}`);
                        return; 
                    } catch (error) {
                        console.error(`DynamoDBAdapter: Error unlinking account for user ${user.id}`, error);
                        throw error; 
                    }
                }
            }
        }
        console.warn(`DynamoDBAdapter: unlinkAccount - Did not find user with account ${accountPick.provider} / ${accountPick.providerAccountId}`);
    },
    async createSession(sessionInput: { userId: string; sessionToken: string; expires: Date }): Promise<AdapterSession> {
        console.log("DynamoDBAdapter: createSession", sessionInput);
        const { userId, sessionToken, expires } = sessionInput;
        
        const newSessionData = {
            sessionToken, 
            userId,
            expires,
            id: sessionToken 
        } as AdapterSession; // Using type assertion to bypass persistent linter issue

        const user = await AdapterInternals._getUserById(userId);
        if (!user) throw new Error (`User ${userId} not found to create session`);
        const currentSessions = user.sessions || [];
        const updatedSessions = [...currentSessions, newSessionData];

        const params: AWS.DynamoDB.DocumentClient.UpdateItemInput = { // Use DocumentClient.UpdateItemInput
            TableName: DYNAMODB_USERS_TABLE,
            Key: { id: userId }, // Plain JS object for Key
            UpdateExpression: 'SET sessions = :sessions, dateModified = :now',
            ExpressionAttributeValues: {
                ':sessions': updatedSessions.map(s => ({...s, expires: s.expires.toISOString()})), // Ensure dates in sessions are ISO strings
                ':now': new Date().toISOString(),
            },
        };
        try {
            await dynamoDb.update(params).promise();
            return sessionInput; // Return AdapterSession
        } catch (error) {
            console.error("DynamoDBAdapter: createSession error (embedded in user)", error);
            throw error;
        }
    },
    async getSessionAndUser(sessionToken) {
        console.log("DynamoDBAdapter: getSessionAndUser by sessionToken (SCAN - INEFFICIENT)", sessionToken);
        // Session lookup using inefficient scan
        const scanResult = await dynamoDb.scan({ TableName: DYNAMODB_USERS_TABLE }).promise(); // DocumentClient scan
        if (!scanResult.Items) return null;

        for (const item of scanResult.Items) { // item is already a JS object
            const user = toAdapterUser(item);
            if (user && user.sessions) {
                const session = user.sessions.find(s => s.sessionToken === sessionToken);
                if (session) {
                    if (session.expires < new Date()) { 
                        await AdapterInternals._deleteSession(sessionToken); // Use AdapterInternals
                        return null;
                    }
                    return { session, user } as { session: AdapterSession; user: AdapterUser };
                }
            }
        }
        return null;
    },
    async updateSession(sessionUpdate: Partial<AdapterSession> & Pick<AdapterSession, "sessionToken">): Promise<AdapterSession | null | undefined> {
        console.log("DynamoDBAdapter: updateSession (Embedded - INEFFICIENT)", sessionUpdate);
        const { sessionToken, userId, expires } = sessionUpdate;
        if (!userId) return null; 

        const user = await AdapterInternals._getUserById(userId);
        if (!user || !user.sessions) return null;

        let sessionFoundAndUpdated = false;
        let finalUpdatedSession: AdapterSession | undefined = undefined;

        const updatedSessions = user.sessions.map(s => {
            if (s.sessionToken === sessionToken) {
                sessionFoundAndUpdated = true;
                const newExpires = expires !== undefined ? expires : s.expires; 
                finalUpdatedSession = { 
                    ...s, 
                    expires: newExpires // Keep as Date object here, will be stringified if needed by updateUser logic
                } as AdapterSession; 
                return finalUpdatedSession;
            }
            return s;
        });

        if (!sessionFoundAndUpdated || !finalUpdatedSession) return null; 

        const params: AWS.DynamoDB.DocumentClient.UpdateItemInput = { // Use DocumentClient.UpdateItemInput
            TableName: DYNAMODB_USERS_TABLE,
            Key: { id: userId }, // Plain JS object for Key
            UpdateExpression: 'SET sessions = :sessions, dateModified = :now',
            ExpressionAttributeValues: {
                ':sessions': updatedSessions.filter(s => s !== undefined).map(s => ({...s!, expires: s!.expires.toISOString()})), // Ensure dates are ISO strings
                ':now': new Date().toISOString(),
            },
        };
        try {
            await dynamoDb.update(params).promise();
            return finalUpdatedSession; 
        } catch (e) {
            console.error("Failed to update embedded session for user ", userId, e);
            return null;
        }
    },
    async deleteSession(sessionToken) { 
        console.log("DynamoDBAdapter: deleteSession (public)", sessionToken);
        return AdapterInternals._deleteSession(sessionToken);
    },
    async createVerificationToken(verificationToken) {
      console.log("DynamoDBAdapter: createVerificationToken", verificationToken);
      const { identifier: email, token, expires } = verificationToken;
      const user = await AdapterInternals._getUserByEmail(email);
      if (!user || !user.id) throw new Error(`User not found with email ${email} for verification token`);

      const params: AWS.DynamoDB.DocumentClient.UpdateItemInput = { // Use DocumentClient.UpdateItemInput
        TableName: DYNAMODB_USERS_TABLE,
        Key: { id: user.id }, // Plain JS object for Key
        UpdateExpression: 'SET emailVerificationToken = :token, emailVerificationTokenExpires = :expires, dateModified = :now',
        ExpressionAttributeValues: {
          ':token': token,
          ':expires': expires.toISOString(), // Store as ISO string
          ':now': new Date().toISOString(),
        },
      };
      try {
        await dynamoDb.update(params).promise();
        return { ...verificationToken, expires }; // Return VerificationToken
      } catch (error) {
        console.error("DynamoDBAdapter: createVerificationToken error", error);
        throw error;
      }
    },
    async useVerificationToken({ identifier: email, token }) {
      console.log("DynamoDBAdapter: useVerificationToken", { email, token });
      const user = await AdapterInternals._getUserByEmail(email);
      if (!user || !user.id) {
        console.log("useVT: User not found by email", email);
        return null;
      }
      
      const storedToken = user.emailVerificationToken;
      const storedTokenExpires = user.emailVerificationTokenExpires;

      if (storedToken !== token) {
        console.log("useVT: Token mismatch", { stored: storedToken, received: token });
        return null;
      }
      if (!storedTokenExpires || storedTokenExpires < new Date()) {
        console.log("useVT: Token expired", storedTokenExpires);
        return null;
      }

      // Token is valid, consume it and update user
      const params: AWS.DynamoDB.DocumentClient.UpdateItemInput = { // Use DocumentClient.UpdateItemInput
        TableName: DYNAMODB_USERS_TABLE,
        Key: { id: user.id }, // Plain JS object for Key
        UpdateExpression: 'SET emailVerified = :verifiedDate, #status_attr = :statusValue REMOVE emailVerificationToken, emailVerificationTokenExpires',
        ExpressionAttributeNames: { '#status_attr': 'status' },
        ExpressionAttributeValues: {
          ':verifiedDate': new Date().toISOString(), // Store as ISO string
          ':statusValue': 'active',
        },
        ReturnValues: "ALL_NEW"
      };
      try {
        const result = await dynamoDb.update(params).promise();
        // The user object in the adapter methods like toAdapterUser expects string dates to be converted.
        // For useVerificationToken, the return value is VerificationToken, where expires should be a Date.
        // The storedTokenExpires is already a Date object from the toAdapterUser conversion.
        return {
            identifier: email,
            token: storedToken, 
            expires: storedTokenExpires // This is already a Date object
        } as VerificationToken;
      } catch (error) {
        console.error("DynamoDBAdapter: useVerificationToken error marking email verified", error);
        throw error;
      }
    },
    async getUserByPasswordResetToken(token: string): Promise<CustomAdapterUser | null> {
      console.log("DynamoDBAdapter: getUserByPasswordResetToken", token.substring(0, 10) + "...");
      const scanParams: AWS.DynamoDB.DocumentClient.ScanInput = {
        TableName: DYNAMODB_USERS_TABLE,
        FilterExpression: 'passwordResetToken = :token',
        ExpressionAttributeValues: {
          ':token': token
        }
      };
      try {
        const result = await dynamoDb.scan(scanParams).promise();
        if (!result.Items || result.Items.length === 0) {
          console.log("DynamoDBAdapter: No user found with password reset token");
          return null;
        }
        if (result.Items.length > 1) {
          console.warn(`DynamoDBAdapter: Multiple users found with same password reset token: ${result.Items.length}`);
        }
        const userItem = result.Items[0];
        console.log("DynamoDBAdapter: Found user with password reset token:", userItem.email);
        return toAdapterUser(userItem);
      } catch (error) {
        console.error("DynamoDBAdapter: Error scanning for user by password reset token:", error);
        throw error;
      }
    },
  };
} 