import { readdir, readFile } from "fs/promises";
import path from "path";

export interface DocumentMetadata {
  file_name: string;
  url: string;
  department: string | null;
  municipality: string | null;
  zone: string | null;
  stand: string | null;
  stand_code: string | null;
  size_bytes: number | null;
}

interface MetadataPayload {
  file: string;
  url: string;
  sizeBytes?: number;
  department?: string;
  municipality?: string;
  zone?: string;
  stand?: string;
  numberStand?: string;
}

const BATCH_SIZE = 10;

function getMetadataDirectory(): string {
  return path.join(process.cwd(), "scraper", "metadata");
}

export async function listMetadataFileNames(): Promise<string[]> {
  const metadataDir = getMetadataDirectory();
  try {
    const files = await readdir(metadataDir);
    return files.filter((f) => f.toLowerCase().endsWith(".json"));
  } catch {
    return [];
  }
}

export async function countPdfFiles(): Promise<number> {
  const pdfDir = path.join(process.cwd(), "scraper", "pdfs");
  try {
    const files = await readdir(pdfDir);
    return files.filter((f) => f.toLowerCase().endsWith(".pdf")).length;
  } catch {
    return 0;
  }
}

export async function readMetadataFile(
  fileName: string,
): Promise<DocumentMetadata | undefined> {
  const metadataDir = getMetadataDirectory();
  const jsonFileName = fileName.replace(/\.pdf$/i, ".json");
  const jsonPath = path.join(metadataDir, jsonFileName);

  try {
    const content = await readFile(jsonPath, "utf8");
    const parsed = JSON.parse(content) as MetadataPayload;
    if (!parsed.file || !parsed.url) {
      return undefined;
    }

    return {
      file_name: parsed.file,
      url: parsed.url,
      department: parsed.department ?? null,
      municipality: parsed.municipality ?? null,
      zone: parsed.zone ?? null,
      stand: parsed.stand ?? null,
      stand_code: parsed.numberStand ?? null,
      size_bytes: parsed.sizeBytes ?? null,
    };
  } catch {
    return undefined;
  }
}

export async function getDocumentMetadataByFileName(
  fileName: string,
): Promise<DocumentMetadata | undefined> {
  return readMetadataFile(fileName);
}

export async function getAllMetadata(): Promise<DocumentMetadata[]> {
  const fileNames = await listMetadataFileNames();
  const results = await Promise.all(
    fileNames.map((fileName) => readMetadataFile(fileName)),
  );
  return results.filter((m): m is DocumentMetadata => m !== undefined);
}

export async function getRandomBatch(size = BATCH_SIZE): Promise<{
  names: string[];
  metadata: Record<string, DocumentMetadata>;
  total: number;
}> {
  const fileNames = await listMetadataFileNames();
  const total = fileNames.length;

  if (total === 0) {
    return { names: [], metadata: {}, total: 0 };
  }

  const shuffled = fileNames
    .map((fileName) => ({ fileName, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ fileName }) => fileName)
    .slice(0, size);

  const metadataEntries = await Promise.all(
    shuffled.map(async (fileName) => {
      const metadata = await readMetadataFile(fileName);
      return metadata ? ([fileName.replace(/\.json$/i, ".pdf"), metadata] as const) : null;
    }),
  );

  const metadata: Record<string, DocumentMetadata> = {};
  const names: string[] = [];

  for (const entry of metadataEntries) {
    if (!entry) continue;
    const [pdfName, data] = entry;
    names.push(pdfName);
    metadata[pdfName] = data;
  }

  return { names, metadata, total };
}
