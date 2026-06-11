from __future__ import annotations

import json
from collections.abc import Callable
from datetime import datetime
from typing import Any

from core.config import FRAME_SHOP, USERNAME_RE
from core.database import db
from domain.achievements import achievement_copy
from domain.auth import normalize_username, username_is_valid
from domain.profile import (
    clamp_font_size,
    frame_is_unlocked,
    normalize_featured_achievements,
    normalize_theme,
    username_change_locked_until,
)
from repositories.user_repository import UserRepository
from schemas.requests import UpdateProfileRequest
from services.errors import ServiceError


UserPresenter = Callable[[dict[str, Any]], dict[str, Any]]
AdminEmailChecker = Callable[[str | None], bool]


def _normalize_achievement_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        name, description = achievement_copy(
            str(item.get("achievement_id") or ""),
            str(item.get("achievement_name") or item.get("name") or ""),
            str(item.get("achievement_desc") or item.get("description") or ""),
        )
        item["achievement_name"] = name
        item["achievement_desc"] = description
        item["name"] = name
        item["description"] = description
        normalized.append(item)
    return normalized


def _validate_username(value: str) -> str:
    username = normalize_username(value) or ""
    if not username_is_valid(username, USERNAME_RE):
        raise ServiceError(
            400,
            "Username має містити лише латиницю, цифри або _, від 3 до 32 символів",
        )
    return username


def update_profile(req: UpdateProfileRequest, user: dict[str, Any], *, present_user: UserPresenter) -> dict[str, Any]:
    user_id = int(user["id"])
    now = datetime.now()

    with db() as conn:
        repo = UserRepository(conn)
        current_user = repo.get_user(user_id)
        values: dict[str, Any] = {}
        username_changed = False

        if req.name is not None:
            values["name"] = req.name.strip() or current_user["name"]
        if req.surname is not None:
            values["surname"] = req.surname.strip() or None
        if req.username is not None:
            username = _validate_username(req.username)
            current_username = normalize_username(current_user.get("username"))
            if username != current_username:
                if repo.username_exists_for_other_user(username=username, user_id=user_id):
                    raise ServiceError(409, "Цей нікнейм вже зайнятий")
                if username_change_locked_until(current_user, now):
                    raise ServiceError(429, "Наступна зміна доступна через 7 днів")
                values["username"] = username
                values["username_last_changed_at"] = now
                username_changed = True
        if req.bio is not None:
            values["bio"] = req.bio.strip() or None
        if req.active_frame is not None:
            frame_id = (req.active_frame or "").strip() or "default"
            if frame_id != "default":
                earned_achievement_ids = repo.list_achievement_ids(user_id=user_id)
                if not frame_is_unlocked(
                    frame_id,
                    user=current_user,
                    earned_achievement_ids=earned_achievement_ids,
                    frame_shop=FRAME_SHOP,
                ):
                    raise ServiceError(400, "Ця рамка ще не відкрита")
            values["active_frame"] = frame_id
        if req.theme_preference is not None:
            theme = normalize_theme(req.theme_preference)
            if not theme:
                raise ServiceError(400, "Невірна тема")
            values["theme_preference"] = theme
        if req.font_size is not None:
            values["font_size"] = clamp_font_size(req.font_size)
        if req.sound_enabled is not None:
            values["sound_enabled"] = bool(req.sound_enabled)
        if req.push_enabled is not None:
            values["push_enabled"] = bool(req.push_enabled)
        if req.email_visible is not None:
            values["email_visible"] = bool(req.email_visible)
        if req.featured_achievements is not None:
            featured = normalize_featured_achievements(req.featured_achievements)
            values["featured_achievements"] = json.dumps(featured, ensure_ascii=False)

        if not values and not username_changed:
            return present_user(current_user)

        updated_user = repo.update_profile(
            user_id=user_id,
            values=values,
            increment_username_change=username_changed,
        )
        conn.commit()

    return present_user(updated_user)


def update_avatar(user: dict[str, Any], avatar_url: str, *, present_user: UserPresenter) -> dict[str, Any]:
    with db() as conn:
        updated = UserRepository(conn).update_avatar(user_id=int(user["id"]), avatar_url=avatar_url)
        conn.commit()
    return present_user(updated)


def clear_avatar(user: dict[str, Any], *, present_user: UserPresenter) -> dict[str, Any]:
    with db() as conn:
        updated = UserRepository(conn).clear_avatar(user_id=int(user["id"]))
        conn.commit()
    return present_user(updated)


def _public_profile_payload(
    user: dict[str, Any],
    *,
    viewer: dict[str, Any] | None,
    repo: UserRepository,
    present_user: UserPresenter,
    is_admin_email: AdminEmailChecker,
) -> dict[str, Any]:
    if is_admin_email(user.get("email")):
        viewer_email = (viewer or {}).get("email")
        if not is_admin_email(viewer_email) and viewer_email != user.get("email"):
            raise ServiceError(404, "Користувача не знайдено")

    payload = present_user(user)
    viewer_email = (viewer or {}).get("email")
    if not payload.get("email_visible") and viewer_email != user.get("email"):
        payload["email"] = None

    return {
        **payload,
        "passed_tests": repo.passed_tests_count(user_id=int(user["id"])),
        **repo.battle_stats_for_email(user.get("email")),
        "total_wrong": max(0, int(user.get("total_answers", 0) or 0) - int(user.get("total_correct", 0) or 0)),
        "achievements": _normalize_achievement_rows(repo.list_achievements(user_id=int(user["id"]))),
    }


def get_public_profile_by_id(
    user_id: int,
    *,
    viewer: dict[str, Any] | None,
    present_user: UserPresenter,
    is_admin_email: AdminEmailChecker,
) -> dict[str, Any]:
    with db() as conn:
        repo = UserRepository(conn)
        user = repo.find_user(user_id)
        if not user:
            raise ServiceError(404, "Користувача не знайдено")
        return _public_profile_payload(
            user,
            viewer=viewer,
            repo=repo,
            present_user=present_user,
            is_admin_email=is_admin_email,
        )


def get_public_profile_by_username(
    username: str,
    *,
    viewer: dict[str, Any] | None,
    present_user: UserPresenter,
    is_admin_email: AdminEmailChecker,
) -> dict[str, Any]:
    normalized = normalize_username(username)
    if not normalized:
        raise ServiceError(404, "Користувача не знайдено")
    with db() as conn:
        repo = UserRepository(conn)
        user = repo.find_by_username(normalized)
        if not user:
            raise ServiceError(404, "Користувача не знайдено")
        return _public_profile_payload(
            user,
            viewer=viewer,
            repo=repo,
            present_user=present_user,
            is_admin_email=is_admin_email,
        )
