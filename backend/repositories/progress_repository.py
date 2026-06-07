from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

import psycopg


@dataclass(frozen=True)
class CreatedTestResult:
    result_id: Optional[int]
    duplicate: bool


class ProgressRepository:
    def __init__(self, conn: psycopg.Connection):
        self.conn = conn

    def create_test_result(
        self,
        *,
        user_id: int,
        section: Optional[str],
        mode: str,
        total: int,
        correct: int,
        time_seconds: int,
        client_attempt_id: Optional[str],
    ) -> CreatedTestResult:
        if client_attempt_id:
            inserted = self.conn.execute(
                """
                INSERT INTO test_results (user_id, section, mode, total, correct, time_seconds, client_attempt_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (user_id, client_attempt_id) WHERE client_attempt_id IS NOT NULL DO NOTHING
                RETURNING id
                """,
                (user_id, section, mode, total, correct, time_seconds, client_attempt_id),
            ).fetchone()
            if inserted:
                return CreatedTestResult(result_id=inserted["id"], duplicate=False)

            existing = self.conn.execute(
                "SELECT id FROM test_results WHERE user_id = %s AND client_attempt_id = %s",
                (user_id, client_attempt_id),
            ).fetchone()
            return CreatedTestResult(result_id=existing["id"] if existing else None, duplicate=True)

        inserted = self.conn.execute(
            """
            INSERT INTO test_results (user_id, section, mode, total, correct, time_seconds)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (user_id, section, mode, total, correct, time_seconds),
        ).fetchone()
        return CreatedTestResult(result_id=inserted["id"], duplicate=False)

    def insert_answers(self, *, user_id: int, answers: list[Any]) -> None:
        if not answers:
            return
        with self.conn.cursor() as cursor:
            cursor.executemany(
                """
                INSERT INTO user_answers (user_id, question_id, selected_index, is_correct, time_ms)
                SELECT %s, %s, %s, %s, %s
                WHERE EXISTS (SELECT 1 FROM questions WHERE id = %s)
                """,
                [
                    (
                        user_id,
                        answer.question_id,
                        answer.selected_index,
                        answer.is_correct,
                        answer.time_ms,
                        answer.question_id,
                    )
                    for answer in answers
                ],
            )

    def get_user(self, user_id: int) -> dict[str, Any]:
        return dict(self.conn.execute("SELECT * FROM users WHERE id = %s", (user_id,)).fetchone())

    def get_marathon_best(self, *, user_id: int) -> int:
        row = self.conn.execute("SELECT marathon_best FROM users WHERE id = %s", (user_id,)).fetchone()
        return int((row or {}).get("marathon_best") or 0)

    def set_marathon_best(self, *, user_id: int, score: int) -> None:
        self.conn.execute("UPDATE users SET marathon_best = %s WHERE id = %s", (score, user_id))

    def get_user_streak_state(self, user_id: int) -> dict[str, Any]:
        return dict(
            self.conn.execute(
                "SELECT last_activity, streak_days, streak_restores_left, streak_restores_month FROM users WHERE id = %s",
                (user_id,),
            ).fetchone()
        )

    def update_streak(self, *, user_id: int, today, streak_days: int, restores_left: int, month_key: str) -> None:
        self.conn.execute(
            """
            UPDATE users
            SET last_activity = %s,
                streak_days = %s,
                streak_restores_left = %s,
                streak_restores_month = %s
            WHERE id = %s
            """,
            (today, streak_days, restores_left, month_key, user_id),
        )

    def restore_streak(self, *, user_id: int, restores_left: int, month_key: str, last_activity) -> None:
        self.conn.execute(
            """
            UPDATE users
            SET streak_restores_left = %s,
                streak_restores_month = %s,
                last_activity = %s
            WHERE id = %s
            """,
            (restores_left, month_key, last_activity, user_id),
        )

    def increment_user_totals(self, *, user_id: int, correct: int, total: int) -> None:
        self.conn.execute(
            """
            UPDATE users
            SET total_tests = total_tests + 1,
                total_correct = total_correct + %s,
                total_answers = total_answers + %s
            WHERE id = %s
            """,
            (correct, total, user_id),
        )

    def list_recent_results(self, *, user_id: int, limit: int = 365) -> list[dict[str, Any]]:
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

    def list_section_accuracy(self, *, user_id: int, section_order_sql: str) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT q.section, q.section_name,
                   SUM(CASE WHEN ua.is_correct THEN 1 ELSE 0 END)::int AS correct,
                   COUNT(*)::int AS total,
                   ROUND((SUM(CASE WHEN ua.is_correct THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100)::int AS accuracy_percent
            FROM user_answers ua
            JOIN questions q ON q.id = ua.question_id
            WHERE ua.user_id = %s
            GROUP BY q.section, q.section_name
            ORDER BY """
            + section_order_sql
            + """
                     NULLS LAST, q.section
            """,
            (user_id,),
        ).fetchall()
        if rows:
            return [dict(row) for row in rows]

        fallback_rows = self.conn.execute(
            """
            WITH result_stats AS (
                SELECT section,
                       SUM(correct)::int AS correct,
                       SUM(total)::int AS total,
                       ROUND((SUM(correct)::numeric / NULLIF(SUM(total), 0)) * 100)::int AS accuracy_percent
                FROM test_results
                WHERE user_id = %s
                  AND section IS NOT NULL
                  AND section <> ''
                  AND total > 0
                GROUP BY section
            ),
            question_sections AS (
                SELECT DISTINCT ON (section) section, section_name
                FROM questions
                WHERE section IS NOT NULL
                ORDER BY section, section_name NULLS LAST
            )
            SELECT result_stats.section,
                   COALESCE(question_sections.section_name, result_stats.section) AS section_name,
                   result_stats.correct,
                   result_stats.total,
                   result_stats.accuracy_percent
            FROM result_stats
            LEFT JOIN question_sections ON question_sections.section = result_stats.section
            ORDER BY result_stats.section
            """,
            (user_id,),
        ).fetchall()
        return [dict(row) for row in fallback_rows]

    def list_weak_sections(self, *, user_id: int, section_order_sql: str, limit: int = 8) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT q.section,
                   q.section_name,
                   SUM(CASE WHEN ua.is_correct THEN 0 ELSE 1 END)::int AS wrong,
                   SUM(CASE WHEN ua.is_correct THEN 1 ELSE 0 END)::int AS correct,
                   COUNT(*)::int AS total,
                   ROUND((SUM(CASE WHEN ua.is_correct THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100)::int AS accuracy_percent
            FROM user_answers ua
            JOIN questions q ON q.id = ua.question_id
            WHERE ua.user_id = %s
            GROUP BY q.section, q.section_name
            HAVING COUNT(*) FILTER (WHERE ua.is_correct = false) > 0
            ORDER BY wrong DESC, total DESC, """
            + section_order_sql
            + """
                     NULLS LAST, q.section
            LIMIT %s
            """,
            (user_id, limit),
        ).fetchall()
        if rows:
            return [dict(row) for row in rows]

        fallback_rows = self.conn.execute(
            """
            WITH result_stats AS (
                SELECT section,
                       SUM(total - correct)::int AS wrong,
                       SUM(correct)::int AS correct,
                       SUM(total)::int AS total,
                       ROUND((SUM(correct)::numeric / NULLIF(SUM(total), 0)) * 100)::int AS accuracy_percent
                FROM test_results
                WHERE user_id = %s
                  AND section IS NOT NULL
                  AND section <> ''
                  AND total > 0
                GROUP BY section
                HAVING SUM(total - correct) > 0
            ),
            question_sections AS (
                SELECT DISTINCT ON (section) section, section_name
                FROM questions
                WHERE section IS NOT NULL
                ORDER BY section, section_name NULLS LAST
            )
            SELECT result_stats.section,
                   COALESCE(question_sections.section_name, result_stats.section) AS section_name,
                   result_stats.wrong,
                   result_stats.correct,
                   result_stats.total,
                   result_stats.accuracy_percent
            FROM result_stats
            LEFT JOIN question_sections ON question_sections.section = result_stats.section
            ORDER BY result_stats.wrong DESC, result_stats.total DESC, result_stats.section
            LIMIT %s
            """,
            (user_id, limit),
        ).fetchall()
        return [dict(row) for row in fallback_rows]

    def list_recent_tests(self, *, user_id: int, limit: int = 20) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT *
            FROM test_results
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT %s
            """,
            (user_id, limit),
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

    def get_time_stats(self, *, user_id: int) -> dict[str, Any]:
        row = self.conn.execute(
            """
            SELECT
                COALESCE(SUM(time_seconds), 0)::int AS total_test_time_seconds,
                COALESCE(SUM(time_seconds) FILTER (WHERE DATE(created_at) = CURRENT_DATE), 0)::int AS today_test_time_seconds,
                COALESCE(
                    MIN(time_seconds) FILTER (
                        WHERE mode IN ('mvs', 'ticket') AND total > 0 AND (correct::numeric / total) >= 0.8
                    ),
                    0
                )::int AS best_exam_time_seconds
            FROM test_results
            WHERE user_id = %s
            """,
            (user_id,),
        ).fetchone()
        return dict(row) if row else {}

    def list_difficult_question_ids(self, *, user_id: int, limit: int = 50) -> list[int]:
        rows = self.conn.execute(
            """
            SELECT question_id, COUNT(*) AS wrong_count
            FROM user_answers
            WHERE user_id = %s AND is_correct = false
            GROUP BY question_id
            ORDER BY wrong_count DESC
            LIMIT %s
            """,
            (user_id, limit),
        ).fetchall()
        return [int(row["question_id"]) for row in rows]

    def list_achievements(self, *, user_id: int) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT *
            FROM user_achievements
            WHERE user_id = %s
            ORDER BY earned_at DESC
            """,
            (user_id,),
        ).fetchall()
        return [dict(row) for row in rows]

    def list_activity_days(self, *, user_id: int, days: int = 90) -> list[str]:
        rows = self.conn.execute(
            """
            SELECT DISTINCT day
            FROM (
                SELECT DATE(answered_at)::text AS day
                FROM user_answers
                WHERE user_id = %s
                  AND answered_at > NOW() - (%s * INTERVAL '1 day')
                UNION
                SELECT DATE(created_at)::text AS day
                FROM test_results
                WHERE user_id = %s
                  AND created_at > NOW() - (%s * INTERVAL '1 day')
            ) activity
            ORDER BY day
            """,
            (user_id, days, user_id, days),
        ).fetchall()
        return sorted({str(row["day"]) for row in rows})

    def list_daily_test_time(self, *, user_id: int, days: int = 130) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            """
            SELECT DATE(created_at)::text AS day,
                   COALESCE(SUM(time_seconds), 0)::int AS seconds,
                   COUNT(*)::int AS tests
            FROM test_results
            WHERE user_id = %s
              AND created_at > NOW() - (%s * INTERVAL '1 day')
            GROUP BY DATE(created_at)
            ORDER BY day
            """,
            (user_id, days),
        ).fetchall()
        return [dict(row) for row in rows]
