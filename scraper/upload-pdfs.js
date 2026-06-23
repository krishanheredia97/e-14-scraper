require("dotenv").config();
const fs = require("fs");
const path = require("path");
const {
  S3Client,
  HeadObjectCommand,
  PutObjectCommand,
  NotFound,
} = require("@aws-sdk/client-s3");

const PDF_DIR = path.join(__dirname, "pdfs");
const CONCURRENCY = 8;

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

async function existsInS3(bucket, key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (err) {
    if (err instanceof NotFound || err.name === "NotFound") {
      return false;
    }
    throw err;
  }
}

async function uploadFile(bucket, fileName) {
  const filePath = path.join(PDF_DIR, fileName);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: fileName,
      Body: fs.createReadStream(filePath),
      ContentType: "application/pdf",
    }),
  );
}

function createPool(concurrency) {
  const queue = [];
  let running = 0;

  function next() {
    if (queue.length === 0 || running >= concurrency) return;
    running++;
    const { task, resolve, reject } = queue.shift();
    task()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        running--;
        next();
      });
    next();
  }

  return function run(task) {
    return new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject });
      next();
    });
  };
}

async function main() {
  const bucket = getEnv("S3_BUCKET");
  const files = fs
    .readdirSync(PDF_DIR)
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .sort();

  console.log(`Found ${files.length.toLocaleString()} local PDFs.`);

  const pool = createPool(CONCURRENCY);
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  await Promise.all(
    files.map((fileName, index) =>
      pool(async () => {
        const prefix = `[${(index + 1).toString().padStart(5, " ")}/${files.length.toLocaleString()}]`;
        try {
          const exists = await existsInS3(bucket, fileName);
          if (exists) {
            console.log(`${prefix} SKIP (already in S3) ${fileName}`);
            skipped++;
            return;
          }

          console.log(`${prefix} UPLOAD ${fileName}`);
          await uploadFile(bucket, fileName);
          uploaded++;
        } catch (err) {
          failed++;
          console.error(`${prefix} ERROR ${fileName}: ${err.message}`);
        }
      }),
    ),
  );

  console.log("\nDone.");
  console.log(`  Uploaded: ${uploaded.toLocaleString()}`);
  console.log(`  Skipped:  ${skipped.toLocaleString()}`);
  console.log(`  Failed:   ${failed.toLocaleString()}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
