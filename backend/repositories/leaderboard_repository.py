from __future__ import annotations

from typing import Any

import psycopg


class LeaderboardRepository:
    def __init__(self, conn: psycopg.Connection):
        self.conn = conn

    def list_leaders(self, *, excluded_emails: list[str], limit: int = 50) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            WITH battle_stats AS (
              SELECT email,
                     COUNT(*) FILTER (WHERE status = 'finished') AS battle_finished,
                     COUNT(*) FILTER (WHERE status = 'finished' AND LOWER(COALESCE(winner_email, '')) = email) AS battle_wins
              FROM (
                SELECT LOWER(challenger_email) AS email, status, winner_email FROM battles
                UNION ALL
                SELECT LOWER(opponent_email) AS email, status, winner_email FROM battles
              ) battle_rows
              GROUP BY email
            )
            SELECT u.id, u.name, u.surname, u.username, u.email, u.avatar_url, u.avatar_version, u.active_frame,
                   u.total_correct, u.total_tests, u.total_answers, u.marathon_best, u.streak_days,
                   COALESCE((
                     SELECT COUNT(*)
                     FROM test_results tr
                     WHERE tr.user_id = u.id
                       AND tr.total > 0
                       AND ROUND((tr.correct::numeric / tr.total::numeric) * 100) >= 80
                   ), 0) AS passed_tests,
                   COALESCE(bs.battle_wins, 0) AS battle_wins,
                   COALESCE(bs.battle_finished, 0) AS battle_finished
            FROM users u
            LEFT JOIN battle_stats bs ON bs.email = LOWER(u.email)
            WHERE u.email_verified = true
              AND LOWER(u.email) <> ALL(%s)
            ORDER BY u.total_correct DESC, u.total_tests DESC, u.created_at ASC
            LIMIT %s
            """,
            (excluded_emails, limit),
        ).fetchall()
        return [dict(row) for row in rows]
