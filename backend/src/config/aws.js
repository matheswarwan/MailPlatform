import { SESClient } from '@aws-sdk/client-ses';
import { S3Client } from '@aws-sdk/client-s3';
import { SNSClient } from '@aws-sdk/client-sns';

const awsConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
};

export const sesClient = new SESClient(awsConfig);
export const s3Client = new S3Client(awsConfig);
export const snsClient = new SNSClient(awsConfig);
