from __future__ import annotations

from typing import Any

from core.database import db
from repositories.leaderboard_repository import LeaderboardRepository


def list_leaderboard(*, excluded_emails: set[str], limit: int = 50) -> list[dict[str, Any]]:
    with db() as conn:
        return LeaderboardRepository(conn).list_leaders(
            excluded_emails=sorted(excluded_emails),
            limit=limit,
        )
