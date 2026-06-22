require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { firefox } = require('playwright');
const { ExifTool } = require('exiftool-vendored');
const { BASE_URL } = require('./constants');

const exiftool = new ExifTool();

const OUTPUT_DIR = path.join(__dirname, 'pdfs');
const LIMIT = 1;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(minMs = 1000, maxMs = 3000) {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function buildPdfUrl(node) {
  const dept = node.idDepartmentCode.padStart(2, '0');
  const municipality = node.municipalityCode.padStart(3, '0');
  const corporation = node.idCorporationCode.padStart(3, '0');
  const stand = node.standCode.padStart(2, '0');
  const numberStand = node.numberStand.padStart(3, '0');
  const pdfName = node.expectedName;
  return `${BASE_URL}/assets/temis/pdf/${dept}/${municipality}/${corporation}/${stand}/${numberStand}/PRE/${pdfName}`;
}

async function downloadPdf(browser, url, filePath) {
  const page = await browser.newPage();
  try {
    let body = null;
    let status = null;
    let contentType = null;

    page.on('response', async (response) => {
      if (response.url() !== url) return;
      status = response.status();
      contentType = response.headers()['content-type'] || '';
      try {
        body = await response.body();
      } catch (err) {
        console.error(`  Failed to read response body: ${err.message}`);
      }
    });

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    } catch (err) {
      if (!err.message.includes('Download is starting')) {
        throw err;
      }
    }

    await page.waitForTimeout(2000);

    if (!body) {
      throw new Error('No response body captured');
    }
    if (status !== 200) {
      throw new Error(`HTTP ${status}`);
    }
    if (!contentType.includes('pdf')) {
      throw new Error(`Unexpected content-type: ${contentType}`);
    }

    fs.writeFileSync(filePath, body);
  } finally {
    await page.close();
  }
}

function writeMetadata(filePath, url, size) {
  const metadataPath = filePath.replace(/\.pdf$/i, '') + '_metadata.txt';
  const lines = [
    `file: ${path.basename(filePath)}`,
    `url: ${url}`,
    `sizeBytes: ${size}`,
  ];
  fs.writeFileSync(metadataPath, lines.join('\n') + '\n');
}

async function extractPdfMetadata(filePath) {
  const tags = await exiftool.read(filePath);
  const pick = ['Title', 'Author', 'Creator', 'Producer', 'CreateDate', 'ModifyDate', 'FileSize', 'PDFVersion', 'PageCount'];
  const lines = pick
    .filter((key) => tags[key] !== undefined)
    .map((key) => `${key}: ${tags[key]}`);
  if (tags.errors && tags.errors.length) {
    lines.push(`errors: ${tags.errors.join('; ')}`);
  }
  const metadataPath = filePath.replace(/\.pdf$/i, '') + '_metadata.txt';
  fs.writeFileSync(metadataPath, lines.join('\n') + '\n');
  return lines;
}

(async () => {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const { data } = JSON.parse(fs.readFileSync('allTransmissionCodes.json', 'utf8'));
  const nodes = [...data.status3.nodes, ...data.status11.nodes];

  console.log(`Found ${nodes.length.toLocaleString()} transmission nodes.`);
  console.log(`Downloading first ${LIMIT} PDF(s)...\n`);

  const browser = await firefox.launch({ headless: process.env.HEADLESS !== 'false' });

  try {
    for (let i = 0; i < Math.min(LIMIT, nodes.length); i++) {
      const node = nodes[i];
      const url = buildPdfUrl(node);
      const fileName = `${String(i + 1).padStart(3, '0')}_${node.expectedName}`;
      const filePath = path.join(OUTPUT_DIR, fileName);

      console.log(`[${i + 1}/${LIMIT}] ${url}`);
      try {
        await downloadPdf(browser, url, filePath);
        const size = fs.statSync(filePath).size;
        const pdfMetaLines = await extractPdfMetadata(filePath);
        console.log(`  Saved: ${fileName} (${size.toLocaleString()} bytes)`);
        if (pdfMetaLines.length) console.log(`  Metadata saved.`);
      } catch (err) {
        console.error(`  ERROR: ${err.message}`);
      }

      if (i < Math.min(LIMIT, nodes.length) - 1) {
        const delay = randomDelay();
        console.log(`  Sleeping ${delay}ms...`);
        await sleep(delay);
      }
    }
  } finally {
    await browser.close();
    await exiftool.end();
  }

  console.log('\nDone.');
})();
