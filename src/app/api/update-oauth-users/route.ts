import { NextResponse } from "next/server";
import AWS from 'aws-sdk';
import { DYNAMODB_USERS_TABLE } from '@/lib/aws-config';

// This is a one-time utility endpoint to add payment fields to existing OAuth users
// You can run this once and then remove or protect this endpoint
export async function GET(req: Request) {
  try {
    // Simple API key protection - add ADMIN_API_KEY to your .env file
    const apiKey = req.headers.get('x-api-key');
    if (apiKey !== process.env.ADMIN_API_KEY && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Connect to DynamoDB
    const dynamoDb = new AWS.DynamoDB.DocumentClient();

    // Scan for OAuth users without payment fields (no hashedPassword means they're OAuth users)
    const scanParams = {
      TableName: DYNAMODB_USERS_TABLE,
      FilterExpression: 'attribute_not_exists(hashedPassword) AND (attribute_not_exists(hasPaid) OR attribute_not_exists(activePlans))'
    };

    const scanResult = await dynamoDb.scan(scanParams).promise();
    const oauthUsersToUpdate = scanResult.Items || [];

    // Find OAuth users without payment fields
    const usersToUpdate = oauthUsersToUpdate.filter(user => 
      !user.hashedPassword && (!user.hasPaid || !user.activePlans)
    );

    // Updated count message
    const updatedCount = usersToUpdate.length;

    // Update each user - EXPLICITLY set hasPaid to false
    for (const user of usersToUpdate) {
      const updateParams = {
        TableName: DYNAMODB_USERS_TABLE,
        Key: { id: user.id },
        UpdateExpression: 'SET hasPaid = :hasPaid, activePlans = :activePlans',
        ExpressionAttributeValues: {
          ':hasPaid': false,  // Explicitly false for migration
          ':activePlans': []  // Empty array for migration
        }
      };
      
             try {
         await dynamoDb.update(updateParams).promise();
         // User updated successfully
       } catch {
         // Error updating individual user
       }
    }

    // Log all users and their payment status for debugging
    const allUsersResult = await dynamoDb.scan({
      TableName: DYNAMODB_USERS_TABLE,
      ProjectionExpression: 'email, hasPaid'
    }).promise();

         // User payment status logged for debugging

    return NextResponse.json({
      success: true,
      message: `Updated ${updatedCount} OAuth users with payment fields`,
      updatedUsers: usersToUpdate.map(u => u.email)
    });
  } catch (error) {
    // Error updating OAuth users
    return NextResponse.json({ 
      error: "Failed to update OAuth users", 
      message: (error as Error).message 
    }, { status: 500 });
  }
} 