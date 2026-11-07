"""Database-level quota safety checks mirroring the exact D1 atomic SQL."""
from pathlib import Path
from sqlite3 import connect,IntegrityError
import unittest,uuid

root=Path(__file__).resolve().parent.parent
SQL=(root/'migrations'/'0001_init.sql').read_text()
MIGRATION=(root/'migrations'/'0002_quota_indices.sql').read_text()
INSERT="""INSERT INTO usage_events(id,user_id,kind,units,billing_period,idempotency_key)
SELECT ?,?,?,?,?,?
WHERE EXISTS (SELECT 1 FROM members WHERE user_id=? AND plan=?)
AND (SELECT COALESCE(SUM(units),0) FROM usage_events WHERE user_id=? AND kind=? AND billing_period=?) + ? <= ?
ON CONFLICT(user_id,kind,idempotency_key) DO NOTHING
RETURNING id"""
class Tests(unittest.TestCase):
 def setUp(self):
  self.db=connect(':memory:')
  self.db.execute('PRAGMA foreign_keys=ON')
  self.db.executescript(SQL)
  self.db.executescript(MIGRATION)
  self.db.executemany('INSERT INTO members(user_id,plan) VALUES (?,?)',[('user1','free'),('user2','free'),('paid','standard')])
 def charge(self,user,kind,period,units,cap,key,plan='free'):
  return self.db.execute(INSERT,(str(uuid.uuid4()),user,kind,units,period,key,user,plan,user,kind,period,units,cap)).fetchone()
 def used(self,user,kind,period):
  return self.db.execute('SELECT COALESCE(SUM(units),0) FROM usage_events WHERE user_id=? AND kind=? AND billing_period=?',(user,kind,period)).fetchone()[0]
 def test_free_limit_exact_and_rejected_overage(self):
  p='free:lifetime';k='transcription_seconds'
  self.assertIsNotNone(self.charge('user1',k,p,1700,1800,'job-0001'))
  self.assertIsNone(self.charge('user1',k,p,101,1800,'job-0002'))
  self.assertIsNotNone(self.charge('user1',k,p,100,1800,'job-0003'))
  self.assertEqual(self.used('user1',k,p),1800)
 def test_retry_same_key_no_double_charge(self):
  p='free:lifetime';k='ai_questions'
  self.assertIsNotNone(self.charge('user1',k,p,1,10,'query-0001'))
  self.assertIsNone(self.charge('user1',k,p,1,10,'query-0001'))
  self.assertEqual(self.used('user1',k,p),1)
 def test_private_users_separate_usage(self):
  p='free:lifetime';k='ocr_images'
  self.assertIsNotNone(self.charge('user1',k,p,10,10,'ocr-00001'))
  self.assertIsNotNone(self.charge('user2',k,p,10,10,'ocr-00001'))
  self.assertEqual(self.used('user1',k,p),10)
  self.assertEqual(self.used('user2',k,p),10)
 def test_paid_billing_window_resets_only_when_provider_changes_key(self):
  k='transcription_seconds';p1='paid:2026-10-01T00:00:00Z:2026-11-01T00:00:00Z';p2='paid:2026-11-01T00:00:00Z:2026-12-01T00:00:00Z'
  self.assertIsNotNone(self.charge('paid',k,p1,36000,36000,'trans-0001','standard'))
  self.assertIsNone(self.charge('paid',k,p1,1,36000,'trans-0002','standard'))
  self.assertIsNotNone(self.charge('paid',k,p2,600,36000,'trans-0003','standard'))
 def test_plan_mismatch_and_unknown_user_never_charge(self):
  self.assertIsNone(self.charge('user1','ai_questions','free:lifetime',1,10,'no-plan01','standard'))
  self.assertIsNone(self.charge('absent','ai_questions','free:lifetime',1,10,'not-found','free'))
 def test_quota_events_have_supporting_index(self):
  indexes=self.db.execute('PRAGMA index_list(usage_events)').fetchall()
  self.assertTrue(any('idx_usage_user_kind_period'==x[1] for x in indexes))
if __name__=='__main__':unittest.main()
