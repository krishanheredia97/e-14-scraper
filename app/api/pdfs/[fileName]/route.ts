import { GetObjectCommand, NoSuchKey } from "@aws-sdk/client-s3";
import { createS3Client, getS3Bucket } from "../../../lib/s3";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileName: string }> },
) {
  const { fileName } = await params;
  const decoded = decodeURIComponent(fileName);

  try {
    const s3 = createS3Client();
    const bucket = getS3Bucket();

    const response = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: decoded }),
    );

    const headers = new Headers();
    headers.set("Content-Type", response.ContentType ?? "application/pdf");
    if (response.ContentLength) {
      headers.set("Content-Length", String(response.ContentLength));
    }
    headers.set("Cache-Control", "public, max-age=3600");

    return new Response(response.Body as ReadableStream, { headers });
  } catch (error) {
    if (error instanceof NoSuchKey || (error as { name?: string }).name === "NoSuchKey") {
      return new Response("PDF not found", { status: 404 });
    }

    console.error("Failed to fetch PDF from S3:", error);
    return new Response("Failed to load PDF", { status: 500 });
  }
}
