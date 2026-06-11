from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Any

import psycopg

from core.bootstrap import ensure_runtime_migrations
from core.database import db
from domain.achievements import achievement_copy
from domain.auth import normalize_username
from repositories.admin_user_repository import AdminUserRepository
from schemas.requests import AdminAchievementUpdateRequest, AdminUserCreateRequest, AdminUserUpdateRequest
from services.errors import ServiceError


UserPresenter = Callable[[dict[str, Any]], dict[str, Any]]
StarsResolver = Callable[[psycopg.Connection, dict[str, Any]], int]
JsonListCoercer = Callable[[Any], list[Any]]
JsonDictCoercer = Callable[[Any], dict[str, Any]]
AdminEmailChecker = Callable[[str | None], bool]
PasswordHasher = Callable[[str], str]

_admin_user_schema_ready = False


def _ensure_admin_user_schema() -> None:
    global _admin_user_schema_ready
    if _admin_user_schema_ready:
        return
    ensure_runtime_migrations()
    _admin_user_schema_ready = True


def _normalize_achievement_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        name, description = achievement_copy(
            str(item.get("achievement_id") or ""),
            str(item.get("achievement_name") or ""),
            str(item.get("achievement_desc") or ""),
        )
        item["achievement_name"] = name
        item["achievement_desc"] = description
        item["name"] = name
        item["description"] = description
        normalized.append(item)
    return normalized


def list_admin_users(
    *,
    present_user: UserPresenter,
    total_stars: StarsResolver,
    available_stars: StarsResolver,
) -> list[dict[str, Any]]:
    _ensure_admin_user_schema()
    with db() as conn:
        repo = AdminUserRepository(conn)
        rows = repo.list_users()
        achievements_by_user = repo.achievement_counts_by_user()
        payload: list[dict[str, Any]] = []
        for user_row in rows:
            payload.append(
                {
                    **present_user(user_row),
                    "achievement_count": achievements_by_user.get(int(user_row["id"]), 0),
                    "manual_star_adjustment": int(user_row.get("manual_star_adjustment") or 0),
                    "total_stars": total_stars(conn, user_row),
                    "available_stars": available_stars(conn, user_row),
                }
            )
    return payload


def create_admin_user(
    req: AdminUserCreateRequest,
    *,
    hash_password: PasswordHasher,
    present_user: UserPresenter,
    total_stars: StarsResolver,
    available_stars: StarsResolver,
) -> dict[str, Any]:
    _ensure_admin_user_schema()
    name = req.name.strip()
    surname = req.surname.strip()
    username = normalize_username(req.username)
    email = req.email.strip().lower()
    password = req.password.strip()
    if not name:
        raise ServiceError(400, "Вкажіть ім'я користувача")
    if not username:
        raise ServiceError(400, "Вкажіть нікнейм")
    if "@" not in email or "." not in email:
        raise ServiceError(400, "Вкажіть коректний email")
    if len(password) < 6:
        raise ServiceError(400, "Пароль має містити щонайменше 6 символів")

    with db() as conn:
        repo = AdminUserRepository(conn)
        if repo.get_user_by_email_or_username(email=email, username=username):
            raise ServiceError(409, "Користувач із таким email або нікнеймом уже існує")
        user_row = repo.create_user(
            name=name,
            surname=surname,
            username=username,
            email=email,
            password_hash=hash_password(password),
            is_premium=bool(req.is_premium),
            premium_months=int(req.premium_months or 1),
            is_blocked=bool(req.is_blocked),
        )
        payload = {
            **present_user(user_row),
            "achievement_count": 0,
            "manual_star_adjustment": int(user_row.get("manual_star_adjustment") or 0),
            "total_stars": total_stars(conn, user_row),
            "available_stars": available_stars(conn, user_row),
        }
        conn.commit()
    return payload


def get_admin_user_audit(
    user_id: int,
    *,
    present_user: UserPresenter,
    total_stars: StarsResolver,
    available_stars: StarsResolver,
    coerce_json_list: JsonListCoercer,
    coerce_json_dict: JsonDictCoercer,
) -> dict[str, Any]:
    _ensure_admin_user_schema()
    with db() as conn:
        repo = AdminUserRepository(conn)
        user_row = repo.get_user(user_id=user_id)
        if not user_row:
            raise ServiceError(404, "Користувача не знайдено")
        achievements = _normalize_achievement_rows(repo.list_achievements(user_id=user_id))
        tests = repo.list_tests(user_id=user_id)
        battles = repo.list_battles(email=user_row["email"])
        messages = repo.list_messages(email=user_row["email"])
        total = total_stars(conn, user_row)
        available = available_stars(conn, user_row)

    return {
        "user": {
            **present_user(user_row),
            "manual_star_adjustment": int(user_row.get("manual_star_adjustment") or 0),
            "total_stars": total,
            "available_stars": available,
        },
        "achievements": achievements,
        "tests": tests,
        "battles": [
            {
                **row,
                "question_ids": coerce_json_list(row.get("question_ids")),
                "challenger_answers": coerce_json_dict(row.get("challenger_answers")),
                "opponent_answers": coerce_json_dict(row.get("opponent_answers")),
            }
            for row in battles
        ],
        "messages": [
            {
                **row,
                "result_data": coerce_json_dict(row.get("result_data")),
            }
            for row in messages
        ],
    }


def update_admin_user(
    user_id: int,
    req: AdminUserUpdateRequest,
    *,
    present_user: UserPresenter,
    is_admin_email: AdminEmailChecker,
) -> dict[str, Any]:
    _ensure_admin_user_schema()
    with db() as conn:
        repo = AdminUserRepository(conn)
        target = repo.get_user(user_id=user_id)
        if not target:
            raise ServiceError(404, "Користувача не знайдено")
        if is_admin_email(target.get("email")) and req.is_blocked:
            raise ServiceError(400, "Адміна не можна заблокувати")

        values: dict[str, Any] = {}
        for key in ("total_tests", "total_correct", "total_answers", "marathon_best", "streak_days", "manual_star_adjustment"):
            value = getattr(req, key)
            if value is not None:
                values[key] = max(0, int(value))
        if req.is_premium is not None:
            values["is_premium"] = bool(req.is_premium)
            if not req.is_premium:
                values["premium_expires_at"] = None
            elif req.premium_months is not None:
                values["premium_expires_at"] = (
                    datetime.utcnow() + timedelta(days=31 * int(req.premium_months))
                    if int(req.premium_months) > 0
                    else None
                )
        if req.is_blocked is not None:
            values["is_blocked"] = bool(req.is_blocked)
        updated = repo.update_user(user_id=user_id, values=values) if values else target
        conn.commit()

    return present_user(updated or target)


def delete_admin_user(user_id: int, *, is_admin_email: AdminEmailChecker) -> dict[str, str]:
    _ensure_admin_user_schema()
    with db() as conn:
        repo = AdminUserRepository(conn)
        target = repo.get_user(user_id=user_id)
        if not target:
            raise ServiceError(404, "Користувача не знайдено")
        if is_admin_email(target.get("email")):
            raise ServiceError(400, "Адміністратора не можна видалити")
        repo.delete_user(user_id=user_id)
        conn.commit()
    return {"message": "Користувача видалено", "email": target.get("email")}


def create_admin_password_reset(user_id: int, *, code_factory: Callable[[], str]) -> dict[str, Any]:
    _ensure_admin_user_schema()
    with db() as conn:
        repo = AdminUserRepository(conn)
        target = repo.get_user(user_id=user_id)
        if not target:
            raise ServiceError(404, "Користувача не знайдено")
        code = code_factory()
        repo.set_reset_code(user_id=user_id, code=code, expires_at=datetime.utcnow() + timedelta(minutes=30))
        conn.commit()
    return {"email": target["email"], "code": code}


def update_admin_user_achievement(
    user_id: int,
    req: AdminAchievementUpdateRequest,
    *,
    achievement_defs: list[tuple[Any, ...]],
) -> list[dict[str, Any]]:
    _ensure_admin_user_schema()
    achievement_id = req.achievement_id.strip()
    if not achievement_id:
        raise ServiceError(400, "Потрібен achievement_id")

    meta = next((item for item in achievement_defs if item[0] == achievement_id), None)
    name = meta[2] if meta else achievement_id
    description = meta[3] if meta else "Ручне досягнення від адміністратора"
    tier = meta[1] if meta else 1
    category = meta[4] if meta else "manual"

    with db() as conn:
        repo = AdminUserRepository(conn)
        if not repo.get_user(user_id=user_id):
            raise ServiceError(404, "Користувача не знайдено")
        if req.remove:
            repo.remove_achievement(user_id=user_id, achievement_id=achievement_id)
        else:
            repo.add_achievement(
                user_id=user_id,
                achievement_id=achievement_id,
                name=name,
                description=description,
                tier=tier,
                category=category,
            )
        conn.commit()
        return _normalize_achievement_rows(repo.list_achievements(user_id=user_id))
