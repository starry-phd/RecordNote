PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS members (
  user_id TEXT PRIMARY KEY,
  plan TEXT NOT NULL DEFAULT 'free' CHECK(plan IN ('free','standard','professional')),
  used_bytes INTEGER NOT NULL DEFAULT 0 CHECK(used_bytes>=0),
  reserved_bytes INTEGER NOT NULL DEFAULT 0 CHECK(reserved_bytes>=0),
  free_trial_seconds_used INTEGER NOT NULL DEFAULT 0 CHECK(free_trial_seconds_used BETWEEN 0 AND 1800),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL REFERENCES members(user_id),
  title TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_courses_owner ON courses(owner_user_id,created_at);
CREATE TABLE IF NOT EXISTS recordings (
  id TEXT PRIMARY KEY, course_id TEXT NOT NULL REFERENCES courses(id),
  slot INTEGER NOT NULL CHECK(slot BETWEEN 1 AND 10),
  title TEXT NOT NULL,duration_seconds INTEGER NOT NULL CHECK(duration_seconds BETWEEN 1 AND 6000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','uploading','quarantine','verified','failed','deleted')),
  staging_object_key TEXT, verified_object_key TEXT, bytes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(course_id,slot)
);
CREATE INDEX IF NOT EXISTS idx_recordings_course ON recordings(course_id);
CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY, recording_id TEXT NOT NULL REFERENCES recordings(id),
  kind TEXT NOT NULL CHECK(kind IN ('image','video')),
  position INTEGER NOT NULL,duration_seconds REAL DEFAULT 0,width INTEGER,object_key TEXT NOT NULL,ocr_text TEXT,
  CHECK ((kind='image' AND position BETWEEN 1 AND 50 AND duration_seconds=0) OR
         (kind='video' AND position=1 AND duration_seconds BETWEEN 0 AND 10)),
  UNIQUE(recording_id,kind,position)
);
CREATE TABLE IF NOT EXISTS transcript_segments (
  id TEXT PRIMARY KEY,recording_id TEXT NOT NULL REFERENCES recordings(id),
  start_ms INTEGER NOT NULL,end_ms INTEGER NOT NULL,speaker TEXT,text TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_transcript_recording ON transcript_segments(recording_id,start_ms);
CREATE TABLE IF NOT EXISTS grants (
  id TEXT PRIMARY KEY,course_id TEXT NOT NULL REFERENCES courses(id),granted_user_id TEXT NOT NULL,
  allow_download INTEGER NOT NULL DEFAULT 0 CHECK(allow_download IN (0,1)),
  allow_ai INTEGER NOT NULL DEFAULT 0 CHECK(allow_ai IN (0,1)),
  expires_at TEXT,revoked_at TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(course_id,granted_user_id)
);
CREATE INDEX IF NOT EXISTS idx_grants_recipient ON grants(granted_user_id,revoked_at);
CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES members(user_id),
  kind TEXT NOT NULL CHECK(kind IN ('transcription_seconds','ai_questions','ocr_images')),
  units INTEGER NOT NULL CHECK(units>0),billing_period TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id,kind,idempotency_key)
);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,recording_id TEXT NOT NULL REFERENCES recordings(id),kind TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('queued','running','succeeded','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,last_error TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS subscription_events (
  id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES members(user_id),
  provider TEXT NOT NULL CHECK(provider IN ('apple','google','web')),
  external_event_id TEXT NOT NULL,payload_digest TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(provider,external_event_id)
);
