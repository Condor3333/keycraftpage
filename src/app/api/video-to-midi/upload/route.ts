import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBAdapter, CustomAdapterUser } from '@/lib/dynamodb-adapter';
import { auth } from '@/../auth';
import { v4 as uuidv4 } from 'uuid';
import { dynamoDb } from '@/lib/aws-config';

const TRANSCRIPTION_LIMIT = 10;
const FLASK_TRANSCRIBE_URL = 'https://transkun-service-504980184676.us-central1.run.app/transcribe';
const DYNAMODB_TRANSCRIBE_JOBS_TABLE = process.env.DYNAMODB_TRANSCRIBE_JOBS_TABLE!;

function getCurrentMonthString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized - No session' }, { status: 401 });
    }
    const userId = session.user.id;
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
    if (transcriptionCount >= TRANSCRIPTION_LIMIT) {
      return NextResponse.json({ code: 'QUOTA_EXCEEDED', message: 'You have reached your monthly transcription limit.' }, { status: 403 });
    }

    // Parse multipart form data to get the audio file
    const formData = await req.formData();
    const audioFile = formData.get('audio');
    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json({ message: 'No audio file provided' }, { status: 400 });
    }
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    const audioFileName = (audioFile instanceof File && audioFile.name) ? audioFile.name : 'audio.mp3';

    // Generate jobId and store job as pending in DynamoDB
    const jobId = uuidv4();
    const jobItem = {
      jobId,
      userId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      midiUrl: null,
      error: null,
    };
    await dynamoDb.put({
      TableName: DYNAMODB_TRANSCRIBE_JOBS_TABLE,
      Item: jobItem,
    }).promise();

    // Update user quota in DynamoDB
    await adapter.updateUser!({
      id: userId,
      transcriptionCount: transcriptionCount + 1,
      transcriptionMonth,
    } as CustomAdapterUser);

    // Start background job
    (async () => {
      try {
        const form = new FormData();
        form.append('audio', new Blob([audioBuffer]), audioFileName);
        const flaskRes = await fetch(FLASK_TRANSCRIBE_URL, {
          method: 'POST',
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
        // Save MIDI file to S3 (or as a base64 string for demo)
        const midiBuffer = Buffer.from(await flaskRes.arrayBuffer());
        // For demo, store as base64 in DynamoDB (not recommended for large files in prod)
        const midiBase64 = midiBuffer.toString('base64');
        await dynamoDb.update({
          TableName: DYNAMODB_TRANSCRIBE_JOBS_TABLE,
          Key: { jobId },
          UpdateExpression: 'SET #status = :status, #midiUrl = :midiUrl',
          ExpressionAttributeNames: { '#status': 'status', '#midiUrl': 'midiUrl' },
          ExpressionAttributeValues: { ':status': 'done', ':midiUrl': midiBase64 },
        }).promise();
      } catch (err) {
        await dynamoDb.update({
          TableName: DYNAMODB_TRANSCRIBE_JOBS_TABLE,
          Key: { jobId },
          UpdateExpression: 'SET #status = :status, #error = :error',
          ExpressionAttributeNames: { '#status': 'status', '#error': 'error' },
          ExpressionAttributeValues: { ':status': 'error', ':error': err instanceof Error ? err.message : String(err) },
        }).promise();
      }
    })();

    return NextResponse.json({ jobId }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: 'Server error', error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
} 