import sqlite3,unittest,uuid
from pathlib import Path
BASE=Path(__file__).resolve().parent.parent/'migrations'
class LabBudget(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  self.db.executescript((BASE/'0004_ai_lab_budget.sql').read_text())
 def reserve(self,day='2026-10-23',charge=80000):
  return self.db.execute('''INSERT INTO ai_daily_reservations(id,usage_day,job_id,model,estimated_micro_usd)
  SELECT ?,?,?,?,?
  WHERE (SELECT COUNT(*) FROM ai_daily_reservations WHERE usage_day=?) < 10
  AND (SELECT COALESCE(SUM(estimated_micro_usd),0) FROM ai_daily_reservations WHERE usage_day=?) + ? <= ?
  RETURNING id''',(str(uuid.uuid4()),day,'synthetic-123456789','model',charge,day,day,charge,1000000)).fetchone()
 def test_ten_calls_daily_ceiling(self):
  for _ in range(10):self.assertIsNotNone(self.reserve())
  self.assertIsNone(self.reserve())
  self.assertIsNotNone(self.reserve('2026-10-24'))
 def test_dollar_ceiling_even_before_ten_calls(self):
  for _ in range(5):self.assertIsNotNone(self.reserve(charge=200000))
  self.assertIsNone(self.reserve(charge=100))
 def test_index(self):
  self.assertTrue(any(row[1]=='idx_ai_daily_spend' for row in self.db.execute('PRAGMA index_list(ai_daily_reservations)').fetchall()))
if __name__=='__main__':unittest.main()
