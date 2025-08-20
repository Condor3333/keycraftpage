import { NextRequest, NextResponse } from 'next/server';
import { dynamoDb } from '@/lib/aws-config';
import { z } from 'zod';

const DYNAMODB_TRANSCRIBE_JOBS_TABLE = process.env.DYNAMODB_TRANSCRIBE_JOBS_TABLE!;

// Validation schema for job ID
const JobIdSchema = z.object({
  jobId: z.string().uuid({ message: "Invalid job ID format" }).min(1, "Job ID is required"),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    // Await params as required by Next.js 15+
    const { jobId: paramJobId } = await params;
    
    // Validate job ID with Zod
    const validation = JobIdSchema.safeParse({ jobId: paramJobId });
    
    if (!validation.success) {
      return NextResponse.json({ 
        status: 'error', 
        error: 'Invalid job ID',
        details: validation.error.errors 
      }, { status: 400 });
    }

    const { jobId } = validation.data;

    const result = await dynamoDb.get({
      TableName: DYNAMODB_TRANSCRIBE_JOBS_TABLE,
      Key: { jobId },
    }).promise();

    const job = result.Item;
    if (!job) {
      return NextResponse.json({ 
        status: 'error', 
        error: 'Job not found' 
      }, { status: 404 });
    }

    // Validate job status
    const validStatuses = ['pending', 'done', 'error'];
    if (!validStatuses.includes(job.status)) {
      return NextResponse.json({ 
        status: 'error', 
        error: 'Invalid job status' 
      }, { status: 500 });
    }

    if (job.status === 'pending') {
      return NextResponse.json({ 
        status: 'pending',
        jobId,
        createdAt: job.createdAt
      });
    }

    if (job.status === 'done') {
      if (!job.midiUrl) {
        return NextResponse.json({ 
          status: 'error', 
          error: 'MIDI file not found' 
        }, { status: 500 });
      }

      return NextResponse.json({ 
        status: 'done', 
        midiUrl: `data:audio/midi;base64,${job.midiUrl}`,
        jobId,
        completedAt: job.completedAt,
        fileName: job.fileName
      });
    }

    if (job.status === 'error') {
      return NextResponse.json({ 
        status: 'error', 
        error: job.error || 'Unknown error',
        jobId,
        createdAt: job.createdAt
      });
    }

    return NextResponse.json({ 
      status: 'error', 
      error: 'Unknown job status' 
    }, { status: 500 });

  } catch (err) {
    console.error('Job status error:', err);
    return NextResponse.json({ 
      status: 'error', 
      error: err instanceof Error ? err.message : String(err) 
    }, { status: 500 });
  }
} 