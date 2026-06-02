from __future__ import annotations

import psycopg


class NotificationRepository:
    def __init__(self, conn: psycopg.Connection):
        self.conn = conn

    @staticmethod
    def _count(row) -> int:
        return int((row or {}).get("count") or 0)

    def pending_friend_requests(self, *, user_id: int) -> int:
        return self._count(
            self.conn.execute(
                """
                SELECT COUNT(*) AS count
                FROM friendships
                WHERE addressee_id = %s
                  AND status = 'pending'
                  AND addressee_seen_at IS NULL
                """,
                (user_id,),
            ).fetchone()
        )

    def unread_friend_messages(self, *, email: str, support_email: str) -> int:
        return self._count(
            self.conn.execute(
                """
                SELECT COUNT(*) AS count
                FROM messages
                WHERE to_email = %s
                  AND is_read = false
                  AND from_email <> %s
                  AND from_email <> %s
                """,
                (email, support_email, email),
            ).fetchone()
        )

    def pending_battle_invites(self, *, email: str) -> int:
        return self._count(
            self.conn.execute(
                """
                SELECT COUNT(*) AS count
                FROM battles
                WHERE opponent_email = %s
                  AND status = 'pending'
                  AND opponent_seen_at IS NULL
                """,
                (email,),
            ).fetchone()
        )

    def unread_support_messages(self, *, email: str, support_email: str) -> int:
        return self._count(
            self.conn.execute(
                """
                SELECT COUNT(*) AS count
                FROM messages
                WHERE to_email = %s AND from_email = %s AND is_read = false
                """,
                (email, support_email),
            ).fetchone()
        )
