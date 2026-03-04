-- Migration: Google Drive monitoring support
-- Run this against your Supabase project via the SQL editor or supabase CLI.

-- 1. Add Drive-tracking columns to the documents table
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS drive_file_id       TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS drive_version_hash  TEXT,
  ADD COLUMN IF NOT EXISTS drive_modified_time TEXT;

-- Index for fast lookup by Drive file ID
CREATE INDEX IF NOT EXISTS idx_documents_drive_file_id
  ON documents (drive_file_id);

-- 2. Create the sync state table (one row per monitored folder)
CREATE TABLE IF NOT EXISTS drive_sync_state (
  folder_id      TEXT PRIMARY KEY,
  page_token     TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Row-level security: only the service role (server-side) can access these tables.
--    The anon key used by the browser cannot read drive_sync_state.
ALTER TABLE drive_sync_state ENABLE ROW LEVEL SECURITY;

-- No public SELECT policy for drive_sync_state — service role bypasses RLS.
-- Documents table: existing RLS policies remain unchanged.

-- 4. Ensure trip_metadata has the id column used as upsert key
--    (Only needed if your table does not already have an integer primary key.)
-- ALTER TABLE trip_metadata ADD COLUMN IF NOT EXISTS id INTEGER PRIMARY KEY DEFAULT 1;
