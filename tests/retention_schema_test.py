"""Retention schema and owner-only mutation checks using real SQLite."""
from pathlib import Path
import sqlite3,unittest
root=Path(__file__).resolve().parent.parent
m=lambda name:(root/'migrations'/name).read_text()
class RetentionTests(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  self.db.execute('PRAGMA foreign_keys=ON')
  for name in ['0001_init.sql','0002_quota_indices.sql','0003_retention_fields.sql']:
   self.db.executescript(m(name))
  self.db.executemany('INSERT INTO members(user_id) VALUES (?)',[('owner',),('stranger',)])
  self.db.execute("INSERT INTO courses(id,owner_user_id,title) VALUES ('lesson','owner','Private lecture')")
 def test_protection_only_owner(self):
  sql="""UPDATE courses SET protected_at=CURRENT_TIMESTAMP
    WHERE id=? AND owner_user_id=? AND deleted_at IS NULL RETURNING id"""
  self.assertIsNone(self.db.execute(sql,('lesson','stranger')).fetchone())
  self.assertEqual(self.db.execute(sql,('lesson','owner')).fetchone(),('lesson',))
  self.assertIsNotNone(self.db.execute("SELECT protected_at FROM courses WHERE id='lesson'").fetchone()[0])
 def test_recent_activity_only_owner(self):
  sql="""UPDATE courses SET last_viewed_at=CURRENT_TIMESTAMP
   WHERE id=? AND owner_user_id=? AND deleted_at IS NULL RETURNING id"""
  self.assertIsNone(self.db.execute(sql,('lesson','stranger')).fetchone())
  self.assertIsNotNone(self.db.execute(sql,('lesson','owner')).fetchone())
 def test_deleted_course_cannot_be_protected(self):
  self.db.execute("UPDATE courses SET deleted_at=CURRENT_TIMESTAMP WHERE id='lesson'")
  self.assertIsNone(self.db.execute("""UPDATE courses SET protected_at=CURRENT_TIMESTAMP
   WHERE id='lesson' AND owner_user_id='owner' AND deleted_at IS NULL RETURNING id""").fetchone())
 def test_grace_fields_do_not_delete_data(self):
  self.db.execute("UPDATE members SET storage_overage_since='2026-10-23',storage_grace_deadline='2027-04-21' WHERE user_id='owner'")
  self.assertEqual(self.db.execute("SELECT COUNT(*) FROM courses").fetchone()[0],1)
  self.assertEqual(self.db.execute("SELECT storage_grace_deadline FROM members WHERE user_id='owner'").fetchone()[0],'2027-04-21')
 def test_index_present(self):
  indexes=self.db.execute('PRAGMA index_list(courses)').fetchall()
  self.assertTrue(any(i[1]=='idx_courses_owner_recent' for i in indexes))
if __name__=='__main__':unittest.main()
