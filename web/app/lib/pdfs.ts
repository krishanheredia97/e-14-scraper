import { getDatabase } from "./sqlite/connection";

const BATCH_SIZE = 10;

export function getRandomBatch(size = BATCH_SIZE) {
  const db = getDatabase();

  const totalStmt = db.prepare("SELECT COUNT(*) as count FROM documents");
  const totalRow = totalStmt.get() as { count: number } | undefined;
  const total = totalRow?.count ?? 0;

  if (total === 0) {
    return { names: [] as string[], total: 0 };
  }

  const stmt = db.prepare(
    "SELECT file_name FROM documents ORDER BY RANDOM() LIMIT ?",
  );
  const rows = stmt.all(size) as { file_name: string }[];

  return { names: rows.map((row) => row.file_name), total };
}
