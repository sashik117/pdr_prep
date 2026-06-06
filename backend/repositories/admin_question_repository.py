from __future__ import annotations

from typing import Any, Optional

import psycopg


ADMIN_QUESTION_COLUMNS = "id, section, section_name, difficulty, question_text, explanation, options, images, correct_ans"


class AdminQuestionRepository:
    def __init__(self, conn: psycopg.Connection):
        self.conn = conn

    @staticmethod
    def _row(row: Any) -> Optional[dict[str, Any]]:
        return dict(row) if row else None

    def search_questions(self, *, search: str, section: str, limit: int) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            f"""
            SELECT {ADMIN_QUESTION_COLUMNS}
            FROM questions
            WHERE (%s = '' OR section = %s OR section_name = %s)
              AND (
                   %s = ''
               OR question_text ILIKE %s
               OR section_name ILIKE %s
               OR explanation ILIKE %s
              )
            ORDER BY id
            LIMIT %s
            """,
            (
                section,
                section,
                section,
                search,
                f"%{search}%",
                f"%{search}%",
                f"%{search}%",
                limit,
            ),
        ).fetchall()
        return [dict(row) for row in rows]

    def list_sections(self) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT section, section_name, COUNT(*) AS count
            FROM questions
            GROUP BY section, section_name
            ORDER BY NULLIF(SUBSTRING(TRIM(COALESCE(section::text, '')) FROM '^\\d+'), '')::INT NULLS LAST, section
            """
        ).fetchall()
        return [dict(row) for row in rows]

    def exists(self, *, question_id: int) -> bool:
        return bool(self.conn.execute("SELECT id FROM questions WHERE id = %s", (question_id,)).fetchone())

    def create_question(self, *, values: dict[str, Any]) -> dict[str, Any]:
        row = self.conn.execute("SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM questions").fetchone()
        question_id = int((row or {}).get("next_id") or 1)
        inserted = self.conn.execute(
            """
            INSERT INTO questions (
                id, section, section_name, difficulty, question_text, explanation, options, images, correct_ans
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s)
            RETURNING id
            """,
            (
                question_id,
                values["section"],
                values.get("section_name"),
                values.get("difficulty") or "medium",
                values["question_text"],
                values.get("explanation") or "",
                values["options"],
                values.get("images") or "[]",
                values["correct_ans"],
            ),
        ).fetchone()
        return self.get_question(question_id=int(inserted["id"])) or {}

    def update_question(self, *, question_id: int, values: dict[str, Any]) -> None:
        assignments = []
        params = []
        for column, value in values.items():
            if column in {"options", "images"}:
                assignments.append(f"{column} = %s::jsonb")
            else:
                assignments.append(f"{column} = %s")
            params.append(value)
        params.append(question_id)
        self.conn.execute(
            f"UPDATE questions SET {', '.join(assignments)} WHERE id = %s",
            params,
        )

    def get_question(self, *, question_id: int) -> Optional[dict[str, Any]]:
        row = self.conn.execute(
            f"SELECT {ADMIN_QUESTION_COLUMNS} FROM questions WHERE id = %s",
            (question_id,),
        ).fetchone()
        return self._row(row)

