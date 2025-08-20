import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/../auth';
// import clientPromise from '@/lib/mongodb'; // No longer needed for project data
// import { ObjectId, Collection, Document as MongoDocument } from 'mongodb'; // No longer needed for project data
import { s3, dynamoDb, S3_PROJECT_DATA_BUCKET, S3_BACKGROUND_IMAGES_BUCKET, S3_THUMBNAILS_BUCKET, DYNAMODB_PROJECTS_TABLE } from '@/lib/aws-config'; // Import AWS clients and constants
import { PutObjectRequest } from 'aws-sdk/clients/s3';
import AWS from 'aws-sdk'; // Import AWS to access the namespace
import { z } from 'zod'; // ADDED: Import Zod
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);

// Zod Schemas for validation
const TimeSignatureSchema = z.object({
  numerator: z.number().int().min(1).max(32),
  denominator: z.number().int().min(1).max(32).refine(val => [1, 2, 4, 8, 16, 32].includes(val), {
    message: "Denominator must be a power of 2 (1, 2, 4, 8, 16, 32)"
  })
});

const CustomColorsSchema = z.object({
  leftHand: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color format for left hand"),
  rightHand: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color format for right hand")
}).nullable();

// Allow any structure for midiDataPayload and textAnnotationsPayload initially,
// as their internal structures are complex and client-generated.
// For production, you might want to define more granular schemas if possible.
const MidiDataPayloadSchema = z.any().optional();
const TextAnnotationsPayloadSchema = z.array(z.any()).optional().nullable();

// MODIFIED: Refined backgroundImagePayload and thumbnailPayload schemas
const ImagePayloadSchema = z.union([
  z.string().url().startsWith('https://', "Image URL must be HTTPS"), // Existing S3 URL
  z.string().startsWith('data:image/', "Invalid image data URL format") // New base64 data
]).nullable().optional();

const ProjectRequestBodySchema = z.object({
  id: z.string().uuid("Invalid project ID format (must be UUID)"),
  name: z.string().min(1, "Project name cannot be empty").max(100, "Project name too long"),
  midiDataPayload: MidiDataPayloadSchema,
  textAnnotationsPayload: TextAnnotationsPayloadSchema,
  backgroundImagePayload: ImagePayloadSchema, // Use the new union type
  thumbnailPayload: ImagePayloadSchema,     // Use the new union type for thumbnails too
  bpm: z.number().int().min(20, "BPM too low").max(300, "BPM too high"),
  timeSignature: TimeSignatureSchema,
  customColors: CustomColorsSchema,
  dateCreated: z.string().datetime({ message: "Invalid dateCreated format" }).optional(),
  backgroundImageHasChanged: z.boolean().optional(),
  thumbnailHasChanged: z.boolean().optional()
});

interface ProjectData {
  midiDataS3Key?: string | null; // Allow null
  bpm: number;
  timeSignature: { numerator: number, denominator: number };
  textAnnotationsS3Key?: string | null; // Allow null
  bundledProjectDataS3Key?: string | null; // Allow null
  // Add other relevant states like playbackSpeed if needed
}

interface AppearanceData {
  backgroundImageS3Key?: string | null; // Store S3 key
  customColors?: { leftHand: string, rightHand: string } | null;
}

// Define the structure of a Project item in DynamoDB
interface ProjectDynamoDBItem {
  userId: string; // Partition Key (User's ID from auth session)
  projectId: string; // Sort Key (Project's unique ID from client)
  name: string;
  projectData: ProjectData; // Will contain S3 keys
  appearance: AppearanceData; // Will contain S3 key for background
  thumbnailS3Key?: string | null; // S3 key for thumbnail
  dateCreated: string; // ISO String
  dateModified: string; // ISO String
}

interface ProjectRequestBody {
  id: string; // Project's unique ID from the client
  name: string;
  midiDataPayload?: any; 
  textAnnotationsPayload?: any[];
  backgroundImagePayload?: string | null | undefined; // Updated to allow undefined
  thumbnailPayload?: string | null | undefined; // Updated to allow undefined
  bpm: number;
  timeSignature: { numerator: number, denominator: number };
  customColors?: { leftHand: string, rightHand: string } | null;
  dateCreated?: string; // ISO date string from client for new projects
  backgroundImageHasChanged?: boolean;
  thumbnailHasChanged?: boolean;
}

// Helper function to upload to S3 with compression
const uploadToS3 = async (bucket: string, key: string, data: any, contentType: string): Promise<string> => {
  // Compress data if it's JSON
  let body = data;
  let contentEncoding;
  
  if (contentType === 'application/json') {
    const stringData = typeof data === 'string' ? data : JSON.stringify(data);
    body = await gzip(stringData);
    contentEncoding = 'gzip';
  }

  const s3Params: PutObjectRequest = {
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    ...(contentEncoding && { ContentEncoding: contentEncoding }),
    CacheControl: 'max-age=3600', // 1 hour cache
  };
  
  await s3.upload(s3Params).promise();
  console.log(`[Server Save S3] Successfully uploaded ${key} to ${bucket}`);
  return key;
};

// Helper function to delete from S3 with batching
const deleteFromS3 = async (bucket: string, key: string | undefined | null): Promise<void> => {
  if (!key) return;
  console.log(`[Server Save S3] Attempting to delete ${key} from bucket ${bucket}`);
  try {
    await s3.deleteObject({ Bucket: bucket, Key: key }).promise();
    console.log(`[Server Save S3] Successfully deleted ${key} from ${bucket}`);
  } catch (error) {
    console.error(`[Server Save S3] Failed to delete ${key} from ${bucket}:`, error);
  }
};

// Helper function to optimize and upload base64 image data to S3
const uploadBase64ImageToS3 = async (bucket: string, keyPrefix: string, base64DataUrl: string): Promise<string> => {
  if (typeof base64DataUrl !== 'string' || !base64DataUrl.startsWith('data:')) {
    throw new Error('Invalid base64 image data: not a string or does not start with data:');
  }

  const semiColonIndex = base64DataUrl.indexOf(';');
  if (semiColonIndex === -1) {
    throw new Error('Invalid base64 image data: MimeType separator not found');
  }

  const MimeType = base64DataUrl.substring(5, semiColonIndex);
  const base64Marker = ';base64,';
  const base64StartIndex = base64DataUrl.indexOf(base64Marker);
  if (base64StartIndex === -1) {
    throw new Error('Invalid base64 image data: base64 marker not found');
  }

  const imageDataString = base64DataUrl.substring(base64StartIndex + base64Marker.length);
  const imageData = Buffer.from(imageDataString, 'base64');
  const fileExtension = MimeType.split('/')[1] || 'png';
  const s3Key = `${keyPrefix}.${fileExtension}`;

  const s3Params: PutObjectRequest = {
    Bucket: bucket,
    Key: s3Key,
    Body: imageData,
    ContentType: MimeType,
    CacheControl: 'max-age=31536000', // 1 year cache for images
  };

  await s3.upload(s3Params).promise();
  console.log(`[Server Save S3] Successfully uploaded base64 image as ${s3Key} to ${bucket}`);
  return s3Key;
};

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized - No session' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json();

    const validationResult = ProjectRequestBodySchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ 
        message: 'Invalid request data.', 
        errors: validationResult.error.flatten().fieldErrors 
      }, { status: 400 });
    }

    const validatedBody = validationResult.data as ProjectRequestBody;
    const {
      id: projectId,
      name,
      midiDataPayload,
      textAnnotationsPayload,
      backgroundImagePayload,
      thumbnailPayload,
      bpm,
      timeSignature,
      customColors,
      dateCreated,
      backgroundImageHasChanged,
      thumbnailHasChanged
    } = validatedBody;

    console.log(`[Server Save] Received request for project ID: ${projectId}`);
    console.log(`[Server Save] backgroundImageHasChanged flag: ${backgroundImageHasChanged}`);
    console.log(`[Server Save] backgroundImagePayload type: ${typeof backgroundImagePayload}, length: ${typeof backgroundImagePayload === 'string' ? backgroundImagePayload.length : 'N/A'}`);

    if (!projectId || !name || bpm === undefined || !timeSignature) {
      return NextResponse.json({ message: 'Missing required project metadata fields' }, { status: 400 });
    }

    // Check if this is a new project (no existing item)
    const existingItem = await dynamoDb.get({
      TableName: DYNAMODB_PROJECTS_TABLE,
      Key: { userId, projectId },
    }).promise().then(result => result.Item as ProjectDynamoDBItem | undefined)
      .catch(e => {
        console.warn("[Server Save] Could not fetch existing project item:", e);
        return undefined;
      });

    // If this is a new project and user hasn't paid, check if they already have projects
    if (!existingItem) {
      // MODIFIED: Implement tier-based project limits
      const getProjectLimit = () => {
        if (session.user.hasPaid !== true) return 1; // Free tier: 1 project
        if (session.user.activePlans?.includes('tier1')) return 20; // Tier 1: 20 projects
        if (session.user.activePlans?.includes('tier2')) return Infinity; // Tier 2: unlimited
        return 1; // Default to free tier if no plans found
      };

      const projectLimit = getProjectLimit();
      
      // Check how many projects the user already has
      const userProjects = await dynamoDb.query({
        TableName: DYNAMODB_PROJECTS_TABLE,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
      }).promise();

      if (userProjects.Items && userProjects.Items.length >= projectLimit) {
        let message = '';
        if (projectLimit === 1) {
          message = 'Access Denied: Free users can only have one project. Please upgrade your account for more projects.';
        } else if (projectLimit === 20) {
          message = 'Access Denied: Tier 1 users can only have 20 projects. Please upgrade to Tier 2 for unlimited projects.';
        } else {
          message = 'Access Denied: You have reached your project limit. Please upgrade your account for more projects.';
        }
        
        console.warn(`[Server Save] User ${session.user.id} attempt to create project denied: Project limit reached. hasPaid: ${session.user.hasPaid}, activePlans: ${session.user.activePlans}, existing projects: ${userProjects.Items.length}, limit: ${projectLimit}`);
        return NextResponse.json({ message }, { status: 403 });
      }
    }

    // Start all S3 operations in parallel
    const s3Operations: Promise<any>[] = [];
    const finalKeys = {
      midiDataS3Key: undefined as string | undefined | null,
      textAnnotationsS3Key: undefined as string | undefined | null,
      bundledProjectDataS3Key: undefined as string | undefined | null, // NEW: Combined data file
      backgroundImageS3Key: undefined as string | undefined | null,
      thumbnailS3Key: undefined as string | undefined | null
    };

    // NEW: Option to bundle small data files together to reduce HTTP requests
    const shouldBundleData = true; // Could be made configurable

    if (shouldBundleData && (midiDataPayload !== undefined || textAnnotationsPayload !== undefined)) {
      s3Operations.push(
        (async () => {
          const bundledData = {
            midiData: midiDataPayload !== undefined ? midiDataPayload : null,
            textAnnotations: textAnnotationsPayload !== undefined ? textAnnotationsPayload : null,
            version: '1.0', // For future compatibility
            lastModified: new Date().toISOString()
          };
          
          const s3Key = `users/${userId}/projects/${projectId}/bundled-data.json`;
          finalKeys.bundledProjectDataS3Key = await uploadToS3(S3_PROJECT_DATA_BUCKET, s3Key, bundledData, 'application/json');
          console.log('[Server Save] Bundled project data uploaded to:', s3Key);
        })()
      );
    } else {
      // Fallback to separate files (existing logic)
      if (midiDataPayload !== undefined) {
      s3Operations.push(
        (async () => {
          if (midiDataPayload === null) {
            finalKeys.midiDataS3Key = null;
          } else {
            const s3Key = `users/${userId}/projects/${projectId}/midiData.json`;
            finalKeys.midiDataS3Key = await uploadToS3(S3_PROJECT_DATA_BUCKET, s3Key, midiDataPayload, 'application/json');
          }
        })()
      );
    }

    if (textAnnotationsPayload !== undefined) {
      s3Operations.push(
        (async () => {
          if (textAnnotationsPayload === null) {
            finalKeys.textAnnotationsS3Key = null;
          } else {
            const s3Key = `users/${userId}/projects/${projectId}/textAnnotations.json`;
            finalKeys.textAnnotationsS3Key = await uploadToS3(S3_PROJECT_DATA_BUCKET, s3Key, textAnnotationsPayload, 'application/json');
          }
        })()
      );
      }
    }

    if (backgroundImageHasChanged && backgroundImagePayload !== undefined) {
      s3Operations.push(
        (async () => {
          if (backgroundImagePayload === null) {
            finalKeys.backgroundImageS3Key = null;
          } else if (typeof backgroundImagePayload === 'string' && backgroundImagePayload.startsWith('data:')) {
            finalKeys.backgroundImageS3Key = await uploadBase64ImageToS3(
              S3_BACKGROUND_IMAGES_BUCKET,
              `users/${userId}/projects/${projectId}/background`,
              backgroundImagePayload
            );
          } else {
            console.log('[Server Save] Skipping background image upload: condition not met (not a data URL or flag not set).');
          }
        })()
      );
    }

    if (thumbnailHasChanged && thumbnailPayload !== undefined) {
      s3Operations.push(
        (async () => {
          if (thumbnailPayload === null) {
            finalKeys.thumbnailS3Key = null;
          } else if (typeof thumbnailPayload === 'string' && thumbnailPayload.startsWith('data:')) {
            finalKeys.thumbnailS3Key = await uploadBase64ImageToS3(
              S3_THUMBNAILS_BUCKET,
              `users/${userId}/projects/${projectId}/thumbnail`,
              thumbnailPayload
            );
          }
        })()
      );
    }

    // Wait for all operations to complete
    await Promise.all(s3Operations);

    // Clean up old S3 objects if needed
    const cleanupOperations: Promise<void>[] = [];
    if (existingItem) {
      if (finalKeys.midiDataS3Key === null && existingItem.projectData?.midiDataS3Key) {
        cleanupOperations.push(deleteFromS3(S3_PROJECT_DATA_BUCKET, existingItem.projectData.midiDataS3Key));
      }
      if (finalKeys.textAnnotationsS3Key === null && existingItem.projectData?.textAnnotationsS3Key) {
        cleanupOperations.push(deleteFromS3(S3_PROJECT_DATA_BUCKET, existingItem.projectData.textAnnotationsS3Key));
      }
      if (finalKeys.backgroundImageS3Key === null && existingItem.appearance?.backgroundImageS3Key) {
        cleanupOperations.push(deleteFromS3(S3_BACKGROUND_IMAGES_BUCKET, existingItem.appearance.backgroundImageS3Key));
      }
      if (finalKeys.thumbnailS3Key === null && existingItem.thumbnailS3Key) {
        cleanupOperations.push(deleteFromS3(S3_THUMBNAILS_BUCKET, existingItem.thumbnailS3Key));
      }
    }

    // Start cleanup in background
    if (cleanupOperations.length > 0) {
      Promise.all(cleanupOperations).catch(error => {
        console.error('[Server Save] Error during cleanup:', error);
      });
    }

    const now = new Date().toISOString();
    const projectItem: ProjectDynamoDBItem = {
      userId,
      projectId,
      name,
      projectData: {
        midiDataS3Key: finalKeys.midiDataS3Key ?? existingItem?.projectData?.midiDataS3Key ?? null,
        bpm,
        timeSignature,
        textAnnotationsS3Key: finalKeys.textAnnotationsS3Key ?? existingItem?.projectData?.textAnnotationsS3Key ?? null,
        bundledProjectDataS3Key: finalKeys.bundledProjectDataS3Key ?? existingItem?.projectData?.bundledProjectDataS3Key ?? null, // NEW: Store bundled data key
      },
      appearance: {
        backgroundImageS3Key: finalKeys.backgroundImageS3Key ?? existingItem?.appearance?.backgroundImageS3Key ?? null,
        customColors: customColors || existingItem?.appearance?.customColors || { leftHand: '#ef4444', rightHand: '#4287f5' },
      },
      thumbnailS3Key: finalKeys.thumbnailS3Key ?? existingItem?.thumbnailS3Key ?? null,
      dateCreated: existingItem?.dateCreated || dateCreated || now,
      dateModified: now,
    };

    await dynamoDb.put({
      TableName: DYNAMODB_PROJECTS_TABLE,
      Item: projectItem,
    }).promise();

    return NextResponse.json({ message: 'Project saved successfully', project: projectItem }, { status: 200 });

  } catch (error) {
    console.error('Error saving project:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: 'Error saving project', error: errorMessage }, { status: 500 });
  }
}

// Optional: Add an OPTIONS handler if you encounter CORS preflight issues,
// though your next.config.ts headers should cover this.
export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
} 