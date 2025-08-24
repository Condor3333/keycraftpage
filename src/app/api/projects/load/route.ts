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
        Expires: 3600, // 1 hour - long enough for extended browsing sessions
      });
      return signedUrl;
    }

    // Fallback for unknown buckets
    console.error(`Unknown bucket provided to getOptimizedUrl: ${bucket}`);
    return `https://${bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

  } catch (error) {
    console.error(`Error generating optimized URL for ${key} in ${bucket}:`, error);
    // Fallback to direct S3 URL (this will work if the bucket allows public access)
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
    // Use consistent pagination for all tiers to control costs
    const { pageSize = '20', lastEvaluatedKey } = Object.fromEntries(new URL(req.url).searchParams);
    
    console.log('User session data:', {
      hasPaid: session.user.hasPaid,
      activePlans: (session.user as any).activePlans,
      userId: session.user.id,
      pageSize: pageSize,
      lastEvaluatedKey: lastEvaluatedKey,
      lastEvaluatedKeyType: typeof lastEvaluatedKey
    });

    // Try to use GSI first, fall back to main table if it fails
    let useGSI = true;
    console.log('Attempting to use GSI for pagination');

    console.log('DynamoDB query params:', {
      tableName: DYNAMODB_PROJECTS_TABLE,
      indexName: useGSI ? 'userId-dateModified-index' : 'main-table',
      userId: userId,
      pageSize: pageSize,
      scanIndexForward: false,
      hasLastEvaluatedKey: !!lastEvaluatedKey,
      useGSI: useGSI
    });

    if (useGSI) {
      // Use GSI for proper date-based pagination
      const dynamoParams: DocumentClient.QueryInput = {
        TableName: DYNAMODB_PROJECTS_TABLE,
        IndexName: 'userId-dateModified-index',
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: {
          ':uid': userId,
        },
        ScanIndexForward: false, // Most recent first
        Limit: parseInt(pageSize as string)
      };
      
      // Add LastEvaluatedKey for pagination
      if (lastEvaluatedKey) {
        try {
          const parsedKey = JSON.parse(lastEvaluatedKey as string);
          dynamoParams.ExclusiveStartKey = parsedKey;
        } catch (error) {
          console.log('Failed to parse LastEvaluatedKey, falling back to main table:', error);
          useGSI = false;
        }
      }
      
      try {
        const result = await dynamoDb.query(dynamoParams).promise();
        const gsiProjects = result.Items || [];
        
        console.log('GSI query result:', {
          itemsCount: gsiProjects.length,
          lastEvaluatedKey: result.LastEvaluatedKey ? 'present' : 'none',
          scannedCount: result.ScannedCount,
          count: result.Count
        });
        
        // Process GSI results
        let userProjectsDynamo: ProjectDynamoDBItem[] = gsiProjects.map(item => ({
          userId: item.userId as string,
          projectId: item.projectId as string,
          name: item.name as string,
          projectData: {
            midiDataS3Key: item.projectData?.midiDataS3Key || null,
            bpm: item.projectData?.bpm !== undefined ? Number(item.projectData.bpm) : 120,
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
          dateCreated: item.dateCreated as string,
          dateModified: item.dateModified as string,
        }));
        
        // Process URLs in parallel for better performance
        const clientProjects: ClientProject[] = await Promise.all(
          userProjectsDynamo.map(async (project) => ({
            ...project,
            bundledDataUrl: await getOptimizedUrl(S3_PROJECT_DATA_BUCKET, project.projectData.bundledProjectDataS3Key),
            midiDataUrl: await getOptimizedUrl(S3_PROJECT_DATA_BUCKET, project.projectData.midiDataS3Key),
            textAnnotationsUrl: await getOptimizedUrl(S3_PROJECT_DATA_BUCKET, project.projectData.textAnnotationsS3Key),
            backgroundImageUrl: await getOptimizedUrl(S3_BACKGROUND_IMAGES_BUCKET, project.appearance.backgroundImageS3Key),
            thumbnailUrl: await getOptimizedUrl(S3_THUMBNAILS_BUCKET, project.thumbnailS3Key),
          }))
        );
        
        return NextResponse.json({ 
          projects: clientProjects,
          lastEvaluatedKey: result.LastEvaluatedKey ? JSON.stringify(result.LastEvaluatedKey) : null
        }, { status: 200 });
        
      } catch (error) {
        console.log('GSI query failed, falling back to main table:', error);
        useGSI = false;
      }
    }
    
    // Fallback to main table pagination
    const dynamoParams: DocumentClient.QueryInput = {
      TableName: DYNAMODB_PROJECTS_TABLE,
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: {
        ':uid': userId,
      }
    };
    
    // Get all projects for this user (we need to sort by dateModified)
    const result = await dynamoDb.query(dynamoParams).promise();
    const allProjects = result.Items || [];
    
    console.log('Main table query result:', {
      totalItemsCount: allProjects.length,
      scannedCount: result.ScannedCount,
      count: result.Count
    });

    // Sort all projects by dateModified (newest first)
    allProjects.sort((a, b) => new Date(b.dateModified).getTime() - new Date(a.dateModified).getTime());
    
    // Implement proper backend pagination for main table fallback
    const pageSizeNum = parseInt(pageSize as string);
    let currentPage = 0;
    
    // Parse the lastEvaluatedKey - it should be a page number string
    if (lastEvaluatedKey) {
      try {
        currentPage = parseInt(lastEvaluatedKey as string);
        console.log('Parsed currentPage from lastEvaluatedKey:', currentPage);
      } catch (error) {
        console.log('Failed to parse lastEvaluatedKey as page number:', lastEvaluatedKey);
        currentPage = 0;
      }
    }
    
    const startIndex = currentPage * pageSizeNum;
    const endIndex = startIndex + pageSizeNum;
    
    const paginatedProjects = allProjects.slice(startIndex, endIndex);
    const hasMore = endIndex < allProjects.length;
    const nextPage = hasMore ? currentPage + 1 : null;
    
    console.log('Main table fallback pagination:', {
      totalProjects: allProjects.length,
      currentPage: currentPage,
      startIndex: startIndex,
      endIndex: endIndex,
      paginatedCount: paginatedProjects.length,
      hasMore: hasMore,
      nextPage: nextPage,
      firstProjectInPage: paginatedProjects[0]?.name,
      lastProjectInPage: paginatedProjects[paginatedProjects.length - 1]?.name
    });
    
    // When using DocumentClient, result.Items are already unmarshalled JS objects
    let userProjectsDynamo: ProjectDynamoDBItem[] = paginatedProjects.map(item => ({
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

    // Projects are already sorted by dateModified above

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
      lastEvaluatedKey: nextPage ? nextPage.toString() : null
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
