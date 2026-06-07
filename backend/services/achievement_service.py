from __future__ import annotations

from typing import Any

import psycopg

from core.database import db
from domain.achievements import achievement_copy, achievement_progress_value, should_award_achievement
from repositories.achievement_repository import AchievementRepository


AchievementDefinition = tuple[str, int, str, str, str, int]


def check_achievements(
    conn: psycopg.Connection,
    user_id: int,
    definitions: list[AchievementDefinition],
) -> list[dict[str, Any]]:
    repo = AchievementRepository(conn)
    earned = repo.get_earned_ids(user_id)
    user = repo.get_user(user_id)
    perfect_tests = repo.count_perfect_tests(user_id)
    exam_stats = repo.get_exam_stats(user_id)
    battle_stats = repo.get_battle_stats_for_email(user.get("email"))

    created: list[dict[str, Any]] = []
    for achievement_id, tier, name, description, category, threshold in definitions:
        name, description = achievement_copy(achievement_id, name, description)
        if achievement_id in earned:
            continue
        if not should_award_achievement(
            achievement_id=achievement_id,
            category=category,
            threshold=threshold,
            user=user,
            perfect_tests=perfect_tests,
            exam_stats=exam_stats,
            battle_stats=battle_stats,
        ):
            continue

        repo.insert_achievement(
            user_id=user_id,
            achievement_id=achievement_id,
            name=name,
            description=description,
            tier=tier,
            category=category,
        )
        created.append(
            {
                "id": achievement_id,
                "name": name,
                "description": description,
                "tier": tier,
            }
        )
    return created


def list_achievement_progress(
    definitions: list[AchievementDefinition],
    user: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    earned: dict[str, Any] = {}
    progress_context: dict[str, Any] = {
        "user": {},
        "perfect_tests": 0,
        "exam_stats": {"passed_count": 0, "perfect_count": 0},
        "battle_stats": {"battle_finished": 0, "battle_wins": 0},
    }

    if user:
        user_id = int(user["id"])
        with db() as conn:
            check_achievements(conn, user_id, definitions)
            conn.commit()
            repo = AchievementRepository(conn)
            user_row = repo.get_user(user_id)
            earned = repo.get_earned_map(user_id)
            progress_context = {
                "user": user_row,
                "perfect_tests": repo.count_perfect_tests(user_id),
                "exam_stats": repo.get_exam_stats(user_id),
                "battle_stats": repo.get_battle_stats_for_email(user_row.get("email")),
            }

    result: list[dict[str, Any]] = []
    for achievement_id, tier, name, description, category, threshold in definitions:
        name, description = achievement_copy(achievement_id, name, description)
        current = achievement_progress_value(
            achievement_id=achievement_id,
            category=category,
            user=progress_context["user"],
            perfect_tests=progress_context["perfect_tests"],
            exam_stats=progress_context["exam_stats"],
            battle_stats=progress_context["battle_stats"],
        )
        capped_current = min(current, int(threshold))
        progress_percent = min(100, round((current / max(1, int(threshold))) * 100))
        result.append(
            {
                "id": achievement_id,
                "tier": tier,
                "name": name,
                "description": description,
                "category": category,
                "threshold": threshold,
                "target": threshold,
                "current": capped_current,
                "raw_current": current,
                "progress_percent": progress_percent,
                "progress_text": f"{capped_current}/{threshold}",
                "earned": achievement_id in earned,
                "earned_at": str(earned[achievement_id]) if achievement_id in earned else None,
            }
        )
    return result
