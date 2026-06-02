from __future__ import annotations

import json
from typing import Any

import psycopg


class FrameRepository:
    def __init__(self, conn: psycopg.Connection):
        self.conn = conn

    def get_user(self, *, user_id: int) -> dict[str, Any]:
        return dict(self.conn.execute("SELECT * FROM users WHERE id = %s", (user_id,)).fetchone())

    def list_achievement_ids(self, *, user_id: int) -> list[str]:
        rows = self.conn.execute(
            "SELECT achievement_id FROM user_achievements WHERE user_id = %s",
            (user_id,),
        ).fetchall()
        return [str(row["achievement_id"]) for row in rows]

    def purchase_frame(self, *, user_id: int, frame_ids: list[str], price: int) -> None:
        self.conn.execute(
            """
            UPDATE users
            SET purchased_frames = %s::jsonb,
                spent_stars = COALESCE(spent_stars, 0) + %s
            WHERE id = %s
            """,
            (json.dumps(frame_ids, ensure_ascii=False), price, user_id),
        )
