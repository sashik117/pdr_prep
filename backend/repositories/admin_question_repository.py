from __future__ import annotations

from typing import Any, Optional

import psycopg
from psycopg import errors, sql


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
        inserted = None
        for offset in range(10):
            try:
                inserted = self.conn.execute(
                    """
                    INSERT INTO questions (
                        id, section, section_name, difficulty, question_text, explanation, options, images, correct_ans
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s)
                    RETURNING id
                    """,
                    (
                        question_id + offset,
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
                break
            except errors.UniqueViolation:
                self.conn.rollback()
                continue
        if not inserted:
            raise RuntimeError("Could not allocate question id")
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

    def _delete_question_dependencies(self, *, question_id: int) -> None:
        references = self.conn.execute(
            """
            SELECT
                tc.table_schema,
                tc.table_name,
                kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage ccu
              ON ccu.constraint_name = tc.constraint_name
             AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND ccu.table_name = 'questions'
              AND ccu.column_name = 'id'
            """
        ).fetchall()
        for ref in references:
            schema = ref["table_schema"]
            table = ref["table_name"]
            column = ref["column_name"]
            query = sql.SQL("DELETE FROM {}.{} WHERE {} = %s").format(
                sql.Identifier(schema),
                sql.Identifier(table),
                sql.Identifier(column),
            )
            self.conn.execute(query, (question_id,))

    def delete_question(self, *, question_id: int) -> bool:
        self._delete_question_dependencies(question_id=question_id)
        result = self.conn.execute("DELETE FROM questions WHERE id = %s", (question_id,))
        return bool(result.rowcount)

    def get_question(self, *, question_id: int) -> Optional[dict[str, Any]]:
        row = self.conn.execute(
            f"SELECT {ADMIN_QUESTION_COLUMNS} FROM questions WHERE id = %s",
            (question_id,),
        ).fetchone()
        return self._row(row)

