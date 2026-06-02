from __future__ import annotations

from typing import Any, Optional

import psycopg


class SupportRepository:
    def __init__(self, conn: psycopg.Connection):
        self.conn = conn

    @staticmethod
    def _row(row: Any) -> Optional[dict[str, Any]]:
        return dict(row) if row else None

    def list_conversation_heads(self, *, support_email: str) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT
                CASE
                    WHEN from_email = %s THEN to_email
                    ELSE from_email
                END AS counterpart_email,
                MAX(created_at) AS last_message_at
            FROM messages
            WHERE to_email = %s OR from_email = %s
            GROUP BY counterpart_email
            ORDER BY last_message_at DESC
            """,
            (support_email, support_email, support_email),
        ).fetchall()
        return [dict(row) for row in rows]

    def get_user_by_email(self, *, email: str) -> Optional[dict[str, Any]]:
        row = self.conn.execute(
            """
            SELECT id, name, surname, username, email, avatar_url, avatar_version,
                   total_tests, total_correct, total_answers, is_blocked, created_at
            FROM users
            WHERE email = %s
            """,
            (email,),
        ).fetchone()
        return self._row(row)

    def get_user(self, *, user_id: int) -> Optional[dict[str, Any]]:
        return self._row(self.conn.execute("SELECT * FROM users WHERE id = %s", (user_id,)).fetchone())

    def last_message_preview(self, *, support_email: str, counterpart_email: str) -> Optional[dict[str, Any]]:
        row = self.conn.execute(
            """
            SELECT content, created_at, from_email
            FROM messages
            WHERE (to_email = %s AND from_email = %s)
               OR (to_email = %s AND from_email = %s)
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (support_email, counterpart_email, counterpart_email, support_email),
        ).fetchone()
        return self._row(row)

    def unread_from_user(self, *, support_email: str, counterpart_email: str) -> int:
        row = self.conn.execute(
            """
            SELECT COUNT(*) AS count
            FROM messages
            WHERE to_email = %s
              AND from_email = %s
              AND is_read = false
            """,
            (support_email, counterpart_email),
        ).fetchone()
        return int((row or {}).get("count") or 0)

    def list_thread(self, *, support_email: str, user_email: str) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT *
            FROM messages
            WHERE (to_email = %s AND from_email = %s)
               OR (to_email = %s AND from_email = %s)
            ORDER BY created_at ASC
            """,
            (support_email, user_email, user_email, support_email),
        ).fetchall()
        return [dict(row) for row in rows]

    def mark_user_messages_read(self, *, support_email: str, user_email: str) -> None:
        self.conn.execute(
            """
            UPDATE messages
            SET is_read = true
            WHERE to_email = %s
              AND from_email = %s
              AND is_read = false
            """,
            (support_email, user_email),
        )

    def create_reply(
        self,
        *,
        to_email: str,
        support_email: str,
        support_name: str,
        content: str,
        result_data_json: str,
    ) -> dict[str, Any]:
        row = self.conn.execute(
            """
            INSERT INTO messages (to_email, from_email, from_name, content, type, result_data)
            VALUES (%s, %s, %s, %s, 'text', %s::jsonb)
            RETURNING *
            """,
            (to_email, support_email, support_name, content, result_data_json),
        ).fetchone()
        return dict(row)

    def create_user_message(
        self,
        *,
        support_email: str,
        user_email: str,
        user_name: str,
        content: str,
    ) -> dict[str, Any]:
        row = self.conn.execute(
            """
            INSERT INTO messages (to_email, from_email, from_name, content, type, result_data)
            VALUES (%s, %s, %s, %s, 'text', '{}'::jsonb)
            RETURNING *
            """,
            (support_email, user_email, user_name, content),
        ).fetchone()
        return dict(row)
