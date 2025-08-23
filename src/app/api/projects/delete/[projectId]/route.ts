import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/../auth';
// import clientPromise from '@/lib/mongodb'; // No longer needed
// import { ObjectId } from 'mongodb'; // No longer needed
import { s3, dynamoDb, S3_PROJECT_DATA_BUCKET, S3_BACKGROUND_IMAGES_BUCKET, S3_THUMBNAILS_BUCKET, DYNAMODB_PROJECTS_TABLE } from '@/lib/aws-config';
import { DeleteObjectRequest, DeleteObjectsRequest } from 'aws-sdk/clients/s3';
import AWS from 'aws-sdk'; // Import AWS namespace
import { z } from 'zod'; // Added Zod

// Define Zod schema for params
const DeleteParamsSchema = z.object({
  projectId: z.string().uuid("Invalid Project ID format. Must be a UUID."),
});

// Define Zod schema for user session validation
const UserSessionSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  hasPaid: z.boolean(),
  activePlans: z.array(z.string()).optional(),
});

// Define the structure of a Project item expected from DynamoDB (to get S3 keys for deletion)
interface ProjectDynamoDBItem {
    userId: string;
    projectId: string;
    projectData?: {
        midiDataS3Key?: string;
        textAnnotationsS3Key?: string;
    };
    appearance?: {
        backgroundImageS3Key?: string | null;
    };
    thumbnailS3Key?: string | null;
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    // 1. Authentication validation
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // 2. Validate user session with Zod
    const userValidation = UserSessionSchema.safeParse({
      userId: session.user.id,
      hasPaid: session.user.hasPaid === true,
      activePlans: session.user.activePlans,
    });

    if (!userValidation.success) {
      return NextResponse.json({ 
        error: "Invalid user session", 
        details: userValidation.error.errors 
      }, { status: 400 });
    }

    const { userId } = userValidation.data;

    // 3. Validate route parameters with Zod
    const params = await context.params;
    
    // Log the received params object for debugging
    console.log("[API Delete Project] Received params:", JSON.stringify(params));

    const paramsValidationResult = DeleteParamsSchema.safeParse({ projectId: params.projectId });
    if (!paramsValidationResult.success) {
      return NextResponse.json(
        { message: "Invalid request parameters.", errors: paramsValidationResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { projectId } = paramsValidationResult.data; // Use validated projectId

    // 1. Get the project from DynamoDB to retrieve S3 keys
    const getParams: AWS.DynamoDB.DocumentClient.GetItemInput = {
        TableName: DYNAMODB_PROJECTS_TABLE,
        Key: { userId, projectId },
    };
    const projectResult = await dynamoDb.get(getParams).promise();
    const projectItem = projectResult.Item as ProjectDynamoDBItem | undefined;

    let s3ObjectsToDelete: { Key: string }[] = [];

    if (projectItem) {
        if (projectItem.projectData?.midiDataS3Key) {
            s3ObjectsToDelete.push({ Key: projectItem.projectData.midiDataS3Key });
        }
        if (projectItem.projectData?.textAnnotationsS3Key) {
            s3ObjectsToDelete.push({ Key: projectItem.projectData.textAnnotationsS3Key });
        }
        if (projectItem.appearance?.backgroundImageS3Key) {
            s3ObjectsToDelete.push({ Key: projectItem.appearance.backgroundImageS3Key });
        }
        if (projectItem.thumbnailS3Key) {
            s3ObjectsToDelete.push({ Key: projectItem.thumbnailS3Key });
        }
    }
    
    // 2. Delete objects from S3 if any keys were found
    // Note: S3 deleteObjects can handle up to 1000 keys per request.
    // For simplicity, we assume fewer keys per project. If more, batching is needed.
    
    // Deleting from multiple buckets if necessary. S3 batch delete is per-bucket.
    const deletePromises: Promise<any>[] = [];

    if (projectItem?.projectData?.midiDataS3Key) {
        deletePromises.push(s3.deleteObject({ Bucket: S3_PROJECT_DATA_BUCKET, Key: projectItem.projectData.midiDataS3Key }).promise());
    }
    if (projectItem?.projectData?.textAnnotationsS3Key) {
        deletePromises.push(s3.deleteObject({ Bucket: S3_PROJECT_DATA_BUCKET, Key: projectItem.projectData.textAnnotationsS3Key }).promise());
    }
    if (projectItem?.appearance?.backgroundImageS3Key) {
        deletePromises.push(s3.deleteObject({ Bucket: S3_BACKGROUND_IMAGES_BUCKET, Key: projectItem.appearance.backgroundImageS3Key }).promise());
    }
    if (projectItem?.thumbnailS3Key) {
        deletePromises.push(s3.deleteObject({ Bucket: S3_THUMBNAILS_BUCKET, Key: projectItem.thumbnailS3Key }).promise());
    }

    if (deletePromises.length > 0) {
        try {
            await Promise.all(deletePromises);
            console.log(`S3 objects for project ${projectId} deleted successfully.`);
        } catch (s3Error) {
            console.error(`Error deleting some S3 objects for project ${projectId}:`, s3Error);
            // Decide if you want to proceed with DynamoDB deletion or return an error
            // For now, we'll log and proceed.
        }
    }

    // 3. Delete the item from DynamoDB
    const dynamoParams: AWS.DynamoDB.DocumentClient.DeleteItemInput = {
      TableName: DYNAMODB_PROJECTS_TABLE,
      Key: {
        userId: userId,
        projectId: projectId,
      },
      ReturnValues: 'ALL_OLD' // Optional: To see what was deleted
    };

    const deleteResult = await dynamoDb.delete(dynamoParams).promise();

    if (deleteResult.Attributes) {
      console.log(`Project ${projectId} deleted successfully from DynamoDB.`);
      return NextResponse.json({ message: 'Project deleted successfully' }, { status: 200 });
    } else {
      // This means the item was not found, which might be okay if S3 objects were cleaned up
      // or if it was already deleted.
      console.log(`Project ${projectId} not found in DynamoDB for deletion, or already deleted.`);
      return NextResponse.json({ message: 'Project not found or already deleted' }, { status: 404 }); 
    }

  } catch (error) {
    console.error('Error deleting project:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: 'Error deleting project', error: errorMessage }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
} 