from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any, Optional


@dataclass(frozen=True)
class StreakUpdate:
    streak_days: int
    restores_left: int
    month_key: str
    restored: bool
    should_persist: bool


def current_month_key(today: date) -> str:
    return today.strftime("%Y-%m")


def normalize_restore_state(user: dict[str, Any], today: date) -> tuple[int, str]:
    month_key = current_month_key(today)
    restores_left = int(user.get("streak_restores_left") or 0)
    saved_month = str(user.get("streak_restores_month") or "")
    if saved_month != month_key:
        restores_left = 3
    return restores_left, month_key


def streak_snapshot(user: dict[str, Any], today: date) -> dict[str, Any]:
    last_activity: Optional[date] = user.get("last_activity")
    streak_days = int(user.get("streak_days") or 0)
    restores_left, month_key = normalize_restore_state(user, today)

    if not last_activity:
        return {
            "status": "inactive",
            "days": 0,
            "restores_left": restores_left,
            "month_key": month_key,
            "missed_days": 0,
        }

    delta_days = (today - last_activity).days
    missed_days = max(0, delta_days - 1)
    if delta_days <= 0:
        status = "active"
        display_streak = streak_days
    elif delta_days == 1:
        status = "inactive"
        display_streak = streak_days
    elif delta_days == 2 and restores_left > 0:
        status = "restorable"
        display_streak = streak_days
    else:
        status = "lost"
        display_streak = 0

    return {
        "status": status,
        "days": display_streak,
        "restores_left": restores_left,
        "month_key": month_key,
        "missed_days": missed_days,
    }


def plan_streak_update(user: dict[str, Any], today: date) -> StreakUpdate:
    last_activity: Optional[date] = user.get("last_activity")
    streak_days = int(user.get("streak_days") or 0)
    restores_left, month_key = normalize_restore_state(user, today)

    if last_activity == today:
        return StreakUpdate(
            streak_days=streak_days,
            restores_left=restores_left,
            month_key=month_key,
            restored=False,
            should_persist=False,
        )

    restored = False
    if last_activity:
        delta_days = (today - last_activity).days
        if delta_days == 1:
            streak_days += 1
        elif delta_days == 2 and restores_left > 0:
            streak_days += 1
            restores_left -= 1
            restored = True
        else:
            streak_days = 1
    else:
        streak_days = 1

    return StreakUpdate(
        streak_days=streak_days,
        restores_left=restores_left,
        month_key=month_key,
        restored=restored,
        should_persist=True,
    )


def earned_star(total: int, correct: int) -> bool:
    return total > 0 and correct == total
