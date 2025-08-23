import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBAdapter, CustomAdapterUser } from '@/lib/dynamodb-adapter';
import { auth } from '@/../auth';
import { v4 as uuidv4 } from 'uuid';
import { dynamoDb } from '@/lib/aws-config';
import { z } from 'zod';

// Validation schemas
const TranscriptionUploadSchema = z.object({
  audio: z.instanceof(Blob, { message: "Audio file is required" })
    .refine((file) => file.size > 0, { message: "File cannot be empty" })
    .refine((file) => file.size <= 100 * 1024 * 1024, { message: "File too large (max 100MB)" })
    .refine((file) => {
      const allowedTypes = ['audio/mp3', 'audio/wav', 'audio/m4a', 'audio/flac', 'audio/ogg', 'audio/mpeg', 'audio/x-m4a'];
      return allowedTypes.includes(file.type);
    }, { message: "Unsupported file type" })
    .refine((file) => {
      if (file instanceof File) {
        const allowedExtensions = ['.mp3', '.wav', '.m4a', '.flac', '.ogg'];
        
        // More robust extension extraction that handles Unicode characters
        const fileName = file.name.toLowerCase();
        const lastDotIndex = fileName.lastIndexOf('.');
        
        // If no dot found, check if it's a valid audio file by MIME type only
        if (lastDotIndex === -1) {
          return true; // Let MIME type validation handle this
        }
        
        const extension = fileName.substring(lastDotIndex);
        const hasValidExtension = allowedExtensions.includes(extension);
        const hasValidMimeType = ['audio/mp3', 'audio/wav', 'audio/m4a', 'audio/flac', 'audio/ogg', 'audio/mpeg', 'audio/x-m4a'].includes(file.type);
        
        // Accept if either extension OR MIME type is valid (some browsers don't set correct MIME types)
        return hasValidExtension || hasValidMimeType;
      }
      return true;
    }, { message: "Invalid file extension" }),
});

const QuotaCheckSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  hasPaid: z.boolean(),
  activePlans: z.array(z.string()).optional(),
});

// MODIFIED: Tier-based transcription limits
const getTranscriptionLimit = (hasPaid: boolean, activePlans?: string[]) => {
  if (!hasPaid) return 0; // Free tier: no transcriptions
  if (activePlans?.includes('tier1')) return 5; // Tier 1: 5 transcriptions/month
  if (activePlans?.includes('tier2')) return 20; // Tier 2: 20 transcriptions/month
  return 0; // Default to no access if no plans found
};

const FLASK_TRANSCRIBE_URL = process.env.TRANSCRIPTION_SERVICE_URL || 'https://transkun-transcription-service-504980184676.us-central1.run.app/transcribe';
const DYNAMODB_TRANSCRIBE_JOBS_TABLE = process.env.DYNAMODB_TRANSCRIBE_JOBS_TABLE!;

function getCurrentMonthString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authentication validation
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized - No session' }, { status: 401 });
    }

    // 2. Validate user data with Zod
    const userValidation = QuotaCheckSchema.safeParse({
      userId: session.user.id,
      hasPaid: session.user.hasPaid === true,
      activePlans: session.user.activePlans,
    });

    if (!userValidation.success) {
      return NextResponse.json({ 
        error: "Invalid user data", 
        details: userValidation.error.errors 
      }, { status: 400 });
    }

    const { userId, hasPaid, activePlans } = userValidation.data;
    
    // 3. Check tier-based access
    const transcriptionLimit = getTranscriptionLimit(hasPaid, activePlans);
    
    if (transcriptionLimit === 0) {
      return NextResponse.json({ 
        code: 'PAYMENT_REQUIRED', 
        message: 'AI Transcription is a premium feature. Please upgrade your account to use this feature.' 
      }, { status: 403 });
    }
    
    // 4. Parse and validate form data
    const formData = await req.formData();
    const audioFile = formData.get('audio');
    
    // 5. Validate audio file with Zod
    const fileValidation = TranscriptionUploadSchema.safeParse({ audio: audioFile });
    
    if (!fileValidation.success) {
      // Enhanced error logging for debugging
      console.error('File validation failed:', {
        fileName: audioFile instanceof File ? audioFile.name : 'Unknown',
        fileType: audioFile instanceof File ? audioFile.type : 'Unknown',
        fileSize: audioFile instanceof File ? audioFile.size : 'Unknown',
        errors: fileValidation.error.errors
      });
      
      return NextResponse.json({ 
        error: "Invalid file", 
        details: fileValidation.error.errors,
        debug: {
          fileName: audioFile instanceof File ? audioFile.name : 'Unknown',
          fileType: audioFile instanceof File ? audioFile.type : 'Unknown',
          fileSize: audioFile instanceof File ? audioFile.size : 'Unknown'
        }
      }, { status: 400 });
    }

    const validatedAudioFile = fileValidation.data.audio;
    const audioFileName = (validatedAudioFile instanceof File && validatedAudioFile.name) 
      ? validatedAudioFile.name 
      : 'audio.mp3';

    // 6. Check user quota
    const adapter = DynamoDBAdapter();
    const user = await (adapter.getUser!(userId)) as CustomAdapterUser;
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }
    
    const currentMonth = getCurrentMonthString();
    let transcriptionCount = user.transcriptionCount ?? 0;
    let transcriptionMonth = user.transcriptionMonth ?? currentMonth;
    
    if (transcriptionMonth !== currentMonth) {
      transcriptionCount = 0;
      transcriptionMonth = currentMonth;
    }
    
    if (transcriptionCount >= transcriptionLimit) {
      return NextResponse.json({ 
        code: 'QUOTA_EXCEEDED', 
        message: `You have reached your monthly transcription limit of ${transcriptionLimit}. Please upgrade your account for more transcriptions.` 
      }, { status: 403 });
    }

    // 7. Generate job ID and create job record
    const jobId = uuidv4();
    const jobItem = {
      jobId,
      userId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      midiUrl: null,
      error: null,
      fileName: audioFileName,
      fileSize: validatedAudioFile.size,
      fileType: validatedAudioFile.type,
    };
    
    await dynamoDb.put({
      TableName: DYNAMODB_TRANSCRIBE_JOBS_TABLE,
      Item: jobItem,
    }).promise();

    // 8. Update user quota
    await adapter.updateUser!({
      id: userId,
      transcriptionCount: transcriptionCount + 1,
      transcriptionMonth,
    } as CustomAdapterUser);

    // 9. Start background transcription job
    (async () => {
      try {
        const arrayBuffer = await validatedAudioFile.arrayBuffer();
        const audioBuffer = Buffer.from(arrayBuffer);
        
        const form = new FormData();
        form.append('audio', new Blob([audioBuffer]), audioFileName);
        
        const flaskRes = await fetch(FLASK_TRANSCRIBE_URL, {
          method: 'POST',
          headers: {
            'X-Transcription-Secret': process.env.TRANSCRIPTION_SECRET || '8pbskNqThzYlgOPZLumI1JUWRHyCFKAQ',
          },
          body: form,
        });
        
        if (!flaskRes.ok) {
          const errorText = await flaskRes.text();
          await dynamoDb.update({
            TableName: DYNAMODB_TRANSCRIBE_JOBS_TABLE,
            Key: { jobId },
            UpdateExpression: 'SET #status = :status, #error = :error',
            ExpressionAttributeNames: { '#status': 'status', '#error': 'error' },
            ExpressionAttributeValues: { ':status': 'error', ':error': errorText },
          }).promise();
          return;
        }
        
        // Save MIDI file to S3 (or as base64 for demo)
        const midiBuffer = Buffer.from(await flaskRes.arrayBuffer());
        const midiBase64 = midiBuffer.toString('base64');
        
        await dynamoDb.update({
          TableName: DYNAMODB_TRANSCRIBE_JOBS_TABLE,
          Key: { jobId },
          UpdateExpression: 'SET #status = :status, #midiUrl = :midiUrl, #completedAt = :completedAt',
          ExpressionAttributeNames: { 
            '#status': 'status', 
            '#midiUrl': 'midiUrl',
            '#completedAt': 'completedAt'
          },
          ExpressionAttributeValues: { 
            ':status': 'done', 
            ':midiUrl': midiBase64,
            ':completedAt': new Date().toISOString()
          },
        }).promise();
        
      } catch (err) {
        await dynamoDb.update({
          TableName: DYNAMODB_TRANSCRIBE_JOBS_TABLE,
          Key: { jobId },
          UpdateExpression: 'SET #status = :status, #error = :error',
          ExpressionAttributeNames: { '#status': 'status', '#error': 'error' },
          ExpressionAttributeValues: { 
            ':status': 'error', 
            ':error': err instanceof Error ? err.message : String(err) 
          },
        }).promise();
      }
    })();

    return NextResponse.json({ 
      jobId,
      message: "Transcription job started successfully"
    }, { status: 200 });
    
  } catch (error) {
    console.error('Transcription upload error:', error);
    return NextResponse.json({ 
      message: 'Server error', 
      error: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
} 
