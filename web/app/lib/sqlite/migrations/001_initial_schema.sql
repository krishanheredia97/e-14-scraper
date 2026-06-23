-- Initial schema for E-14 review database

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL UNIQUE,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_name TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  department TEXT,
  municipality TEXT,
  zone TEXT,
  stand TEXT,
  size_bytes INTEGER,
  downloaded_at TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS flags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  flag_type TEXT NOT NULL CHECK(flag_type IN ('error', 'fraud', 'ok')),
  fingerprint TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(document_id, fingerprint, flag_type),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_flags_document_id ON flags(document_id);
CREATE INDEX IF NOT EXISTS idx_flags_fingerprint ON flags(fingerprint);

CREATE TABLE IF NOT EXISTS flag_counts (
  document_id INTEGER PRIMARY KEY,
  error_count INTEGER NOT NULL DEFAULT 0,
  fraud_count INTEGER NOT NULL DEFAULT 0,
  ok_count INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_flag_counts_fraud ON flag_counts(fraud_count);
CREATE INDEX IF NOT EXISTS idx_flag_counts_error ON flag_counts(error_count);

-- Maintain materialized flag counts automatically
CREATE TRIGGER IF NOT EXISTS trg_flags_insert
AFTER INSERT ON flags
BEGIN
  INSERT INTO flag_counts (document_id, error_count, fraud_count, ok_count, updated_at)
  VALUES (
    NEW.document_id,
    CASE WHEN NEW.flag_type = 'error' THEN 1 ELSE 0 END,
    CASE WHEN NEW.flag_type = 'fraud' THEN 1 ELSE 0 END,
    CASE WHEN NEW.flag_type = 'ok' THEN 1 ELSE 0 END,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT(document_id) DO UPDATE SET
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
  WHERE document_id = OLD.document_id;
END;

PRAGMA foreign_keys = ON;
