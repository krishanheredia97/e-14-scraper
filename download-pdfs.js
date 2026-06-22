require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { firefox } = require('playwright');
const { ExifTool } = require('exiftool-vendored');
const { BASE_URL } = require('./constants');

const exiftool = new ExifTool();

const OUTPUT_DIR = path.join(__dirname, 'pdfs');
const LIMIT = 5;

const departmentsTree = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'departmentsTree.json'), 'utf8')
).data.departmentsTree;

const lookupTree = buildLookupTree(departmentsTree);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(minMs = 1000, maxMs = 3000) {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function shuffleArray(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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

function buildOutputDir(node) {
  const dept = node.idDepartmentCode.padStart(2, '0');
  const municipality = node.municipalityCode.padStart(3, '0');
  const zone = node.idZoneCode.padStart(3, '0');
  const stand = node.standCode.padStart(2, '0');
  const numberStand = node.numberStand.padStart(3, '0');
  return path.join(OUTPUT_DIR, dept, municipality, zone, stand, numberStand);
}

function buildOutputPaths(node) {
  const dir = buildOutputDir(node);
  const pdfName = node.expectedName;
  return {
    dir,
    pdfPath: path.join(dir, pdfName),
    metadataPath: path.join(dir, pdfName.replace(/\.pdf$/i, '') + '_metadata.txt'),
  };
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

async function extractXmpMetadata(filePath) {
  const tags = await exiftool.read(filePath, ['-b', '-XMP']);
  if (tags.XMP && String(tags.XMP).trim().length > 0) {
    return { present: true, content: String(tags.XMP) };
  }
  return { present: false, content: 'No XMP metadata found in this PDF.' };
}

function writeMetadata(metadataPath, { url, size, xmp, node, location }) {
  const lines = [
    `file: ${path.basename(metadataPath, '_metadata.txt')}.pdf`,
    `url: ${url}`,
    `sizeBytes: ${size}`,
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
    `xmpPresent: ${xmp.present}`,
    '---',
    xmp.content,
  ];
  fs.writeFileSync(metadataPath, lines.join('\n') + '\n');
}

(async () => {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const { data } = JSON.parse(fs.readFileSync('allTransmissionCodes.json', 'utf8'));
  const nodes = shuffleArray([...data.status3.nodes, ...data.status11.nodes]);

  console.log(`Found ${nodes.length.toLocaleString()} transmission nodes.`);
  console.log(`Downloading ${LIMIT} random PDF(s)...\n`);

  const browser = await firefox.launch({ headless: process.env.HEADLESS !== 'false' });

  try {
    for (let i = 0; i < Math.min(LIMIT, nodes.length); i++) {
      const node = nodes[i];
      const url = buildPdfUrl(node);
      const location = lookupLocation(node);
      const { dir, pdfPath, metadataPath } = buildOutputPaths(node);

      console.log(`[${i + 1}/${LIMIT}] ${url}`);
      console.log(`  Location: ${location.department} > ${location.municipality} > ${location.zone} > ${location.stand} (table ${node.numberStand})`);
      try {
        fs.mkdirSync(dir, { recursive: true });
        await downloadPdf(browser, url, pdfPath);
        const size = fs.statSync(pdfPath).size;
        const xmp = await extractXmpMetadata(pdfPath);
        writeMetadata(metadataPath, { url, size, xmp, node, location });
        console.log(`  Saved: ${path.relative(OUTPUT_DIR, pdfPath)} (${size.toLocaleString()} bytes)`);
        console.log(`  XMP present: ${xmp.present}`);
      } catch (err) {
        console.error(`  ERROR: ${err.message}`);
        console.error(`  Lookup for manual verification: ${location.department} > ${location.municipality} > ${location.zone} > ${location.stand} (table ${node.numberStand})`);
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
