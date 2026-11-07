"""Real SQLite transcription safety and idempotency integration tests."""
from pathlib import Path
import sqlite3, unittest, uuid
ROOT=Path(__file__).resolve().parent.parent/'migrations'
RID='11111111-1111-4111-8111-111111111111'
JOB='22222222-2222-4222-8222-222222222222'
STATEMENT='''INSERT INTO transcript_segments(
 id,recording_id,start_ms,end_ms,speaker,text,revision,source_job_id,chunk_index)
 SELECT ?,r.id,?,?,?,?,1,?,? FROM recordings r
 JOIN courses c ON c.id=r.course_id
 WHERE r.id=? AND c.owner_user_id=? AND c.deleted_at IS NULL
 AND r.status='verified' AND r.verified_object_key IS NOT NULL
 ON CONFLICT(recording_id,source_job_id,chunk_index) DO NOTHING RETURNING id'''
class TranscriptSafety(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  self.db.execute('PRAGMA foreign_keys=ON')
  for migration in ['0001_init.sql','0002_quota_indices.sql','0003_retention_fields.sql','0007_transcript_chunk_indices.sql']:
   self.db.executescript((ROOT/migration).read_text())
  self.db.executemany('INSERT INTO members(user_id) VALUES (?)',[('alice',),('bob',)])
  self.db.execute("INSERT INTO courses(id,owner_user_id,title) VALUES ('course-a','alice','Lesson')")
  self.db.execute('''INSERT INTO recordings(id,course_id,slot,title,duration_seconds,status,verified_object_key)
    VALUES (?,?,?,?,?,?,?)''',(RID,'course-a',1,'Voice recording',100,'verified','verified/alice/file.m4a'))
 def insert(self,owner='alice',job=JOB,idx=0):
  return self.db.execute(STATEMENT,(str(uuid.uuid4()),1000,2500,None,'synthetic words',job,idx,RID,owner)).fetchone()
 def test_owner_insert_and_retry_dedupe(self):
  self.assertIsNotNone(self.insert())
  self.assertIsNone(self.insert())
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM transcript_segments').fetchone()[0],1)
 def test_separate_chunk_indexes_allowed(self):
  self.assertIsNotNone(self.insert(idx=0))
  self.assertIsNotNone(self.insert(idx=1))
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM transcript_segments').fetchone()[0],2)
 def test_other_member_cannot_write_even_if_knows_recording_id(self):
  self.assertIsNone(self.insert(owner='bob'))
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM transcript_segments').fetchone()[0],0)
 def test_unverified_audio_cannot_receive_transcript(self):
  self.db.execute("UPDATE recordings SET status='quarantine' WHERE id=?",(RID,))
  self.assertIsNone(self.insert())
 def test_deleted_course_cannot_receive_transcript(self):
  self.db.execute("UPDATE courses SET deleted_at=CURRENT_TIMESTAMP WHERE id='course-a'")
  self.assertIsNone(self.insert())
if __name__=='__main__':unittest.main()
