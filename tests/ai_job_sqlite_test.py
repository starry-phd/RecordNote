"""Real SQLite verification of the synthetic AI job state and retry spending."""
from pathlib import Path
from sqlite3 import connect, IntegrityError
import unittest
ROOT=Path(__file__).resolve().parent.parent/"migrations"
class LabJobState(unittest.TestCase):
 def setUp(self):
  self.db=connect(":memory:")
  for file in ["0004_ai_lab_budget.sql","0005_ai_synthetic_results.sql","0006_ai_lab_jobs.sql"]:
   self.db.executescript((ROOT/file).read_text())
 def test_retry_counter_cannot_exceed_two(self):
  self.db.execute("INSERT INTO ai_lab_jobs(id,payload_hash) VALUES ('synthetic-example1','digest-one')")
  for n in [1,2]:
   row=self.db.execute("""UPDATE ai_lab_jobs SET attempts=attempts+1,status='processing'
    WHERE id=? AND payload_hash=? AND status!='succeeded' AND attempts<?
    RETURNING attempts""",('synthetic-example1','digest-one',2)).fetchone()
   self.assertEqual(row,(n,))
  self.assertIsNone(self.db.execute("""UPDATE ai_lab_jobs SET attempts=attempts+1
   WHERE id=? AND attempts<? RETURNING attempts""",('synthetic-example1',2)).fetchone())
 def test_attempt_reservations_unique(self):
  self.db.execute("""INSERT INTO ai_daily_reservations
   (id,usage_day,job_id,model,estimated_micro_usd) VALUES ('a','2026-10-24','synthetic-example1:1','llama',40000)""")
  self.db.execute("""INSERT INTO ai_daily_reservations
   (id,usage_day,job_id,model,estimated_micro_usd) VALUES ('b','2026-10-24','synthetic-example1:2','llama',40000)""")
  with self.assertRaises(IntegrityError):
   self.db.execute("""INSERT INTO ai_daily_reservations
    (id,usage_day,job_id,model,estimated_micro_usd) VALUES ('c','2026-10-24','synthetic-example1:1','llama',40000)""")
  total=self.db.execute("SELECT SUM(estimated_micro_usd) FROM ai_daily_reservations").fetchone()[0]
  self.assertEqual(total,80000)
 def test_payload_mismatch_cannot_replace_original_record(self):
  self.db.execute("INSERT INTO ai_lab_jobs(id,payload_hash) VALUES ('synthetic-example1','original')")
  self.db.execute("""INSERT INTO ai_lab_jobs(id,payload_hash) VALUES ('synthetic-example1','changed')
    ON CONFLICT(id) DO NOTHING""")
  self.assertEqual(self.db.execute("SELECT payload_hash FROM ai_lab_jobs").fetchone()[0],"original")
 def test_incorrect_status_or_attempts_rejected(self):
  with self.assertRaises(IntegrityError):
   self.db.execute("INSERT INTO ai_lab_jobs(id,payload_hash,status) VALUES ('x','digest','invalid')")
  with self.assertRaises(IntegrityError):
   self.db.execute("INSERT INTO ai_lab_jobs(id,payload_hash,attempts) VALUES ('y','digest',3)")
if __name__=="__main__":unittest.main()
