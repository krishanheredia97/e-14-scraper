import { S3Client } from "@aws-sdk/client-s3";

export function createS3Client(): S3Client {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!endpoint || !region || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing S3 configuration. Set S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.",
    );
  }

  return new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
}

export function getS3Bucket(): string {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error("Missing S3_BUCKET environment variable.");
  }
  return bucket;
}
