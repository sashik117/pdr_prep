from __future__ import annotations

from typing import Any, Optional

import psycopg


class UserRepository:
    def __init__(self, conn: psycopg.Connection):
        self.conn = conn

    def get_user(self, user_id: int) -> dict[str, Any]:
        return dict(self.conn.execute("SELECT * FROM users WHERE id = %s", (user_id,)).fetchone())

    def find_user(self, user_id: int) -> Optional[dict[str, Any]]:
        row = self.conn.execute("SELECT * FROM users WHERE id = %s", (user_id,)).fetchone()
        return dict(row) if row else None

    def find_by_username(self, username: str) -> Optional[dict[str, Any]]:
        row = self.conn.execute("SELECT * FROM users WHERE LOWER(username) = %s", (username,)).fetchone()
        return dict(row) if row else None

    def username_exists_for_other_user(self, *, username: str, user_id: int) -> bool:
        row = self.conn.execute(
            "SELECT id FROM users WHERE LOWER(username) = %s AND id <> %s",
            (username, user_id),
        ).fetchone()
        return bool(row)

    def list_achievement_ids(self, *, user_id: int) -> set[str]:
        rows = self.conn.execute(
            "SELECT achievement_id FROM user_achievements WHERE user_id = %s",
            (user_id,),
        ).fetchall()
        return {str(row["achievement_id"]) for row in rows}

    def list_achievements(self, *, user_id: int) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            "SELECT * FROM user_achievements WHERE user_id = %s ORDER BY earned_at DESC",
            (user_id,),
        ).fetchall()
        return [dict(row) for row in rows]

    def passed_tests_count(self, *, user_id: int) -> int:
        row = self.conn.execute(
            """
            SELECT COUNT(*) AS count
            FROM test_results
            WHERE user_id = %s
              AND total > 0
              AND ROUND((correct::numeric / total::numeric) * 100) >= 80
            """,
            (user_id,),
        ).fetchone()
        return int((row or {}).get("count") or 0)

    def battle_stats_for_email(self, email: str | None) -> dict[str, int]:
        normalized = str(email or "").strip().lower()
        if not normalized:
            return {"battle_wins": 0, "battle_finished": 0}
        row = self.conn.execute(
            """
            SELECT
              COUNT(*) FILTER (WHERE status = 'finished') AS battle_finished,
              COUNT(*) FILTER (WHERE status = 'finished' AND LOWER(COALESCE(winner_email, '')) = %s) AS battle_wins
            FROM battles
            WHERE LOWER(challenger_email) = %s OR LOWER(opponent_email) = %s
            """,
            (normalized, normalized, normalized),
        ).fetchone()
        return {
            "battle_wins": int((row or {}).get("battle_wins") or 0),
            "battle_finished": int((row or {}).get("battle_finished") or 0),
        }

    def update_profile(
        self,
        *,
        user_id: int,
        values: dict[str, Any],
        increment_username_change: bool = False,
    ) -> dict[str, Any]:
        if not values and not increment_username_change:
            return self.get_user(user_id)

        assignments: list[str] = []
        params: list[Any] = []
        for column, value in values.items():
            assignments.append(f"{column} = %s")
            params.append(value)

        if increment_username_change:
            assignments.append("username_change_count = COALESCE(username_change_count, 0) + 1")

        params.append(user_id)
        self.conn.execute(
            f"UPDATE users SET {', '.join(assignments)} WHERE id = %s",
            params,
        )
        return self.get_user(user_id)

    def update_avatar(self, *, user_id: int, avatar_url: str) -> dict[str, Any]:
        self.conn.execute(
            "UPDATE users SET avatar_url = %s, avatar_version = COALESCE(avatar_version, 0) + 1 WHERE id = %s",
            (avatar_url, user_id),
        )
        return self.get_user(user_id)

    def clear_avatar(self, *, user_id: int) -> dict[str, Any]:
        self.conn.execute(
            "UPDATE users SET avatar_url = NULL, avatar_version = COALESCE(avatar_version, 0) + 1 WHERE id = %s",
            (user_id,),
        )
        return self.get_user(user_id)
