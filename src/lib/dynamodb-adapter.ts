import { Adapter, AdapterUser, AdapterSession, VerificationToken } from 'next-auth/adapters';
import { dynamoDb, DYNAMODB_USERS_TABLE } from './aws-config';
import type {
    GetItemInput,
    UpdateItemInput,
    DeleteItemInput,
    QueryInput as BaseQueryInput,
    PutItemInput as BasePutItemInput
} from 'aws-sdk/clients/dynamodb';
import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

// Custom User type that extends AdapterUser for our specific fields
export interface CustomAdapterUser extends AdapterUser {
    name?: string | null;
    image?: string | null;
    hashedPassword?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    hasPaid?: boolean;
    activePlans?: string[];
    emailVerificationToken?: string | null;
    emailVerificationTokenExpires?: Date | null;
    passwordResetToken?: string | null;
    passwordResetExpires?: Date | null;
    status?: string;
    dateCreated?: string;
    dateModified?: string;
    sessions?: AdapterSession[];
    transcriptionCount?: number;
    transcriptionMonth?: string;
    midiDownloads?: {
        count: number;
        resetDate: string;
        lastDownloadDate: string;
        totalDownloads: number;
    };
}

interface CustomDynamoDBAdapter extends Adapter {
    getUserByEmailVerificationToken(token: string): Promise<CustomAdapterUser | null>;
    getUserByPasswordResetToken(token: string): Promise<CustomAdapterUser | null>;
    initializeMidiDownloads(userId: string): Promise<void>;
}

// AdapterUser fields that NextAuth expects
const toAdapterUser = (item: Record<string, any> | null): CustomAdapterUser | null => {
    if (!item) return null;
    return {
        id: item.id as string,
        email: item.email as string,
        emailVerified: item.emailVerified ? new Date(item.emailVerified as string) : null,
        emailVerificationTokenExpires: item.emailVerificationTokenExpires ? new Date(item.emailVerificationTokenExpires as string) : null,
        passwordResetExpires: item.passwordResetExpires ? new Date(item.passwordResetExpires as string) : null,
        expires: item.expires ? new Date(item.expires as string) : undefined,
        ...item,
    } as CustomAdapterUser;
};

export function DynamoDBAdapter(): CustomDynamoDBAdapter {
  const AdapterInternals = {
    _getUserById: async (id: string): Promise<CustomAdapterUser | null> => {
        const params: AWS.DynamoDB.DocumentClient.GetItemInput = {
            TableName: DYNAMODB_USERS_TABLE,
            Key: { id: id }
        };
        const result = await dynamoDb.get(params).promise();
        return toAdapterUser(result.Item || null);
    },
    _getUserByEmail: async (email: string): Promise<CustomAdapterUser | null> => {
        const params: AWS.DynamoDB.DocumentClient.QueryInput = {
            TableName: DYNAMODB_USERS_TABLE,
            IndexName: 'Email-Index',
            KeyConditionExpression: 'email = :email',
            ExpressionAttributeValues: { ':email': email.toLowerCase() },
        };
        const result = await dynamoDb.query(params).promise();
        if (!result.Items || result.Items.length === 0) return null;
        return toAdapterUser(result.Items[0] || null);
    },
    _updateUser: async (user: Partial<CustomAdapterUser> & Pick<CustomAdapterUser, "id">): Promise<AdapterUser | null> => {
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
            if (val instanceof Date) {
                expressionAttributeValues[attrValue] = val.toISOString();
            } else {
                expressionAttributeValues[attrValue] = val;
            }
            i++;
        }
      
        const params: AWS.DynamoDB.DocumentClient.UpdateItemInput = {
          TableName: DYNAMODB_USERS_TABLE,
          Key: { id: id },
          UpdateExpression: updateExpression,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
          ReturnValues: 'ALL_NEW',
        };
      
        try {
          const result = await dynamoDb.update(params).promise();
          return toAdapterUser(result.Attributes || null); 
        } catch (error) {
          throw error;
        }
    },
    _deleteSession: async (sessionToken: string): Promise<void> => {
        const scanResult = await dynamoDb.scan({ TableName: DYNAMODB_USERS_TABLE }).promise();
        if (scanResult.Items) {
            for (const item of scanResult.Items) {
                const user = toAdapterUser(item);
                if (user && user.id && user.sessions) {
                    const initialLength = user.sessions.length;
                    const updatedSessions = user.sessions.filter(s => s.sessionToken !== sessionToken);
                    if (updatedSessions.length < initialLength) {
                        await AdapterInternals._updateUser({
                            id: user.id,
                            sessions: updatedSessions,
                        } as Partial<CustomAdapterUser> & Pick<CustomAdapterUser, "id">);
                        return; 
                    }
                }
            }
        }
    },
  };

  return {
    async createUser(user) {
      const userId = user.id || uuidv4();
      const now = new Date();
      
      const userData: CustomAdapterUser = {
        id: userId,
        email: user.email.toLowerCase(),
        name: user.name,
        image: user.image,
        emailVerified: user.emailVerified instanceof Date ? user.emailVerified : null,
        status: (user as any).status || 'pending_verification',
        hasPaid: (user as any).hasPaid === undefined ? false : (user as any).hasPaid,
        activePlans: (user as any).activePlans || [],
        sessions: [],
        dateCreated: now.toISOString(),
        dateModified: now.toISOString(),
        midiDownloads: {
          count: 0,
          resetDate: now.toISOString(),
          lastDownloadDate: now.toISOString(),
          totalDownloads: 0
        }
      };
      
      if ((user as any).firstName) userData.firstName = (user as any).firstName;
      if ((user as any).lastName) userData.lastName = (user as any).lastName;
      if ((user as any).hashedPassword) userData.hashedPassword = (user as any).hashedPassword;

      const params: AWS.DynamoDB.DocumentClient.PutItemInput = {
        TableName: DYNAMODB_USERS_TABLE,
        Item: userData,
        ConditionExpression: 'attribute_not_exists(id)',
      };
      try {
        await dynamoDb.put(params).promise();
        return userData;
      } catch (error: any) {
        if (error.code === 'ConditionalCheckFailedException') {
          // User creation failed - duplicate ID or email
        }
        throw error;
      }
    },
    async getUser(id) {
      try {
        return await AdapterInternals._getUserById(id);
      } catch (error) {
        return null;
      }
    },
    async getUserByEmail(email) {
      try {
        return await AdapterInternals._getUserByEmail(email);
      } catch (error) {
        return null;
      }
    },
    async updateUser(user) {
        try {
            const result = await AdapterInternals._updateUser(user);
            if (!result) {
                throw new Error("Failed to update user");
            }
            return result;
        } catch (error) {
            throw error;
        }
    },
    async deleteUser(userId) {
      const params: AWS.DynamoDB.DocumentClient.DeleteItemInput = {
        TableName: DYNAMODB_USERS_TABLE,
        Key: { id: userId },
        ReturnValues: 'ALL_OLD' 
      };
      try {
        const result = await dynamoDb.delete(params).promise();
        return toAdapterUser(result.Attributes || null);
      } catch (error) {
        return null;
      }
    },
    async createSession(sessionInput: { userId: string; sessionToken: string; expires: Date }): Promise<AdapterSession> {
        const { userId, sessionToken, expires } = sessionInput;
        
        const newSessionData = {
            sessionToken, 
            userId,
            expires,
            id: sessionToken 
        } as AdapterSession;

        const user = await AdapterInternals._getUserById(userId);
        if (!user) throw new Error (`User ${userId} not found to create session`);
        const currentSessions = user.sessions || [];
        const updatedSessions = [...currentSessions, newSessionData];

        const params: AWS.DynamoDB.DocumentClient.UpdateItemInput = {
            TableName: DYNAMODB_USERS_TABLE,
            Key: { id: userId },
            UpdateExpression: 'SET sessions = :sessions, dateModified = :now',
            ExpressionAttributeValues: {
                ':sessions': updatedSessions.map(s => ({...s, expires: s.expires.toISOString()})),
                ':now': new Date().toISOString(),
            },
        };
        try {
            await dynamoDb.update(params).promise();
            return sessionInput;
        } catch (error) {
            throw error;
        }
    },
    async getSessionAndUser(sessionToken) {
        const scanResult = await dynamoDb.scan({ TableName: DYNAMODB_USERS_TABLE }).promise();
        if (!scanResult.Items) return null;

        for (const item of scanResult.Items) {
            const user = toAdapterUser(item);
            if (user && user.sessions) {
                const session = user.sessions.find(s => s.sessionToken === sessionToken);
                if (session) {
                    if (session.expires < new Date()) { 
                        await AdapterInternals._deleteSession(sessionToken);
                        return null;
                    }
                    return { session, user } as { session: AdapterSession; user: AdapterUser };
                }
            }
        }
        return null;
    },
    async updateSession(sessionUpdate: Partial<AdapterSession> & Pick<AdapterSession, "sessionToken">): Promise<AdapterSession | null | undefined> {
        const { sessionToken, userId, expires } = sessionUpdate;
        
        const scanResult = await dynamoDb.scan({ TableName: DYNAMODB_USERS_TABLE }).promise();
        if (!scanResult.Items) return null;

        for (const item of scanResult.Items) {
            const user = toAdapterUser(item);
            if (user && user.sessions) {
                const sessionIndex = user.sessions.findIndex(s => s.sessionToken === sessionToken);
                if (sessionIndex > -1) {
                    const updatedSessions = [...user.sessions];
                    if (userId) updatedSessions[sessionIndex].userId = userId;
                    if (expires) updatedSessions[sessionIndex].expires = expires;

                    await AdapterInternals._updateUser({
                        id: user.id,
                        sessions: updatedSessions,
                    } as Partial<CustomAdapterUser> & Pick<CustomAdapterUser, "id">);
                    
                    return updatedSessions[sessionIndex];
                }
            }
        }
        return null;
    },
    async deleteSession(sessionToken) {
        await AdapterInternals._deleteSession(sessionToken);
    },
    async createVerificationToken(verificationToken) {
        const params: AWS.DynamoDB.DocumentClient.PutItemInput = {
            TableName: DYNAMODB_USERS_TABLE,
            Item: {
                id: verificationToken.token,
                identifier: verificationToken.identifier,
                token: verificationToken.token,
                expires: verificationToken.expires.toISOString(),
            },
        };
        try {
            await dynamoDb.put(params).promise();
            return verificationToken;
        } catch (error) {
            throw error;
        }
    },
    async useVerificationToken(params) {
        const { identifier, token } = params;
        
        const scanResult = await dynamoDb.scan({ TableName: DYNAMODB_USERS_TABLE }).promise();
        if (!scanResult.Items) return null;

        for (const item of scanResult.Items) {
            if (item.token === token && item.identifier === identifier) {
                // Delete the token
                const deleteParams: AWS.DynamoDB.DocumentClient.DeleteItemInput = {
                    TableName: DYNAMODB_USERS_TABLE,
                    Key: { id: token },
                };
                try {
                    await dynamoDb.delete(deleteParams).promise();
                    return {
                        identifier: item.identifier,
                        token: item.token,
                        expires: new Date(item.expires),
                    } as VerificationToken;
                } catch (error) {
                    throw error;
                }
            }
        }
        return null;
    },
    async getUserByEmailVerificationToken(token: string) {
        
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
                return null;
            }

            if (result.Items.length > 1) {
                // Multiple users found with same verification token
            }

            const userItem = result.Items[0];
            return toAdapterUser(userItem);
        } catch (error) {
            throw error;
        }
    },
    async getUserByPasswordResetToken(token: string): Promise<CustomAdapterUser | null> {
        
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
                return null;
            }

            if (result.Items.length > 1) {
                // Multiple users found with same password reset token
            }

            const userItem = result.Items[0];
            return toAdapterUser(userItem);
        } catch (error) {
            throw error;
        }
    },
    async initializeMidiDownloads(userId: string): Promise<void> {
        const user = await AdapterInternals._getUserById(userId);
        if (!user) {
            throw new Error(`User with ID ${userId} not found.`);
        }

        if (!user.midiDownloads) {
            await AdapterInternals._updateUser({
                id: userId,
                midiDownloads: {
                    count: 0,
                    resetDate: new Date().toISOString(),
                    lastDownloadDate: new Date().toISOString(),
                    totalDownloads: 0
                }
            } as Partial<CustomAdapterUser> & Pick<CustomAdapterUser, "id">);
        }
    }
  };
} 
