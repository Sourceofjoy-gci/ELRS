"""
Tests for seed_corpus.py — CSV seeding and schema init.
Run: pytest backend/tests/test_seed_corpus.py -v
"""
import pytest
import sys
import sqlite3
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from seed_corpus import init_db, seed_from_csv


class TestInitDb:
    def test_creates_schema(self):
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        try:
            init_db(db_path)
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()

            # Check table exists
            cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='judgments'")
            assert cur.fetchone() is not None

            # Check FTS virtual table exists
            cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='judgments_fts'")
            assert cur.fetchone() is not None

            # Check case_status column exists (P1 feature)
            cur.execute("PRAGMA table_info(judgments)")
            columns = {row[1] for row in cur.fetchall()}
            assert "case_status" in columns

            conn.close()
        finally:
            db_path.unlink(missing_ok=True)


class TestSeedFromCsv:
    def test_inserts_new_judgments(self):
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        csv_content = """case_name,citation,court,year,case_status,keywords
R v TestCase,SZHC 99/2023,SZHC,2023,active,test keyword
"""
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False, mode="w") as f:
            csv_path = Path(f.name)
            f.write(csv_content)

        try:
            seed_from_csv(csv_path, db_path)

            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            # Query by case_name since citation now stores full "R v TestCase SZHC 99/2023"
            cur.execute("SELECT case_name, citation, case_status FROM judgments WHERE case_name = ?", ("R v TestCase",))
            row = cur.fetchone()
            assert row is not None
            assert row[0] == "R v TestCase"
            assert row[2] == "active"
            conn.close()
        finally:
            db_path.unlink(missing_ok=True)
            csv_path.unlink(missing_ok=True)

    def test_skips_duplicate(self):
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        csv_content = """case_name,citation,court,year,case_status,keywords
R v Duplicate,SZHC 88/2023,SZHC,2023,active,test
R v Duplicate,SZHC 88/2023,SZHC,2023,active,test
"""
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False, mode="w") as f:
            csv_path = Path(f.name)
            f.write(csv_content)

        try:
            # Seed twice — second should be skipped
            seed_from_csv(csv_path, db_path)
            seed_from_csv(csv_path, db_path)

            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            # Citation is UNIQUE — seeded as "R v Duplicate SZHC 88/2023"
            cur.execute("SELECT COUNT(*) FROM judgments WHERE case_name = ?", ("R v Duplicate",))
            count = cur.fetchone()[0]
            assert count == 1  # Only one record
            conn.close()
        finally:
            db_path.unlink(missing_ok=True)
            csv_path.unlink(missing_ok=True)

    def test_missing_case_name_skipped(self):
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        csv_content = """case_name,citation,court,year,case_status,keywords
,SZHC 77/2023,SZHC,2023,active,test
"""
        with tempfile.NamedTemporaryFile(suffix=".csv", delete=False, mode="w") as f:
            csv_path = Path(f.name)
            f.write(csv_content)

        try:
            seed_from_csv(csv_path, db_path)

            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            # No case_name means citation defaults to just "SZHC 77/2023"
            cur.execute("SELECT COUNT(*) FROM judgments WHERE citation = ?", ("SZHC 77/2023",))
            count = cur.fetchone()[0]
            assert count == 0  # Skipped — citation is present but case_name is required
            conn.close()
        finally:
            db_path.unlink(missing_ok=True)
            csv_path.unlink(missing_ok=True)
