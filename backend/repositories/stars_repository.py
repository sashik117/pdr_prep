from __future__ import annotations

import psycopg


class StarsRepository:
    def __init__(self, conn: psycopg.Connection):
        self.conn = conn

    def earned_stars(self, *, user_id: int) -> int:
        row = self.conn.execute(
            """
            SELECT COUNT(*) AS count
            FROM test_results
            WHERE user_id = %s AND total > 0 AND correct = total
            """,
            (user_id,),
        ).fetchone()
        return int((row or {}).get("count") or 0)
