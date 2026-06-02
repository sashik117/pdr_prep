from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Optional

import psycopg

from core.database import db
from domain.auth import normalize_username
from repositories.message_repository import MessageRepository
from schemas.requests import MessageCreateRequest
from services.errors import ServiceError


SocialUserResolver = Callable[[psycopg.Connection, str, dict[str, Any]], Optional[dict[str, Any]]]


@dataclass(frozen=True)
class SentMessage:
    payload: dict[str, Any]
    recipient_email: str


def _coerce_json_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    return {}


def _serialize_json(data: Any) -> str:
    return json.dumps(data if isinstance(data, dict) else {}, ensure_ascii=False, separators=(",", ":"))


def _message_payload(row: dict[str, Any]) -> dict[str, Any]:
    return {
        **row,
        "result_data": _coerce_json_dict(row.get("result_data")),
        "is_read": bool(row.get("is_read")),
    }


def list_messages(
    *,
    partner_email: Optional[str],
    user: dict[str, Any],
    resolve_social_user: SocialUserResolver,
) -> list[dict[str, Any]]:
    with db() as conn:
        repo = MessageRepository(conn)
        if partner_email:
            partner = resolve_social_user(conn, partner_email, user)
            if not partner:
                raise ServiceError(404, "Користувача не знайдено")
            normalized = partner["email"].strip().lower()
            rows = repo.list_between(current_email=user["email"], partner_email=normalized)
            repo.mark_read(to_email=user["email"], from_email=normalized)
            conn.commit()
            return [_message_payload(row) for row in rows]

        rows = repo.list_recent(email=user["email"])

    return [_message_payload(row) for row in rows]


def send_message(
    req: MessageCreateRequest,
    user: dict[str, Any],
    *,
    resolve_social_user: SocialUserResolver,
) -> SentMessage:
    handle = req.to_user.strip()
    if normalize_username(handle) == normalize_username(user.get("username")):
        raise ServiceError(400, "Не можна писати самому собі")
    if req.type not in {"text", "result_share"}:
        raise ServiceError(400, "Невірний тип повідомлення")
    if req.type == "text" and not req.content.strip():
        raise ServiceError(400, "Повідомлення не може бути порожнім")

    with db() as conn:
        friend = resolve_social_user(conn, handle, user)
        if not friend:
            raise ServiceError(404, "Користувача не знайдено")
        repo = MessageRepository(conn)
        if not repo.friendship_exists(user_id=int(user["id"]), friend_id=int(friend["id"])):
            raise ServiceError(403, "Повідомлення можна надсилати тільки друзям")

        message = repo.create_message(
            to_email=friend["email"],
            from_email=user["email"],
            from_name=user["name"],
            content=req.content.strip() or "Запрошення до батлу",
            message_type=req.type,
            result_data_json=_serialize_json(req.result_data),
        )
        conn.commit()

    return SentMessage(payload=_message_payload(message), recipient_email=friend["email"])
