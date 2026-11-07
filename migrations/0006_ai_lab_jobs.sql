-- AI lab work state is isolated from member data. Jobs may retry twice with separate spending reservations.
CREATE TABLE IF NOT EXISTS ai_lab_jobs(
  id TEXT PRIMARY KEY,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','succeeded')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 2),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_lab_jobs_status ON ai_lab_jobs(status);
