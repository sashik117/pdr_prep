from __future__ import annotations

from typing import Any

import psycopg


class SavedQuestionRepository:
    def __init__(self, conn: psycopg.Connection):
        self.conn = conn

    def ensure_schema(self) -> None:
        self.conn.execute(
            """
            CREATE TABLE IF NOT EXISTS saved_questions (
                user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                question_id INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
                saved_at TIMESTAMP NOT NULL DEFAULT NOW(),
                PRIMARY KEY (user_id, question_id)
            )
            """
        )
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_saved_questions_user_saved_at ON saved_questions(user_id, saved_at DESC)"
        )

    def list_ids(self, *, user_id: int) -> list[int]:
        rows = self.conn.execute(
            """
            SELECT question_id
            FROM saved_questions
            WHERE user_id = %s
            ORDER BY saved_at DESC, question_id DESC
            """,
            (user_id,),
        ).fetchall()
        return [int(row["question_id"]) for row in rows]

    def replace_ids(self, *, user_id: int, question_ids: list[int]) -> list[int]:
        unique_ids = list(dict.fromkeys(question_ids))
        self.conn.execute("DELETE FROM saved_questions WHERE user_id = %s", (user_id,))
        if unique_ids:
            with self.conn.cursor() as cursor:
                cursor.executemany(
                    """
                    INSERT INTO saved_questions (user_id, question_id)
                    VALUES (%(user_id)s, %(question_id)s)
                    ON CONFLICT (user_id, question_id) DO UPDATE SET saved_at = NOW()
                    """,
                    [{"user_id": user_id, "question_id": question_id} for question_id in unique_ids],
                )
        return self.list_ids(user_id=user_id)

    def save(self, *, user_id: int, question_id: int) -> None:
        self.conn.execute(
            """
            INSERT INTO saved_questions (user_id, question_id)
            VALUES (%s, %s)
            ON CONFLICT (user_id, question_id) DO UPDATE SET saved_at = NOW()
            """,
            (user_id, question_id),
        )

    def unsave(self, *, user_id: int, question_id: int) -> None:
        self.conn.execute(
            "DELETE FROM saved_questions WHERE user_id = %s AND question_id = %s",
            (user_id, question_id),
        )

    def question_exists(self, *, question_id: int) -> bool:
        row: Any = self.conn.execute("SELECT id FROM questions WHERE id = %s", (question_id,)).fetchone()
        return bool(row)
