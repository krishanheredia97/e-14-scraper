require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { ExifTool } = require("exiftool-vendored");
const { BASE_URL } = require("./constants");

const exiftool = new ExifTool();

const PDF_DIR = path.join(__dirname, "pdfs");
const METADATA_DIR = path.join(__dirname, "metadata");
const LOG_FILE = path.join(__dirname, "download-errors.log");

const CONCURRENCY = 4;
const MIN_DELAY_MS = 300;
const MAX_DELAY_MS = 800;
const REQUEST_TIMEOUT_MS = 120000;
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;

const departmentsTree = JSON.parse(
  fs.readFileSync(path.join(__dirname, "departmentsTree.json"), "utf8"),
).data.departmentsTree;

const lookupTree = buildLookupTree(departmentsTree);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(minMs = MIN_DELAY_MS, maxMs = MAX_DELAY_MS) {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function buildLookupTree(tree) {
  const lookup = {};
  for (const edge of tree.edges) {
    const dept = edge.node;
    const deptCode = dept.idDepartmentCode.padStart(2, "0");
    lookup[deptCode] = {
      name: dept.departmentName,
      municipalities: {},
    };
    for (const muni of dept.municipalities) {
      const muniCode = muni.municipalityCode.padStart(3, "0");
      lookup[deptCode].municipalities[muniCode] = {
        name: muni.municipalityName,
        zones: {},
      };
      for (const zone of muni.zones) {
        const zoneCode = zone.idZoneCode.padStart(2, "0");
        lookup[deptCode].municipalities[muniCode].zones[zoneCode] = {
          name: zone.zoneName,
          stands: {},
        };
        for (const stand of zone.stands) {
          const standCode = stand.standCode.padStart(2, "0");
          lookup[deptCode].municipalities[muniCode].zones[zoneCode].stands[
            standCode
          ] = {
            name: stand.standName,
          };
        }
      }
    }
  }
  return lookup;
}

function lookupLocation(node) {
  const dept = node.idDepartmentCode.padStart(2, "0");
  const muni = node.municipalityCode.padStart(3, "0");
  const zone = node.idZoneCode.padStart(2, "0");
  const stand = node.standCode.padStart(2, "0");
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
  const dept = node.idDepartmentCode.padStart(2, "0");
  const municipality = node.municipalityCode.padStart(3, "0");
  const zone = node.idZoneCode.padStart(3, "0");
  const stand = node.standCode.padStart(2, "0");
  const numberStand = node.numberStand.padStart(3, "0");
  const pdfName = node.expectedName;
  return `${BASE_URL}/assets/temis/pdf/${dept}/${municipality}/${zone}/${stand}/${numberStand}/PRE/${pdfName}`;
}

function buildFileName(node) {
  const dept = node.idDepartmentCode.padStart(2, "0");
  const municipality = node.municipalityCode.padStart(3, "0");
  const zone = node.idZoneCode.padStart(3, "0");
  const stand = node.standCode.padStart(2, "0");
  const numberStand = node.numberStand.padStart(3, "0");
  const corporation = node.idCorporationCode;
  const id = `${dept}-${municipality}-${zone}-${stand}-${numberStand}-${corporation}`;
  return `${id}-${node.expectedName}`;
}

function buildOutputPaths(node) {
  const fileName = buildFileName(node);
  const baseName = fileName.replace(/\.pdf$/i, "");
  return {
    pdfPath: path.join(PDF_DIR, fileName),
    metadataPath: path.join(METADATA_DIR, `${baseName}.json`),
  };
}

function shouldRetryError(err) {
  if (err.name === "AbortError" || err.code === "ETIMEDOUT") return true;
  if (err.code === "ECONNRESET" || err.code === "ECONNREFUSED") return true;
  if (err.code === "ENOTFOUND" || err.code === "EAI_AGAIN") return false;
  if (err.message?.startsWith("Unexpected content-type:")) return true;
  const status = err.status || 0;
  return status >= 500 || status === 429;
}

async function downloadPdf(url, filePath, signal) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0",
      Accept: "application/pdf",
      "Accept-Language": "es-CO,es;q=0.8,en-US;q=0.5,en;q=0.3",
      Referer: `${BASE_URL}/`,
    },
    redirect: "follow",
    signal,
  });

  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("pdf")) {
    throw new Error(`Unexpected content-type: ${contentType}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(filePath, buffer);
}

async function downloadWithRetry(url, filePath) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      await downloadPdf(url, filePath, controller.signal);
      return;
    } catch (err) {
      lastError = err;
      if (attempt === MAX_RETRIES || !shouldRetryError(err)) {
        throw err;
      }
      const delay =
        BASE_RETRY_DELAY_MS * Math.pow(2, attempt) + Math.random() * 1000;
      console.log(
        `  Retry ${attempt + 1}/${MAX_RETRIES} after ${Math.round(delay)}ms (${err.message})`,
      );
      await sleep(delay);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

async function extractXmpMetadata(filePath) {
  const tags = await exiftool.read(filePath, ["-b", "-XMP"]);
  if (tags.XMP && String(tags.XMP).trim().length > 0) {
    return { present: true, content: String(tags.XMP) };
  }
  return { present: false, content: "No XMP metadata found in this PDF." };
}

function writeMetadata(
  metadataPath,
  { url, size, xmp, node, location, downloadedAt, downloadDurationMs },
) {
  const payload = {
    file: `${path.basename(metadataPath, ".json")}.pdf`,
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
  fs.writeFileSync(metadataPath, JSON.stringify(payload, null, 2) + "\n");
}

function logError({ node, location, url, error }) {
  const timestamp = new Date().toISOString();
  const line =
    [
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
      "---",
    ].join("\n") + "\n";
  fs.appendFileSync(LOG_FILE, line);
}

function sortNodes(nodes) {
  return [...nodes].sort((a, b) => {
    const aUrl = buildPdfUrl(a);
    const bUrl = buildPdfUrl(b);
    return aUrl.localeCompare(bUrl);
  });
}

async function processNode(node, index, total) {
  const url = buildPdfUrl(node);
  const location = lookupLocation(node);
  const { pdfPath, metadataPath } = buildOutputPaths(node);

  console.log(`[${index + 1}/${total}] ${url}`);
  console.log(
    `  Location: ${location.department} > ${location.municipality} > ${location.zone} > ${location.stand} (table ${node.numberStand})`,
  );

  try {
    const downloadStartedAt = Date.now();
    await downloadWithRetry(url, pdfPath);
    const size = fs.statSync(pdfPath).size;
    const xmp = await extractXmpMetadata(pdfPath);
    const downloadedAt = new Date().toISOString();
    const downloadDurationMs = Date.now() - downloadStartedAt;
    writeMetadata(metadataPath, {
      url,
      size,
      xmp,
      node,
      location,
      downloadedAt,
      downloadDurationMs,
    });
    console.log(
      `  Saved: ${path.basename(pdfPath)} (${size.toLocaleString()} bytes)`,
    );
    console.log(`  XMP present: ${xmp.present}`);
  } catch (err) {
    console.error(`  ERROR: ${err.message}`);
    console.error(
      `  Lookup for manual verification: ${location.department} > ${location.municipality} > ${location.zone} > ${location.stand} (table ${node.numberStand})`,
    );
    logError({ node, location, url, error: err.message });
  }
}

async function runWorker(name, nextNode) {
  while (true) {
    const item = nextNode();
    if (!item) break;
    await processNode(item.node, item.index, item.total);
    const delay = randomDelay();
    console.log(`  [${name}] Sleeping ${delay}ms...`);
    await sleep(delay);
  }
}

(async () => {
  fs.mkdirSync(PDF_DIR, { recursive: true });
  fs.mkdirSync(METADATA_DIR, { recursive: true });

  const { data } = JSON.parse(
    fs.readFileSync(path.join(__dirname, "allTransmissionCodes.json"), "utf8"),
  );
  const allNodes = sortNodes([...data.status3.nodes, ...data.status11.nodes]);
  console.log(`Found ${allNodes.length.toLocaleString()} transmission nodes.`);

  console.log("Scanning already downloaded PDFs...");
  const existingPdfs = new Set(fs.readdirSync(PDF_DIR));
  const nodes = allNodes.filter(
    (node) => !existingPdfs.has(buildFileName(node)),
  );
  const total = nodes.length;

  console.log(`Remaining to download: ${total.toLocaleString()} nodes.`);
  console.log(`Concurrency: ${CONCURRENCY} workers`);

  let currentIndex = 0;
  function nextNode() {
    if (currentIndex >= total) return null;
    const item = { node: nodes[currentIndex], index: currentIndex, total };
    currentIndex++;
    return item;
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, i) =>
    runWorker(`worker-${i + 1}`, nextNode),
  );

  await Promise.all(workers);
  await exiftool.end();

  console.log("\nDone.");
})();
