require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const PDF_DIR = path.join(__dirname, "pdfs");

function getEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

const s3 = new S3Client({
  region: getEnv("S3_REGION"),
  endpoint: getEnv("S3_ENDPOINT"),
  credentials: {
    accessKeyId: getEnv("S3_ACCESS_KEY_ID"),
    secretAccessKey: getEnv("S3_SECRET_ACCESS_KEY"),
  },
  forcePathStyle: true,
});

async function main() {
  const files = fs
    .readdirSync(PDF_DIR)
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .sort();

  if (files.length === 0) {
    throw new Error(`No PDFs found in ${PDF_DIR}`);
  }

  const fileName = files[0];
  const filePath = path.join(PDF_DIR, fileName);
  const bucket = getEnv("S3_BUCKET");

  console.log(`Uploading ${fileName} to s3://${bucket}/${fileName} ...`);

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: fileName,
      Body: fs.createReadStream(filePath),
      ContentType: "application/pdf",
    }),
  );

  console.log("Upload successful.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
