#!/usr/bin/env python3
from __future__ import annotations

import json
import os

import psycopg

from database_setup import DATABASE_URL, QUESTIONS_FILE, ensure_schema, flatten_questions, import_questions, prepare_questions


def ensure_ticket_metadata(conn: psycopg.Connection) -> None:
    conn.execute(
        """
        WITH ordered_questions AS (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    ORDER BY COALESCE(page, 999999), COALESCE(question_number, num_in_section, id), id
                ) - 1 AS row_index
            FROM questions
        )
        UPDATE questions AS q
        SET ticket_number = (ordered_questions.row_index / 20)::int + 1,
            question_number = (ordered_questions.row_index % 20)::int + 1
        FROM ordered_questions
        WHERE q.id = ordered_questions.id
          AND (q.ticket_number IS NULL OR q.question_number IS NULL)
        """
    )
    conn.commit()


def main() -> None:
    if not DATABASE_URL:
        raise SystemExit("DATABASE_URL is required")

    raw_data = json.loads(QUESTIONS_FILE.read_text(encoding="utf-8"))
    questions = flatten_questions(raw_data)
    expected_count = len(prepare_questions(questions))

    with psycopg.connect(DATABASE_URL) as conn:
        ensure_schema(conn)
        question_count = conn.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
        if question_count >= expected_count:
            ensure_ticket_metadata(conn)
            print(f"Database already has {question_count} questions. Skipping question import.", flush=True)
            return

        if os.getenv("SKIP_QUESTION_IMPORT", "").strip().lower() in {"1", "true", "yes"}:
            print("SKIP_QUESTION_IMPORT is enabled. Skipping question import.", flush=True)
            return

        imported = import_questions(conn, questions)
        ensure_ticket_metadata(conn)
        print(f"Database bootstrap complete. Imported {imported} questions.", flush=True)


if __name__ == "__main__":
    main()
