-- Synthetic AI lab only. Does not store real user data, recordings, or payment information.
CREATE TABLE IF NOT EXISTS ai_daily_reservations (
 id TEXT PRIMARY KEY,
 usage_day TEXT NOT NULL,
 job_id TEXT NOT NULL,
 model TEXT NOT NULL,
 estimated_micro_usd INTEGER NOT NULL CHECK(estimated_micro_usd > 0),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_daily_spend ON ai_daily_reservations(usage_day);
