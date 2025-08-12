import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { dynamoDb, DYNAMODB_USERS_TABLE, DYNAMODB_BETA_CODES_TABLE } from '@/lib/aws-config';
import { DynamoDBAdapter, CustomAdapterUser } from '@/lib/dynamodb-adapter';

// This file implements the API endpoint for verifying single-use beta codes.

export async function POST(req: Request) {
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
        return NextResponse.json({ error: 'You must be logged in to verify a beta code.' }, { status: 401 });
    }

    const userId = session.user.id;
    let code: string;

    try {
        const body = await req.json();
        const rawCode: string = body.code;
        if (!rawCode || typeof rawCode !== 'string' || rawCode.trim() === '') {
            return NextResponse.json({ error: 'Beta code is required.' }, { status: 400 });
        }
        // Normalize the code to be uppercase and trimmed.
        code = rawCode.trim().toUpperCase();
    } catch (error) {
        return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    
    // Check if the user already has access (either paid or already beta approved)
    // We instantiate the adapter to use its internal helpers
    const adapter = DynamoDBAdapter();
    const currentUser = await adapter.getUser!(userId) as CustomAdapterUser | null;

    if (!currentUser) {
         return NextResponse.json({ error: 'Current user not found.' }, { status: 404 });
    }

    if (currentUser.hasPaid) {
        return NextResponse.json({ message: 'Access already granted. No need to use a beta code.' }, { status: 200 });
    }

    const transactParams = {
        TransactItems: [
            {
                // First, attempt to claim the beta code.
                // This will fail if the code doesn't exist or is already used.
                Update: {
                    TableName: DYNAMODB_BETA_CODES_TABLE,
                    Key: { code: code },
                    ConditionExpression: 'attribute_exists(code) AND (attribute_not_exists(isUsed) OR isUsed = :isUsedFalse)',
                    UpdateExpression: 'SET isUsed = :isUsedTrue, usedByUserId = :userId, dateUsed = :dateUsed',
                    ExpressionAttributeValues: {
                        ':isUsedFalse': false,
                        ':isUsedTrue': true,
                        ':userId': userId,
                        ':dateUsed': new Date().toISOString(),
                    },
                },
            },
            {
                // Second, update the user record to grant beta access.
                // This part of the transaction will only run if the first part succeeds.
                Update: {
                    TableName: DYNAMODB_USERS_TABLE,
                    Key: { id: userId },
                    UpdateExpression: 'SET hasPaid = :hasPaid, activePlans = list_append(if_not_exists(activePlans, :empty_list), :newPlans), dateModified = :dateModified',
                    ExpressionAttributeValues: {
                        ':hasPaid': true,
                        ':newPlans': ['tier2'],
                        ':dateModified': new Date().toISOString(),
                        ':empty_list': [],
                    },
                },
            },
        ],
    };

    try {
        await dynamoDb.transactWrite(transactParams).promise();
        
        // On success, return the data that the client session should be updated with.
        const newSessionData = {
            hasPaid: true,
            activePlans: ['tier2']
        };

        return NextResponse.json({ 
            success: true, 
            message: 'Beta code successfully applied! You now have full access.',
            data: newSessionData 
        }, { status: 200 });
    } catch (error: any) {
        console.error('Beta code transaction failed:', error);
        
        // If the transaction was cancelled, it's likely due to our condition check failing.
        // This is the expected behavior for an invalid or already-used code.
        if (error.name === 'TransactionCanceledException') {
            return NextResponse.json({ error: 'This beta code is invalid or has already been used.' }, { status: 400 });
        }

        // For any other type of error, return a generic server error.
        return NextResponse.json({ error: 'An unexpected error occurred. Please try again later.' }, { status: 500 });
    }
} 