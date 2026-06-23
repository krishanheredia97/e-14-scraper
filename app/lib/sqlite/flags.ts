import { getDatabase } from "./connection";
import { getDocumentMetadataByFileName } from "../metadata";

export type FlagType = "error" | "fraud" | "ok";

export function upsertFlag(
  fileName: string,
  flagType: FlagType,
  fingerprint: string,
) {
  const db = getDatabase();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO flags (file_name, flag_type, fingerprint)
     VALUES (?, ?, ?)`,
  );
  const result = insert.run(fileName, flagType, fingerprint);
  return { changed: result.changes > 0 };
}

export function getFlagCounts(fileName: string) {
  const db = getDatabase();
  const stmt = db.prepare(
    "SELECT error_count, fraud_count, ok_count FROM flag_counts WHERE file_name = ?",
  );
  return (stmt.get(fileName) as
    | { error_count: number; fraud_count: number; ok_count: number }
    | undefined) ?? { error_count: 0, fraud_count: 0, ok_count: 0 };
}

export interface AlertRow {
  file_name: string;
  url: string;
  department: string | null;
  municipality: string | null;
  zone: string | null;
  stand: string | null;
  stand_code: string | null;
  error_count: number;
  fraud_count: number;
  ok_count: number;
}

export async function getAlerts(
  options: { limit?: number; offset?: number } = {},
): Promise<AlertRow[]> {
  const db = getDatabase();
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;

  const stmt = db.prepare(
    `SELECT
       fc.file_name,
       COALESCE(fc.error_count, 0) as error_count,
       COALESCE(fc.fraud_count, 0) as fraud_count,
       COALESCE(fc.ok_count, 0) as ok_count
     FROM flag_counts fc
     WHERE fc.fraud_count > 0 OR fc.error_count > 0
     ORDER BY fc.fraud_count DESC, fc.error_count DESC, fc.updated_at DESC
     LIMIT ? OFFSET ?`,
  );

  const rows = stmt.all(limit, offset) as {
    file_name: string;
    error_count: number;
    fraud_count: number;
    ok_count: number;
  }[];

  const alerts = await Promise.all(
    rows.map(async (row) => {
      const metadata = await getDocumentMetadataByFileName(row.file_name);
      return {
        file_name: row.file_name,
        url: metadata?.url ?? "",
        department: metadata?.department ?? null,
        municipality: metadata?.municipality ?? null,
        zone: metadata?.zone ?? null,
        stand: metadata?.stand ?? null,
        stand_code: metadata?.stand_code ?? null,
        error_count: row.error_count,
        fraud_count: row.fraud_count,
        ok_count: row.ok_count,
      };
    }),
  );

  return alerts;
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
