"""Offline SQLite constraint checks: never use production D1 for tests."""
from pathlib import Path
import sqlite3
import unittest

SQL=(Path(__file__).parent.parent/'migrations'/'0001_init.sql').read_text()
class SchemaTests(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(':memory:')
        self.db.execute('PRAGMA foreign_keys=ON')
        self.db.executescript(SQL)
        self.db.execute("INSERT INTO members(user_id) VALUES ('u1')")
        self.db.execute("INSERT INTO courses(id,owner_user_id,title) VALUES ('c1','u1','Test course')")
    def test_tenth_recording_allowed_but_eleventh_rejected(self):
        for i in range(1,11):
            self.db.execute('INSERT INTO recordings(id,course_id,slot,title,duration_seconds) VALUES (?,?,?,?,?)',(f'r{i}','c1',i,'lecture',6000))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO recordings(id,course_id,slot,title,duration_seconds) VALUES ('r11','c1',11,'lecture',20)")
    def test_duration_limit(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO recordings(id,course_id,slot,title,duration_seconds) VALUES ('r1','c1',1,'lecture',6001)")
    def test_media_limits(self):
        self.db.execute("INSERT INTO recordings(id,course_id,slot,title,duration_seconds) VALUES ('r1','c1',1,'lecture',60)")
        self.db.execute("INSERT INTO media(id,recording_id,kind,position,duration_seconds,object_key) VALUES ('i50','r1','image',50,0,'key')")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO media(id,recording_id,kind,position,duration_seconds,object_key) VALUES ('i51','r1','image',51,0,'key')")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO media(id,recording_id,kind,position,duration_seconds,object_key) VALUES ('v11','r1','video',1,11,'key')")
    def test_share_does_not_default_ai_or_download(self):
        self.db.execute("INSERT INTO grants(id,course_id,granted_user_id) VALUES ('g1','c1','u2')")
        self.assertEqual(self.db.execute("SELECT allow_download,allow_ai FROM grants WHERE id='g1'").fetchone(),(0,0))
if __name__=='__main__':unittest.main()
