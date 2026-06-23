import { getDatabase } from "./sqlite/connection";
import type { DocumentMetadata } from "./types";

const BATCH_SIZE = 10;

export function getRandomBatch(size = BATCH_SIZE) {
  const db = getDatabase();

  const totalStmt = db.prepare("SELECT COUNT(*) as count FROM documents");
  const totalRow = totalStmt.get() as { count: number } | undefined;
  const total = totalRow?.count ?? 0;

  if (total === 0) {
    return { names: [] as string[], metadata: {} as Record<string, DocumentMetadata>, total: 0 };
  }

  const stmt = db.prepare(
    "SELECT file_name, url, department, municipality, zone, stand, stand_code, size_bytes FROM documents ORDER BY RANDOM() LIMIT ?",
  );
  const rows = stmt.all(size) as DocumentMetadata[];

  return {
    names: rows.map((row) => row.file_name),
    metadata: Object.fromEntries(rows.map((row) => [row.file_name, row])),
    total,
  };
}
