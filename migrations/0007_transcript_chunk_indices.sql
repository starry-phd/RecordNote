-- Idempotency for server-generated transcript chunks; legacy rows may have NULL markers.
ALTER TABLE transcript_segments ADD COLUMN source_job_id TEXT;
ALTER TABLE transcript_segments ADD COLUMN chunk_index INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS idx_transcript_chunk_dedup
 ON transcript_segments(recording_id,source_job_id,chunk_index);
CREATE INDEX IF NOT EXISTS idx_transcript_source
 ON transcript_segments(source_job_id,recording_id);
