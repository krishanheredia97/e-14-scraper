import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "fs";
import path from "path";
import { syncDocumentsFromMetadata } from "./documents";

function getDataDirectory(): string {
  if (process.env.DATA_DIR) {
    return process.env.DATA_DIR;
  }
  return path.join(process.cwd(), "data");
}

const DB_PATH = path.join(getDataDirectory(), "e14-review.db");

try {
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
} catch {
  // ignore
}

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);

    db.pragma("journal_mode = WAL");

    try {
      const checkpointResult = db.pragma("wal_checkpoint(TRUNCATE)") as {
        busy: number;
        log: number;
        checkpointed: number;
      };
      console.log(
        "SQLite WAL checkpoint on startup:",
        `busy=${checkpointResult.busy}, log=${checkpointResult.log}, checkpointed=${checkpointResult.checkpointed}`,
      );
    } catch (error) {
      console.warn("SQLite WAL checkpoint on startup failed:", error);
    }

    initializeSchema(db);
    db.pragma("foreign_keys = ON");

    syncDocuments();

    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    setInterval(() => {
      try {
        const checkpointResult = db!.pragma("wal_checkpoint(TRUNCATE)") as {
          busy: number;
          log: number;
          checkpointed: number;
        };
        if (checkpointResult.log > 0) {
          console.log(
            "SQLite WAL periodic checkpoint:",
            `log=${checkpointResult.log}, checkpointed=${checkpointResult.checkpointed}`,
          );
        }
      } catch (error) {
        console.warn("SQLite WAL periodic checkpoint failed:", error);
      }
    }, FIVE_MINUTES_MS);
  }

  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function initializeSchema(database: Database.Database): void {
  database.pragma("foreign_keys = OFF");

  // Ensure migrations table exists before checking applied migrations
  database.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const migrationFiles = ["001_initial_schema.sql", "002_add_stand_code.sql"];

  for (const filename of migrationFiles) {
    try {
      const checkStmt = database.prepare(
        "SELECT 1 FROM migrations WHERE filename = ?",
      );
      const alreadyApplied = checkStmt.get(filename);

      if (!alreadyApplied) {
        const migrationPath = path.join(
          process.cwd(),
          "app",
          "lib",
          "sqlite",
          "migrations",
          filename,
        );
        const migrationSQL = readFileSync(migrationPath, "utf8");

        database.exec(migrationSQL);

        const insertStmt = database.prepare(
          "INSERT OR IGNORE INTO migrations (filename) VALUES (?)",
        );
        insertStmt.run(filename);

        console.log(`Applied migration: ${filename}`);
      }
    } catch (error) {
      console.error(`Failed to apply migration ${filename}:`, error);
      throw error;
    }
  }

  database.pragma("foreign_keys = ON");
}

function syncDocuments(): void {
  syncDocumentsFromMetadata()
    .then((result) => {
      if (result.inserted > 0) {
        console.log(
          `Synced documents: ${result.inserted} inserted, ${result.skipped} already present`,
        );
      }
    })
    .catch((error) => {
      console.error("Failed to sync documents:", error);
    });
}

process.on("SIGINT", () => {
  closeDatabase();
  process.exit(0);
});

process.on("SIGTERM", () => {
  closeDatabase();
  process.exit(0);
});
