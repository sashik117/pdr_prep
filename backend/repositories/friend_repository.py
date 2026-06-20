from __future__ import annotations

from typing import Any, Optional

import psycopg

from services.private_data import decrypt_message_row


class FriendRepository:
    def __init__(self, conn: psycopg.Connection):
        self.conn = conn

    @staticmethod
    def _row(row: Any) -> Optional[dict[str, Any]]:
        return dict(row) if row else None

    def mark_pending_seen(self, *, addressee_id: int) -> None:
        self.conn.execute(
            """
            UPDATE friendships
            SET addressee_seen_at = NOW()
            WHERE addressee_id = %s
              AND status = 'pending'
              AND addressee_seen_at IS NULL
            """,
            (addressee_id,),
        )

    def list_friendships(self, *, user_id: int) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT *
            FROM friendships
            WHERE requester_id = %s OR addressee_id = %s
            ORDER BY created_at DESC
            """,
            (user_id, user_id),
        ).fetchall()
        return [dict(row) for row in rows]

    def get_friend_summary_user(self, *, user_id: int) -> Optional[dict[str, Any]]:
        row = self.conn.execute(
            """
            SELECT id, name, surname, username, email, avatar_url, avatar_version,
                   active_frame, streak_days, total_tests, total_correct, total_answers, marathon_best
            FROM users
            WHERE id = %s
            """,
            (user_id,),
        ).fetchone()
        return self._row(row)

    def find_between(self, *, requester_id: int, addressee_id: int) -> Optional[dict[str, Any]]:
        row = self.conn.execute(
            """
            SELECT *
            FROM friendships
            WHERE LEAST(requester_id, addressee_id) = LEAST(%s, %s)
              AND GREATEST(requester_id, addressee_id) = GREATEST(%s, %s)
            """,
            (requester_id, addressee_id, requester_id, addressee_id),
        ).fetchone()
        return self._row(row)

    def create_invite(self, *, requester_id: int, addressee_id: int) -> dict[str, Any]:
        row = self.conn.execute(
            """
            INSERT INTO friendships (requester_id, addressee_id, status)
            VALUES (%s, %s, 'pending')
            RETURNING *
            """,
            (requester_id, addressee_id),
        ).fetchone()
        return dict(row)

    def get_friendship(self, *, friendship_id: int) -> Optional[dict[str, Any]]:
        row = self.conn.execute("SELECT * FROM friendships WHERE id = %s", (friendship_id,)).fetchone()
        return self._row(row)

    def accept_friendship(self, *, friendship_id: int) -> None:
        self.conn.execute(
            """
            UPDATE friendships
            SET status = 'accepted', responded_at = NOW()
            WHERE id = %s
            """,
            (friendship_id,),
        )

    def get_user_email(self, *, user_id: int) -> Optional[str]:
        row = self.conn.execute("SELECT email FROM users WHERE id = %s", (user_id,)).fetchone()
        return str(row["email"]) if row else None

    def delete_friendship(self, *, friendship_id: int) -> None:
        self.conn.execute("DELETE FROM friendships WHERE id = %s", (friendship_id,))

    def unread_count(self, *, to_email: str, from_email: str) -> int:
        row = self.conn.execute(
            """
            SELECT COUNT(*) AS count
            FROM messages
            WHERE to_email = %s AND from_email = %s AND is_read = false
            """,
            (to_email, from_email),
        ).fetchone()
        return int((row or {}).get("count") or 0)

    def last_message_between(self, *, current_email: str, counterpart_email: str) -> Optional[dict[str, Any]]:
        row = self.conn.execute(
            """
            SELECT content, type, created_at
            FROM messages
            WHERE (to_email = %s AND from_email = %s)
               OR (to_email = %s AND from_email = %s)
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (current_email, counterpart_email, counterpart_email, current_email),
        ).fetchone()
        return decrypt_message_row(row) if row else None
