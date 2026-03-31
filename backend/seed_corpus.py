#!/usr/bin/env python3
"""
Seed the corpus database from a CSV file.

Usage:
    python seed_corpus.py judgments.csv

CSV format (case_name, citation, court, year):
    R v Dlamini, SZHC 45/2018, SZHC, 2018
    S v Nkosi, [2015] HC 12, HC, 2015

The corpus.db is created with the proper schema if it doesn't exist.
"""

import sys
import sqlite3
import csv
from pathlib import Path

CORPUS_DB = Path(__file__).parent / "corpus.db"

SCHEMA = """
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS judgments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_name TEXT NOT NULL,
    citation TEXT UNIQUE NOT NULL,
    court TEXT,
    year INTEGER,
    decision_date TEXT,
    full_text TEXT,
    keywords TEXT,
    case_status TEXT DEFAULT 'active'
    -- active | overruled | distinguished | amended
);

CREATE VIRTUAL TABLE IF NOT EXISTS judgments_fts USING fts5(
    case_name, keywords
);
"""


def init_db(db_path: Path):
    """Create schema."""
    conn = sqlite3.connect(db_path)
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()
    print(f"Database initialized: {db_path}")


def seed_from_csv(csv_path: Path, db_path: Path):
    """Load judgments from CSV into the corpus."""
    if not csv_path.exists():
        print(f"CSV not found: {csv_path}")
        print("Create a CSV with columns: case_name, citation, court, year")
        sys.exit(1)

    init_db(db_path)

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    rows_read = 0
    rows_inserted = 0
    rows_skipped = 0

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows_read += 1
            case_name = row.get("case_name", "").strip()
            citation = row.get("citation", "").strip()
            court = row.get("court", "").strip() or None
            year = row.get("year", "").strip()
            year = int(year) if year.isdigit() else None
            status = row.get("case_status", "active").strip().lower() or "active"
            keywords = row.get("keywords", "").strip() or None

            if not case_name or not citation:
                print(f"  Skipping row {rows_read}: missing case_name or citation")
                rows_skipped += 1
                continue

            # Store the full citation string (case_name + citation) for accurate lookup
            full_citation = f"{case_name} {citation}" if case_name else citation

            try:
                cur.execute(
                    """
                    INSERT OR IGNORE INTO judgments
                    (case_name, citation, court, year, case_status, keywords)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (case_name, full_citation, court, year, status, keywords)
                )
                if cur.rowcount > 0:
                    rows_inserted += 1
                else:
                    rows_skipped += 1
            except sqlite3.Error as e:
                print(f"  Error on row {rows_read}: {e}")
                rows_skipped += 1

    # Rebuild FTS index
    cur.execute("INSERT INTO judgments_fts(judgments_fts) VALUES('rebuild')")

    conn.commit()
    conn.close()

    print(f"CSV read: {rows_read} rows")
    print(f"Inserted: {rows_inserted} judgments")
    print(f"Skipped: {rows_skipped} rows (duplicate or invalid)")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python seed_corpus.py judgments.csv")
        sys.exit(1)

    csv_path = Path(sys.argv[1])
    seed_from_csv(csv_path, CORPUS_DB)
