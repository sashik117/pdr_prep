from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Any


def coerce_json_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []
    return []


def normalize_featured_achievements(items: list[str] | None, *, limit: int = 4) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for item in items or []:
        value = (item or "").strip()
        if not value or value in seen:
            continue
        seen.add(value)
        normalized.append(value)
        if len(normalized) >= limit:
            break
    return normalized


def purchased_frames(user: dict[str, Any]) -> list[str]:
    return [str(item) for item in coerce_json_list(user.get("purchased_frames")) if str(item).strip()]


def normalize_theme(value: str) -> str | None:
    theme = (value or "").strip().lower()
    return theme if theme in {"light", "dark", "system"} else None


def clamp_font_size(value: int) -> int:
    return max(14, min(20, int(value)))


def username_change_locked_until(user: dict[str, Any], now: datetime) -> datetime | None:
    change_count = int(user.get("username_change_count") or 0)
    last_changed_at = user.get("username_last_changed_at")
    if change_count < 2 or not last_changed_at:
        return None
    unlock_at = last_changed_at + timedelta(days=7)
    return unlock_at if now < unlock_at else None


def frame_is_unlocked(
    frame_id: str,
    *,
    user: dict[str, Any],
    earned_achievement_ids: set[str],
    frame_shop: dict[str, dict[str, Any]],
) -> bool:
    if frame_id == "default":
        return True
    meta = frame_shop.get(frame_id)
    if not meta:
        return False
    owned_frames = set(purchased_frames(user))
    achievement_id = meta.get("achievement_id")
    return frame_id in owned_frames or bool(achievement_id and achievement_id in earned_achievement_ids)
