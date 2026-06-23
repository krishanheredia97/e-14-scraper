PRAGMA foreign_keys = OFF;

-- Migrate flags from document_id to file_name
CREATE TABLE IF NOT EXISTS flags_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_name TEXT NOT NULL,
  flag_type TEXT NOT NULL CHECK(flag_type IN ('error', 'fraud', 'ok')),
  fingerprint TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(file_name, fingerprint, flag_type)
);

CREATE INDEX IF NOT EXISTS idx_flags_file_name ON flags_new(file_name);
CREATE INDEX IF NOT EXISTS idx_flags_fingerprint ON flags_new(fingerprint);

INSERT OR IGNORE INTO flags_new (id, file_name, flag_type, fingerprint, created_at)
SELECT f.id, d.file_name, f.flag_type, f.fingerprint, f.created_at
FROM flags f
JOIN documents d ON d.id = f.document_id;

DROP TABLE IF EXISTS flags;
ALTER TABLE flags_new RENAME TO flags;

-- Migrate flag_counts from document_id to file_name
CREATE TABLE IF NOT EXISTS flag_counts_new (
  file_name TEXT PRIMARY KEY,
  error_count INTEGER NOT NULL DEFAULT 0,
  fraud_count INTEGER NOT NULL DEFAULT 0,
  ok_count INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_flag_counts_fraud ON flag_counts_new(fraud_count);
CREATE INDEX IF NOT EXISTS idx_flag_counts_error ON flag_counts_new(error_count);

INSERT OR IGNORE INTO flag_counts_new (file_name, error_count, fraud_count, ok_count, updated_at)
SELECT d.file_name, fc.error_count, fc.fraud_count, fc.ok_count, fc.updated_at
FROM flag_counts fc
JOIN documents d ON d.id = fc.document_id;

DROP TABLE IF EXISTS flag_counts;
ALTER TABLE flag_counts_new RENAME TO flag_counts;

-- Recreate triggers on new schema
DROP TRIGGER IF EXISTS trg_flags_insert;
DROP TRIGGER IF EXISTS trg_flags_delete;

CREATE TRIGGER IF NOT EXISTS trg_flags_insert
AFTER INSERT ON flags
BEGIN
  INSERT INTO flag_counts (file_name, error_count, fraud_count, ok_count, updated_at)
  VALUES (
    NEW.file_name,
    CASE WHEN NEW.flag_type = 'error' THEN 1 ELSE 0 END,
    CASE WHEN NEW.flag_type = 'fraud' THEN 1 ELSE 0 END,
    CASE WHEN NEW.flag_type = 'ok' THEN 1 ELSE 0 END,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT(file_name) DO UPDATE SET
    error_count = error_count + CASE WHEN NEW.flag_type = 'error' THEN 1 ELSE 0 END,
    fraud_count = fraud_count + CASE WHEN NEW.flag_type = 'fraud' THEN 1 ELSE 0 END,
    ok_count = ok_count + CASE WHEN NEW.flag_type = 'ok' THEN 1 ELSE 0 END,
    updated_at = CURRENT_TIMESTAMP;
END;

CREATE TRIGGER IF NOT EXISTS trg_flags_delete
AFTER DELETE ON flags
BEGIN
  UPDATE flag_counts SET
    error_count = error_count - CASE WHEN OLD.flag_type = 'error' THEN 1 ELSE 0 END,
    fraud_count = fraud_count - CASE WHEN OLD.flag_type = 'fraud' THEN 1 ELSE 0 END,
    ok_count = ok_count - CASE WHEN OLD.flag_type = 'ok' THEN 1 ELSE 0 END,
    updated_at = CURRENT_TIMESTAMP
  WHERE file_name = OLD.file_name;
END;

DROP TABLE IF EXISTS documents;

PRAGMA foreign_keys = ON;
