from __future__ import annotations

from typing import Any

import psycopg


class AchievementRepository:
    def __init__(self, conn: psycopg.Connection):
        self.conn = conn

    def get_earned_ids(self, user_id: int) -> set[str]:
        rows = self.conn.execute(
            "SELECT achievement_id FROM user_achievements WHERE user_id = %s",
            (user_id,),
        ).fetchall()
        return {str(row["achievement_id"]) for row in rows}

    def get_earned_map(self, user_id: int) -> dict[str, Any]:
        rows = self.conn.execute(
            "SELECT achievement_id, earned_at FROM user_achievements WHERE user_id = %s",
            (user_id,),
        ).fetchall()
        return {str(row["achievement_id"]): row["earned_at"] for row in rows}

    def get_user(self, user_id: int) -> dict[str, Any]:
        return dict(self.conn.execute("SELECT * FROM users WHERE id = %s", (user_id,)).fetchone())

    def count_perfect_tests(self, user_id: int) -> int:
        row = self.conn.execute(
            """
            SELECT COUNT(*) AS count
            FROM test_results
            WHERE user_id = %s AND total > 0 AND correct = total
            """,
            (user_id,),
        ).fetchone()
        return int((row or {}).get("count") or 0)

    def get_exam_stats(self, user_id: int) -> dict[str, Any]:
        row = self.conn.execute(
            """
            SELECT
                COUNT(*) FILTER (
                    WHERE mode IN ('mvs', 'ticket') AND total > 0 AND (correct::numeric / total) >= 0.8
                ) AS passed_count,
                COUNT(*) FILTER (
                    WHERE mode IN ('mvs', 'ticket') AND total > 0 AND correct = total
                ) AS perfect_count
            FROM test_results
            WHERE user_id = %s
            """,
            (user_id,),
        ).fetchone()
        return dict(row or {})

    def get_battle_stats_for_email(self, email: str | None) -> dict[str, int]:
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

    def insert_achievement(self, *, user_id: int, achievement_id: str, name: str, description: str, tier: int, category: str) -> None:
        self.conn.execute(
            """
            INSERT INTO user_achievements
                (user_id, achievement_id, achievement_name, achievement_desc, tier, category)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (user_id, achievement_id) DO NOTHING
            """,
            (user_id, achievement_id, name, description, tier, category),
        )
