import { NextRequest, NextResponse } from 'next/server';
import { dynamoDb } from '@/lib/aws-config';

const DYNAMODB_TRANSCRIBE_JOBS_TABLE = process.env.DYNAMODB_TRANSCRIBE_JOBS_TABLE!;

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  const { jobId } = params;
  if (!jobId) {
    return NextResponse.json({ status: 'error', error: 'Missing jobId' }, { status: 400 });
  }
  try {
    const result = await dynamoDb.get({
      TableName: DYNAMODB_TRANSCRIBE_JOBS_TABLE,
      Key: { jobId },
    }).promise();
    const job = result.Item;
    if (!job) {
      return NextResponse.json({ status: 'error', error: 'Job not found' }, { status: 404 });
    }
    if (job.status === 'pending') {
      return NextResponse.json({ status: 'pending' });
    }
    if (job.status === 'done') {
      return NextResponse.json({ status: 'done', midiUrl: `data:audio/midi;base64,${job.midiUrl}` });
    }
    if (job.status === 'error') {
      return NextResponse.json({ status: 'error', error: job.error || 'Unknown error' });
    }
    return NextResponse.json({ status: 'error', error: 'Unknown job status' }, { status: 500 });
  } catch (err) {
    return NextResponse.json({ status: 'error', error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
} 