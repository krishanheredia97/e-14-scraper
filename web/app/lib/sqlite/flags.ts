import { getDatabase } from "./connection";

export type FlagType = "error" | "fraud" | "ok";

export function upsertFlag(
  documentId: number,
  flagType: FlagType,
  fingerprint: string,
) {
  const db = getDatabase();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO flags (document_id, flag_type, fingerprint)
     VALUES (?, ?, ?)`,
  );
  const result = insert.run(documentId, flagType, fingerprint);
  return { changed: result.changes > 0 };
}

export function getFlagCounts(documentId: number) {
  const db = getDatabase();
  const stmt = db.prepare(
    "SELECT error_count, fraud_count, ok_count FROM flag_counts WHERE document_id = ?",
  );
  return (stmt.get(documentId) as
    | { error_count: number; fraud_count: number; ok_count: number }
    | undefined) ?? { error_count: 0, fraud_count: 0, ok_count: 0 };
}

export interface AlertRow {
  id: number;
  file_name: string;
  url: string;
  department: string | null;
  municipality: string | null;
  zone: string | null;
  stand: string | null;
  error_count: number;
  fraud_count: number;
  ok_count: number;
}

export function getAlerts(
  options: { limit?: number; offset?: number } = {},
): AlertRow[] {
  const db = getDatabase();
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;

  const stmt = db.prepare(
    `SELECT
       d.id,
       d.file_name,
       d.url,
       d.department,
       d.municipality,
       d.zone,
       d.stand,
       COALESCE(fc.error_count, 0) as error_count,
       COALESCE(fc.fraud_count, 0) as fraud_count,
       COALESCE(fc.ok_count, 0) as ok_count
     FROM documents d
     JOIN flag_counts fc ON fc.document_id = d.id
     WHERE fc.fraud_count > 0 OR fc.error_count > 0
     ORDER BY fc.fraud_count DESC, fc.error_count DESC, fc.updated_at DESC
     LIMIT ? OFFSET ?`,
  );

  return stmt.all(limit, offset) as AlertRow[];
}

export function getTotalAlertCount(): number {
  const db = getDatabase();
  const stmt = db.prepare(
    `SELECT COUNT(*) as count
     FROM flag_counts
     WHERE fraud_count > 0 OR error_count > 0`,
  );
  const row = stmt.get() as { count: number } | undefined;
  return row?.count ?? 0;
}
