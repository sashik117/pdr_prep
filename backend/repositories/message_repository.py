from __future__ import annotations

from typing import Any

import psycopg

from services.private_data import decrypt_message_row, encrypt_private_text


class MessageRepository:
    def __init__(self, conn: psycopg.Connection):
        self.conn = conn

    def list_between(self, *, current_email: str, partner_email: str) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT *
            FROM messages
            WHERE (to_email = %s AND from_email = %s)
               OR (to_email = %s AND from_email = %s)
            ORDER BY created_at ASC
            """,
            (current_email, partner_email, partner_email, current_email),
        ).fetchall()
        return [decrypt_message_row(row) for row in rows]

    def mark_read(self, *, to_email: str, from_email: str) -> None:
        self.conn.execute(
            """
            UPDATE messages
            SET is_read = true
            WHERE to_email = %s AND from_email = %s AND is_read = false
            """,
            (to_email, from_email),
        )

    def list_recent(self, *, email: str, limit: int = 100) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT *
            FROM messages
            WHERE to_email = %s OR from_email = %s
            ORDER BY created_at DESC
            LIMIT %s
            """,
            (email, email, limit),
        ).fetchall()
        return [decrypt_message_row(row) for row in rows]

    def friendship_exists(self, *, user_id: int, friend_id: int) -> bool:
        row = self.conn.execute(
            """
            SELECT *
            FROM friendships
            WHERE status = 'accepted'
              AND LEAST(requester_id, addressee_id) = LEAST(%s, %s)
              AND GREATEST(requester_id, addressee_id) = GREATEST(%s, %s)
            """,
            (user_id, friend_id, user_id, friend_id),
        ).fetchone()
        return bool(row)

    def create_message(
        self,
        *,
        to_email: str,
        from_email: str,
        from_name: str,
        content: str,
        message_type: str,
        result_data_json: str,
    ) -> dict[str, Any]:
        row = self.conn.execute(
            """
            INSERT INTO messages (to_email, from_email, from_name, content, type, result_data)
            VALUES (%s, %s, %s, %s, %s, %s::jsonb)
            RETURNING *
            """,
            (to_email, from_email, from_name, encrypt_private_text(content), message_type, result_data_json),
        ).fetchone()
        return decrypt_message_row(row)
