import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/../auth';
// import clientPromise from '@/lib/mongodb'; // No longer needed for project data
// import { ObjectId, Collection, Document as MongoDocument } from 'mongodb'; // No longer needed for project data
import { s3, dynamoDb, S3_PROJECT_DATA_BUCKET, S3_BACKGROUND_IMAGES_BUCKET, S3_THUMBNAILS_BUCKET, DYNAMODB_PROJECTS_TABLE } from '@/lib/aws-config';
// REMOVED: getCdnUrl import - no longer using CloudFront for any content in this route
import type { DocumentClient } from 'aws-sdk/lib/dynamodb/document_client'; // Import DocumentClient specific types

// Define the structure of a Project item expected from DynamoDB
interface ProjectDynamoDBItem {
  userId: string;
  projectId: string;
  name: string;
  projectData: {
    midiDataS3Key?: string | null; // Adjusted to match save route
    bpm: number;
    timeSignature: { numerator: number, denominator: number };
    textAnnotationsS3Key?: string | null; // Adjusted to match save route
    bundledProjectDataS3Key?: string | null; // NEW: Combined data file key
  };
  appearance: {
    backgroundImageS3Key?: string | null;
    customColors?: { leftHand: string, rightHand: string } | null;
  };
  thumbnailS3Key?: string | null;
  dateCreated: string;
  dateModified: string;
}

// Structure of the project object to be returned to the client
interface ClientProject extends ProjectDynamoDBItem { // Inherit base structure
  // Add fields for public CDN URLs
  bundledDataUrl?: string | null; // NEW: Single URL containing both midiData and textAnnotations
  midiDataUrl?: string | null;
  textAnnotationsUrl?: string | null;
  backgroundImageUrl?: string | null;
  thumbnailUrl?: string | null;
}

// Generate optimized URLs based on content type
async function getOptimizedUrl(bucket: string, key: string | undefined | null): Promise<string | null> {
  if (!key) return null;

  try {
    // For project data, thumbnails, AND background images: Use S3 signed URLs with short expiration
    // Project data changes on every save, thumbnails regenerate on every save
    // Background images now also use signed URLs to avoid CloudFront caching issues
    if (bucket === S3_PROJECT_DATA_BUCKET || bucket === S3_THUMBNAILS_BUCKET || bucket === S3_BACKGROUND_IMAGES_BUCKET) {
      const signedUrl = await s3.getSignedUrlPromise('getObject', {
        Bucket: bucket,
        Key: key,
        Expires: 900, // 15 minutes - long enough for loading, short enough to stay fresh
      });
      return signedUrl;
    }

    // Fallback for unknown buckets
    console.error(`Unknown bucket provided to getOptimizedUrl: ${bucket}`);
    return `https://${bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

  } catch (error) {
    console.error(`Error generating optimized URL for ${key} in ${bucket}:`, error);
    // Fallback to direct S3 URL
    return `https://${bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Add LastEvaluatedKey handling for pagination
    const { pageSize = '20', lastEvaluatedKey } = Object.fromEntries(new URL(req.url).searchParams);

    const dynamoParams: DocumentClient.QueryInput = {
      TableName: DYNAMODB_PROJECTS_TABLE,
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: {
        ':uid': userId,
      },
      Limit: parseInt(pageSize as string),
      ScanIndexForward: false,
      ...(lastEvaluatedKey && { ExclusiveStartKey: JSON.parse(lastEvaluatedKey as string) })
    };

    const result = await dynamoDb.query(dynamoParams).promise();
    
    // When using DocumentClient, result.Items are already unmarshalled JS objects
    let userProjectsDynamo: ProjectDynamoDBItem[] = (result.Items || []).map(item => ({
      userId: item.userId as string, // Direct access
      projectId: item.projectId as string, // Direct access
      name: item.name as string, // Direct access
      projectData: {
        midiDataS3Key: item.projectData?.midiDataS3Key || null,
        bpm: item.projectData?.bpm !== undefined ? Number(item.projectData.bpm) : 120, // Default if null/undefined
        timeSignature: {
          numerator: item.projectData?.timeSignature?.numerator !== undefined ? Number(item.projectData.timeSignature.numerator) : 4,
          denominator: item.projectData?.timeSignature?.denominator !== undefined ? Number(item.projectData.timeSignature.denominator) : 4,
        },
        textAnnotationsS3Key: item.projectData?.textAnnotationsS3Key || null,
        bundledProjectDataS3Key: item.projectData?.bundledProjectDataS3Key || null,
      },
      appearance: {
        backgroundImageS3Key: item.appearance?.backgroundImageS3Key || null,
        customColors: item.appearance?.customColors ? {
          leftHand: item.appearance.customColors.leftHand,
          rightHand: item.appearance.customColors.rightHand,
        } : null,
      },
      thumbnailS3Key: item.thumbnailS3Key || null,
      dateCreated: item.dateCreated as string, // Direct access
      dateModified: item.dateModified as string, // Direct access
    }));

    userProjectsDynamo.sort((a, b) => new Date(b.dateModified).getTime() - new Date(a.dateModified).getTime());

    // Process URLs in parallel for better performance
    const clientProjects: ClientProject[] = await Promise.all(
      userProjectsDynamo.map(async (p) => {
        // NEW: Check if project uses bundled data (more efficient)
        if (p.projectData.bundledProjectDataS3Key) {
          // Use bundled data - single HTTP request instead of 2-3
          const [bundledDataUrl, backgroundImageUrl, thumbnailUrl] = await Promise.all([
            getOptimizedUrl(S3_PROJECT_DATA_BUCKET, p.projectData.bundledProjectDataS3Key),
            getOptimizedUrl(S3_BACKGROUND_IMAGES_BUCKET, p.appearance.backgroundImageS3Key),
            getOptimizedUrl(S3_THUMBNAILS_BUCKET, p.thumbnailS3Key),
          ]);

          return {
            ...p,
            bundledDataUrl, // NEW: Single URL for both midiData and textAnnotations
            midiDataUrl: null, // These will be null when using bundled data
            textAnnotationsUrl: null,
            backgroundImageUrl,
            thumbnailUrl,
          };
        } else {
          // Fallback to separate files (existing logic)
        const [midiDataUrl, textAnnotationsUrl, backgroundImageUrl, thumbnailUrl] = await Promise.all([
            getOptimizedUrl(S3_PROJECT_DATA_BUCKET, p.projectData.midiDataS3Key),
            getOptimizedUrl(S3_PROJECT_DATA_BUCKET, p.projectData.textAnnotationsS3Key),
            getOptimizedUrl(S3_BACKGROUND_IMAGES_BUCKET, p.appearance.backgroundImageS3Key),
            getOptimizedUrl(S3_THUMBNAILS_BUCKET, p.thumbnailS3Key),
        ]);

        return {
          ...p,
            bundledDataUrl: null, // No bundled data for older projects
          midiDataUrl,
          textAnnotationsUrl,
          backgroundImageUrl,
          thumbnailUrl,
        };
        }
      })
    );

    return NextResponse.json({ 
      projects: clientProjects,
      lastEvaluatedKey: result.LastEvaluatedKey ? JSON.stringify(result.LastEvaluatedKey) : null
    }, { status: 200 });

  } catch (error) {
    console.error('Error loading projects:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: 'Error loading projects', error: errorMessage }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
} 