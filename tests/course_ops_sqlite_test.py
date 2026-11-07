"""Actual SQLite exercises owner-only course operations, including deleted items."""
import sqlite3
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent/'migrations'
class CourseOps(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  self.db.execute('PRAGMA foreign_keys=ON')
  for path in ['0001_init.sql','0002_quota_indices.sql','0003_retention_fields.sql']:
   self.db.executescript((ROOT/path).read_text())
  self.db.executemany('INSERT INTO members(user_id) VALUES (?)',[('alice',),('bob',)])
  self.db.executemany('INSERT INTO courses(id,owner_user_id,title) VALUES (?,?,?)',[
    ('c-alice','alice','Private to Alice'),('c-bob','bob','Private to Bob')])
 def test_course_listing_isolated(self):
  rows=self.db.execute('SELECT id FROM courses WHERE owner_user_id=? AND deleted_at IS NULL',('alice',)).fetchall()
  self.assertEqual(rows,[('c-alice',)])
 def test_renaming_does_not_cross_users(self):
  statement='UPDATE courses SET title=? WHERE id=? AND owner_user_id=? AND deleted_at IS NULL RETURNING id'
  self.assertIsNone(self.db.execute(statement,('Stolen','c-bob','alice')).fetchone())
  self.assertEqual(self.db.execute("SELECT title FROM courses WHERE id='c-bob'").fetchone(),('Private to Bob',))
  self.assertEqual(self.db.execute(statement,('My lecture','c-alice','alice')).fetchone(),('c-alice',))
 def test_marking_important_does_not_cross_users(self):
  statement='UPDATE courses SET protected_at=CURRENT_TIMESTAMP WHERE id=? AND owner_user_id=? AND deleted_at IS NULL RETURNING id'
  self.assertIsNone(self.db.execute(statement,('c-bob','alice')).fetchone())
  self.assertIsNotNone(self.db.execute(statement,('c-alice','alice')).fetchone())
 def test_removed_lessons_are_never_mutated(self):
  self.db.execute("UPDATE courses SET deleted_at=CURRENT_TIMESTAMP WHERE id='c-alice'")
  statement='UPDATE courses SET title=? WHERE id=? AND owner_user_id=? AND deleted_at IS NULL RETURNING id'
  self.assertIsNone(self.db.execute(statement,('Resurrected','c-alice','alice')).fetchone())
if __name__=='__main__':unittest.main()
