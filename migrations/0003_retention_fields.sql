-- Add metadata only; NEVER schedule deletion from a schema migration.
ALTER TABLE courses ADD COLUMN protected_at TEXT;
ALTER TABLE courses ADD COLUMN last_viewed_at TEXT;
ALTER TABLE members ADD COLUMN storage_overage_since TEXT;
ALTER TABLE members ADD COLUMN storage_grace_deadline TEXT;
CREATE INDEX IF NOT EXISTS idx_courses_owner_recent
  ON courses(owner_user_id,last_viewed_at);
