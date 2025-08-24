import AWS from 'aws-sdk';

if (!process.env.AWS_REGION) {
  throw new Error('Invalid/Missing environment variable: "AWS_REGION"');
}
if (!process.env.S3_PROJECT_DATA_BUCKET) {
  throw new Error('Invalid/Missing environment variable: "S3_PROJECT_DATA_BUCKET"');
}
if (!process.env.S3_BACKGROUND_IMAGES_BUCKET) {
  throw new Error('Invalid/Missing environment variable: "S3_BACKGROUND_IMAGES_BUCKET"');
}
if (!process.env.S3_THUMBNAILS_BUCKET) {
  throw new Error('Invalid/Missing environment variable: "S3_THUMBNAILS_BUCKET"');
}
if (!process.env.S3_MIDI_LIBRARY_BUCKET) {
  throw new Error('Invalid/Missing environment variable: "S3_MIDI_LIBRARY_BUCKET"');
}
if (!process.env.DYNAMODB_PROJECTS_TABLE) {
  throw new Error('Invalid/Missing environment variable: "DYNAMODB_PROJECTS_TABLE"');
}
if (!process.env.DYNAMODB_USERS_TABLE) {
  throw new Error('Invalid/Missing environment variable: "DYNAMODB_USERS_TABLE"');
}
if (!process.env.DYNAMODB_TRANSCRIBE_JOBS_TABLE) {
  throw new Error('Invalid/Missing environment variable: "DYNAMODB_TRANSCRIBE_JOBS_TABLE"');
}

// Configure AWS SDK
AWS.config.update({
  region: process.env.AWS_REGION,
  // Credentials will be loaded from environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
  // or an IAM role if running on EC2/ECS/Lambda.
});

const s3 = new AWS.S3();
const dynamoDb = new AWS.DynamoDB.DocumentClient();

export { s3, dynamoDb };

// Export bucket and table names for easy access
export const S3_PROJECT_DATA_BUCKET = process.env.S3_PROJECT_DATA_BUCKET!;
export const S3_BACKGROUND_IMAGES_BUCKET = process.env.S3_BACKGROUND_IMAGES_BUCKET!;
export const S3_THUMBNAILS_BUCKET = process.env.S3_THUMBNAILS_BUCKET!;
export const S3_MIDI_LIBRARY_BUCKET = process.env.S3_MIDI_LIBRARY_BUCKET!;
export const DYNAMODB_PROJECTS_TABLE = process.env.DYNAMODB_PROJECTS_TABLE!;
export const DYNAMODB_USERS_TABLE = process.env.DYNAMODB_USERS_TABLE!;
export const DYNAMODB_TRANSCRIBE_JOBS_TABLE = process.env.DYNAMODB_TRANSCRIBE_JOBS_TABLE!;
