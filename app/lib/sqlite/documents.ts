import { readdir, readFile } from "fs/promises";
import path from "path";
import { getDatabase } from "./connection";

interface MetadataPayload {
  file: string;
  url: string;
  sizeBytes: number;
  downloadedAt: string;
  department?: string;
  municipality?: string;
  zone?: string;
  stand?: string;
  numberStand?: string;
}

export async function seedDocumentsFromMetadata(): Promise<{
  inserted: number;
  skipped: number;
}> {
  const db = getDatabase();
  const metadataDir = path.join(process.cwd(), "scraper", "metadata");

  let files: string[];
  try {
    files = await readdir(metadataDir);
  } catch {
    return { inserted: 0, skipped: 0 };
  }

  const insert = db.prepare(
    `INSERT OR IGNORE INTO documents
     (file_name, url, size_bytes, downloaded_at, department, municipality, zone, stand, stand_code)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  let inserted = 0;
  let skipped = 0;

  const transaction = db.transaction((rows: MetadataPayload[]) => {
    for (const row of rows) {
      const result = insert.run(
        row.file,
        row.url,
        row.sizeBytes ?? null,
        row.downloadedAt ?? null,
        row.department ?? null,
        row.municipality ?? null,
        row.zone ?? null,
        row.stand ?? null,
        row.numberStand ?? null,
      );
      if (result.changes > 0) {
        inserted++;
      } else {
        skipped++;
      }
    }
  });

  const rows: MetadataPayload[] = [];
  for (const file of files.filter((f) => f.toLowerCase().endsWith(".json"))) {
    try {
      const content = await readFile(path.join(metadataDir, file), "utf8");
      const parsed = JSON.parse(content) as MetadataPayload;
      if (parsed.file && parsed.url) {
        rows.push(parsed);
      }
    } catch {
      // ignore malformed metadata files
    }
  }

  transaction(rows);

  return { inserted, skipped };
}

export function getDocumentByFileName(fileName: string) {
  const db = getDatabase();
  const stmt = db.prepare("SELECT id, file_name, url FROM documents WHERE file_name = ?");
  return stmt.get(fileName) as { id: number; file_name: string; url: string } | undefined;
}

export interface DocumentMetadata {
  id: number;
  file_name: string;
  url: string;
  department: string | null;
  municipality: string | null;
  zone: string | null;
  stand: string | null;
  stand_code: string | null;
  size_bytes: number | null;
}

export function getDocumentMetadataByFileName(fileName: string): DocumentMetadata | undefined {
  const db = getDatabase();
  const stmt = db.prepare(
    "SELECT id, file_name, url, department, municipality, zone, stand, stand_code, size_bytes FROM documents WHERE file_name = ?",
  );
  return stmt.get(fileName) as DocumentMetadata | undefined;
}
