require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { firefox } = require('playwright');
const { ExifTool } = require('exiftool-vendored');
const { BASE_URL } = require('./constants');

const exiftool = new ExifTool();

const PDF_DIR = path.join(__dirname, 'pdfs');
const METADATA_DIR = path.join(__dirname, 'metadata');
const LOG_FILE = path.join(__dirname, 'download-errors.log');

const departmentsTree = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'departmentsTree.json'), 'utf8')
).data.departmentsTree;

const lookupTree = buildLookupTree(departmentsTree);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(minMs = 500, maxMs = 1500) {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function buildLookupTree(tree) {
  const lookup = {};
  for (const edge of tree.edges) {
    const dept = edge.node;
    const deptCode = dept.idDepartmentCode.padStart(2, '0');
    lookup[deptCode] = {
      name: dept.departmentName,
      municipalities: {},
    };
    for (const muni of dept.municipalities) {
      const muniCode = muni.municipalityCode.padStart(3, '0');
      lookup[deptCode].municipalities[muniCode] = {
        name: muni.municipalityName,
        zones: {},
      };
      for (const zone of muni.zones) {
        const zoneCode = zone.idZoneCode.padStart(2, '0');
        lookup[deptCode].municipalities[muniCode].zones[zoneCode] = {
          name: zone.zoneName,
          stands: {},
        };
        for (const stand of zone.stands) {
          const standCode = stand.standCode.padStart(2, '0');
          lookup[deptCode].municipalities[muniCode].zones[zoneCode].stands[standCode] = {
            name: stand.standName,
          };
        }
      }
    }
  }
  return lookup;
}

function lookupLocation(node) {
  const dept = node.idDepartmentCode.padStart(2, '0');
  const muni = node.municipalityCode.padStart(3, '0');
  const zone = node.idZoneCode.padStart(2, '0');
  const stand = node.standCode.padStart(2, '0');
  const deptInfo = lookupTree[dept];
  const muniInfo = deptInfo?.municipalities[muni];
  const zoneInfo = muniInfo?.zones[zone];
  const standInfo = zoneInfo?.stands[stand];
  return {
    department: deptInfo?.name || `Department ${node.idDepartmentCode}`,
    municipality: muniInfo?.name || `Municipality ${node.municipalityCode}`,
    zone: zoneInfo?.name || `Zone ${node.idZoneCode}`,
    stand: standInfo?.name || `Stand ${node.standCode}`,
  };
}

function buildPdfUrl(node) {
  const dept = node.idDepartmentCode.padStart(2, '0');
  const municipality = node.municipalityCode.padStart(3, '0');
  const zone = node.idZoneCode.padStart(3, '0');
  const stand = node.standCode.padStart(2, '0');
  const numberStand = node.numberStand.padStart(3, '0');
  const pdfName = node.expectedName;
  return `${BASE_URL}/assets/temis/pdf/${dept}/${municipality}/${zone}/${stand}/${numberStand}/PRE/${pdfName}`;
}

function buildFileName(node) {
  const dept = node.idDepartmentCode.padStart(2, '0');
  const municipality = node.municipalityCode.padStart(3, '0');
  const zone = node.idZoneCode.padStart(3, '0');
  const stand = node.standCode.padStart(2, '0');
  const numberStand = node.numberStand.padStart(3, '0');
  const corporation = node.idCorporationCode;
  const id = `${dept}-${municipality}-${zone}-${stand}-${numberStand}-${corporation}`;
  return `${id}-${node.expectedName}`;
}

function buildOutputPaths(node) {
  const fileName = buildFileName(node);
  const baseName = fileName.replace(/\.pdf$/i, '');
  return {
    pdfPath: path.join(PDF_DIR, fileName),
    metadataPath: path.join(METADATA_DIR, `${baseName}.json`),
  };
}

async function downloadPdf(page, url, filePath) {
  let body = null;
  let status = null;
  let contentType = null;

  const onResponse = async (response) => {
    if (response.url() !== url) return;
    status = response.status();
    contentType = response.headers()['content-type'] || '';
    try {
      body = await response.body();
    } catch (err) {
      console.error(`  Failed to read response body: ${err.message}`);
    }
  };

  page.on('response', onResponse);

  try {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    } catch (err) {
      if (!err.message.includes('Download is starting')) {
        throw err;
      }
    }

    await page.waitForTimeout(500);

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
    page.off('response', onResponse);
  }
}

async function extractXmpMetadata(filePath) {
  const tags = await exiftool.read(filePath, ['-b', '-XMP']);
  if (tags.XMP && String(tags.XMP).trim().length > 0) {
    return { present: true, content: String(tags.XMP) };
  }
  return { present: false, content: 'No XMP metadata found in this PDF.' };
}

function writeMetadata(metadataPath, { url, size, xmp, node, location, downloadedAt, downloadDurationMs }) {
  const payload = {
    file: `${path.basename(metadataPath, '.json')}.pdf`,
    url,
    sizeBytes: size,
    downloadedAt,
    downloadDurationMs,
    department: location.department,
    municipality: location.municipality,
    zone: location.zone,
    stand: location.stand,
    idDepartmentCode: node.idDepartmentCode,
    municipalityCode: node.municipalityCode,
    idZoneCode: node.idZoneCode,
    idCorporationCode: node.idCorporationCode,
    standCode: node.standCode,
    numberStand: node.numberStand,
    idTransmissionCode: node.idTransmissionCode,
    xmpPresent: xmp.present,
    xmpContent: xmp.content,
  };
  fs.writeFileSync(metadataPath, JSON.stringify(payload, null, 2) + '\n');
}

function logError({ node, location, url, error }) {
  const timestamp = new Date().toISOString();
  const line = [
    `timestamp: ${timestamp}`,
    `url: ${url}`,
    `error: ${error}`,
    `department: ${location.department}`,
    `municipality: ${location.municipality}`,
    `zone: ${location.zone}`,
    `stand: ${location.stand}`,
    `idDepartmentCode: ${node.idDepartmentCode}`,
    `municipalityCode: ${node.municipalityCode}`,
    `idZoneCode: ${node.idZoneCode}`,
    `idCorporationCode: ${node.idCorporationCode}`,
    `standCode: ${node.standCode}`,
    `numberStand: ${node.numberStand}`,
    `idTransmissionCode: ${node.idTransmissionCode}`,
    '---',
  ].join('\n') + '\n';
  fs.appendFileSync(LOG_FILE, line);
}

function sortNodes(nodes) {
  return [...nodes].sort((a, b) => {
    const aUrl = buildPdfUrl(a);
    const bUrl = buildPdfUrl(b);
    return aUrl.localeCompare(bUrl);
  });
}

(async () => {
  fs.mkdirSync(PDF_DIR, { recursive: true });
  fs.mkdirSync(METADATA_DIR, { recursive: true });

  const { data } = JSON.parse(fs.readFileSync('allTransmissionCodes.json', 'utf8'));
  const nodes = sortNodes([...data.status3.nodes, ...data.status11.nodes]);

  console.log(`Found ${nodes.length.toLocaleString()} transmission nodes.`);

  const browser = await firefox.launch({ headless: process.env.HEADLESS !== 'false' });
  const page = await browser.newPage();

  try {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const url = buildPdfUrl(node);
      const location = lookupLocation(node);
      const { pdfPath, metadataPath } = buildOutputPaths(node);

      if (fs.existsSync(pdfPath)) {
        console.log(`[${i + 1}/${nodes.length}] SKIP (already downloaded): ${path.basename(pdfPath)}`);
        continue;
      }

      console.log(`[${i + 1}/${nodes.length}] ${url}`);
      console.log(`  Location: ${location.department} > ${location.municipality} > ${location.zone} > ${location.stand} (table ${node.numberStand})`);
      try {
        const downloadStartedAt = Date.now();
        await downloadPdf(page, url, pdfPath);
        const size = fs.statSync(pdfPath).size;
        const xmp = await extractXmpMetadata(pdfPath);
        const downloadedAt = new Date().toISOString();
        const downloadDurationMs = Date.now() - downloadStartedAt;
        writeMetadata(metadataPath, { url, size, xmp, node, location, downloadedAt, downloadDurationMs });
        console.log(`  Saved: ${path.basename(pdfPath)} (${size.toLocaleString()} bytes)`);
        console.log(`  XMP present: ${xmp.present}`);
      } catch (err) {
        console.error(`  ERROR: ${err.message}`);
        console.error(`  Lookup for manual verification: ${location.department} > ${location.municipality} > ${location.zone} > ${location.stand} (table ${node.numberStand})`);
        logError({ node, location, url, error: err.message });
      }

      if (i < nodes.length - 1) {
        const delay = randomDelay();
        console.log(`  Sleeping ${delay}ms...`);
        await sleep(delay);
      }
    }
  } finally {
    await page.close();
    await browser.close();
    await exiftool.end();
  }

  console.log('\nDone.');
})();
