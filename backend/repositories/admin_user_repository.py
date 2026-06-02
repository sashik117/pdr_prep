from __future__ import annotations

from typing import Any, Optional

import psycopg


class AdminUserRepository:
    def __init__(self, conn: psycopg.Connection):
        self.conn = conn

    @staticmethod
    def _row(row: Any) -> Optional[dict[str, Any]]:
        return dict(row) if row else None

    def list_users(self) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT *
            FROM users
            ORDER BY created_at DESC
            """
        ).fetchall()
        return [dict(row) for row in rows]

    def achievement_counts_by_user(self) -> dict[int, int]:
        rows = self.conn.execute(
            """
            SELECT user_id, COUNT(*) AS count
            FROM user_achievements
            GROUP BY user_id
            """
        ).fetchall()
        return {int(row["user_id"]): int(row["count"] or 0) for row in rows}

    def get_user(self, *, user_id: int) -> Optional[dict[str, Any]]:
        return self._row(self.conn.execute("SELECT * FROM users WHERE id = %s", (user_id,)).fetchone())

    def update_user(self, *, user_id: int, values: dict[str, Any]) -> Optional[dict[str, Any]]:
        if not values:
            return self.get_user(user_id=user_id)
        assignments = [f"{column} = %s" for column in values]
        params = list(values.values()) + [user_id]
        self.conn.execute(f"UPDATE users SET {', '.join(assignments)} WHERE id = %s", params)
        return self.get_user(user_id=user_id)

    def delete_user(self, *, user_id: int) -> None:
        self.conn.execute("DELETE FROM users WHERE id = %s", (user_id,))

    def set_reset_code(self, *, user_id: int, code: str, expires_at: Any) -> None:
        self.conn.execute(
            """
            UPDATE users
            SET reset_code = %s, reset_code_exp = %s
            WHERE id = %s
            """,
            (code, expires_at, user_id),
        )

    def remove_achievement(self, *, user_id: int, achievement_id: str) -> None:
        self.conn.execute(
            "DELETE FROM user_achievements WHERE user_id = %s AND achievement_id = %s",
            (user_id, achievement_id),
        )

    def add_achievement(
        self,
        *,
        user_id: int,
        achievement_id: str,
        name: str,
        description: str,
        tier: int,
        category: str,
    ) -> None:
        self.conn.execute(
            """
            INSERT INTO user_achievements (user_id, achievement_id, achievement_name, achievement_desc, tier, category)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (user_id, achievement_id) DO NOTHING
            """,
            (user_id, achievement_id, name, description, tier, category),
        )

    def list_achievements(self, *, user_id: int) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            "SELECT * FROM user_achievements WHERE user_id = %s ORDER BY earned_at DESC",
            (user_id,),
        ).fetchall()
        return [dict(row) for row in rows]

    def list_tests(self, *, user_id: int, limit: int = 30) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT id, section, mode, total, correct, time_seconds, created_at
            FROM test_results
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT %s
            """,
            (user_id, limit),
        ).fetchall()
        return [dict(row) for row in rows]

    def list_battles(self, *, email: str, limit: int = 30) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT *
            FROM battles
            WHERE challenger_email = %s OR opponent_email = %s
            ORDER BY created_at DESC
            LIMIT %s
            """,
            (email, email, limit),
        ).fetchall()
        return [dict(row) for row in rows]

    def list_messages(self, *, email: str, limit: int = 50) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT id, to_email, from_email, from_name, content, type, is_read, created_at, result_data
            FROM messages
            WHERE to_email = %s OR from_email = %s
            ORDER BY created_at DESC
            LIMIT %s
            """,
            (email, email, limit),
        ).fetchall()
        return [dict(row) for row in rows]
