from __future__ import annotations

from typing import Any


EXAM_PERFECT_ACHIEVEMENTS = {"exam_perfect", "exam_perfect_5", "exam_perfect_10"}


def user_accuracy_percent(user: dict[str, Any]) -> int:
    total_answers = int(user.get("total_answers") or 0)
    if total_answers <= 0:
        return 0
    return round((int(user.get("total_correct") or 0) / total_answers) * 100)


def achievement_progress_value(
    *,
    achievement_id: str,
    category: str,
    user: dict[str, Any],
    perfect_tests: int,
    exam_stats: dict[str, Any],
    battle_stats: dict[str, int],
) -> int:
    if category == "tests":
        return int(user.get("total_tests") or 0)
    if category == "correct":
        return int(user.get("total_correct") or 0)
    if category == "streak":
        return int(user.get("streak_days") or 0)
    if category == "marathon":
        return int(user.get("marathon_best") or 0)
    if category == "perfect":
        return int(perfect_tests or 0)
    if category == "exam":
        if achievement_id in EXAM_PERFECT_ACHIEVEMENTS:
            return int(exam_stats.get("perfect_count") or 0)
        return int(exam_stats.get("passed_count") or 0)
    if category == "accuracy":
        if int(user.get("total_answers") or 0) < 20:
            return 0
        return user_accuracy_percent(user)
    if category == "battle":
        return int(battle_stats.get("battle_finished") or 0)
    if category == "battle_wins":
        return int(battle_stats.get("battle_wins") or 0)
    return 0


def should_award_achievement(
    *,
    achievement_id: str,
    category: str,
    threshold: int,
    user: dict[str, Any],
    perfect_tests: int,
    exam_stats: dict[str, Any],
    battle_stats: dict[str, int],
) -> bool:
    if category == "accuracy" and int(user.get("total_answers") or 0) < 20:
        return False
    return achievement_progress_value(
        achievement_id=achievement_id,
        category=category,
        user=user,
        perfect_tests=perfect_tests,
        exam_stats=exam_stats,
        battle_stats=battle_stats,
    ) >= int(threshold)

