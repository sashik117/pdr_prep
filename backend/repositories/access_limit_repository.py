from __future__ import annotations

from datetime import date
from typing import Any

from core.database import db


def get_usage(*, usage_date: date, action: str, scope_hash: str) -> dict[str, Any] | None:
    with db() as conn:
        return conn.execute(
            """
            SELECT *
            FROM access_usage
            WHERE usage_date = %s AND action = %s AND scope_hash = %s
            """,
            (usage_date, action, scope_hash),
        ).fetchone()


def consume_usage(
    *,
    usage_date: date,
    action: str,
    scope_hash: str,
    limit: int,
    user_id: int | None,
    guest_id: str | None,
    ip_hash: str | None,
) -> dict[str, Any]:
    with db() as conn:
        row = conn.execute(
            """
            SELECT *
            FROM access_usage
            WHERE usage_date = %s AND action = %s AND scope_hash = %s
            FOR UPDATE
            """,
            (usage_date, action, scope_hash),
        ).fetchone()

        if row is None:
            row = conn.execute(
                """
                INSERT INTO access_usage (usage_date, action, scope_hash, user_id, guest_id, ip_hash, count)
                VALUES (%s, %s, %s, %s, %s, %s, 1)
                RETURNING *
                """,
                (usage_date, action, scope_hash, user_id, guest_id, ip_hash),
            ).fetchone()
            conn.commit()
            return {"allowed": True, "count": int(row["count"]), "limit": limit}

        count = int(row["count"] or 0)
        if count >= limit:
            conn.commit()
            return {"allowed": False, "count": count, "limit": limit}

        row = conn.execute(
            """
            UPDATE access_usage
            SET count = count + 1, updated_at = NOW()
            WHERE id = %s
            RETURNING *
            """,
            (row["id"],),
        ).fetchone()
        conn.commit()
        return {"allowed": True, "count": int(row["count"]), "limit": limit}
