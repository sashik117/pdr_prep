#!/usr/bin/env python3
from __future__ import annotations

import json
import os

import psycopg

from database_setup import DATABASE_URL, QUESTIONS_FILE, ensure_schema, flatten_questions, import_questions


def main() -> None:
    if not DATABASE_URL:
        raise SystemExit("DATABASE_URL is required")

    with psycopg.connect(DATABASE_URL) as conn:
        ensure_schema(conn)
        question_count = conn.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
        if question_count:
            print(f"Database already has {question_count} questions. Skipping question import.")
            return

        if os.getenv("SKIP_QUESTION_IMPORT", "").strip().lower() in {"1", "true", "yes"}:
            print("SKIP_QUESTION_IMPORT is enabled. Skipping question import.")
            return

        raw_data = json.loads(QUESTIONS_FILE.read_text(encoding="utf-8"))
        questions = flatten_questions(raw_data)
        imported = import_questions(conn, questions)
        print(f"Database bootstrap complete. Imported {imported} questions.")


if __name__ == "__main__":
    main()
