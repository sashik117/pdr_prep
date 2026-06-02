from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from core.config import SUPPORT_EMAIL, SUPPORT_NAME
from core.database import db
from repositories.support_repository import SupportRepository
from schemas.requests import AdminSupportReplyRequest, SupportMessageCreateRequest
from services.errors import ServiceError
from services.message_service import _coerce_json_dict


UserPresenter = Callable[[dict[str, Any]], dict[str, Any]]


@dataclass(frozen=True)
class AdminSupportReply:
    payload: dict[str, Any]
    target_email: str


@dataclass(frozen=True)
class UserSupportMessage:
    payload: dict[str, Any]
    user_email: str


def list_admin_support_conversations(*, present_user: UserPresenter) -> list[dict[str, Any]]:
    with db() as conn:
        repo = SupportRepository(conn)
        rows = repo.list_conversation_heads(support_email=SUPPORT_EMAIL)
        conversations: list[dict[str, Any]] = []
        for row in rows:
            counterpart_email = row.get("counterpart_email")
            if not counterpart_email or counterpart_email == SUPPORT_EMAIL:
                continue
            counterpart = repo.get_user_by_email(email=counterpart_email)
            if not counterpart:
                continue
            preview = repo.last_message_preview(
                support_email=SUPPORT_EMAIL,
                counterpart_email=counterpart_email,
            )
            unread = repo.unread_from_user(
                support_email=SUPPORT_EMAIL,
                counterpart_email=counterpart_email,
            )
            conversations.append(
                {
                    "user": present_user(counterpart),
                    "last_message": preview,
                    "unread_count": int(unread or 0),
                    "last_message_at": str(row.get("last_message_at") or ""),
                }
            )
    return conversations


def get_admin_support_thread(user_id: int, *, present_user: UserPresenter) -> dict[str, Any]:
    with db() as conn:
        repo = SupportRepository(conn)
        target = repo.get_user(user_id=user_id)
        if not target:
            raise ServiceError(404, "Користувача не знайдено")
        rows = repo.list_thread(support_email=SUPPORT_EMAIL, user_email=target["email"])
        repo.mark_user_messages_read(support_email=SUPPORT_EMAIL, user_email=target["email"])
        conn.commit()
    return {
        "user": present_user(target),
        "messages": [
            {
                **row,
                "result_data": _coerce_json_dict(row.get("result_data")),
                "is_read": bool(row.get("is_read")),
            }
            for row in rows
        ],
    }


def send_admin_support_reply(user_id: int, req: AdminSupportReplyRequest) -> AdminSupportReply:
    content = req.content.strip()
    if not content:
        raise ServiceError(400, "Повідомлення не може бути порожнім")

    with db() as conn:
        repo = SupportRepository(conn)
        target = repo.get_user(user_id=user_id)
        if not target:
            raise ServiceError(404, "Користувача не знайдено")
        message = repo.create_reply(
            to_email=target["email"],
            support_email=SUPPORT_EMAIL,
            support_name=SUPPORT_NAME,
            content=content,
            result_data_json=json.dumps({"sender_role": "support"}, ensure_ascii=False),
        )
        conn.commit()

    payload = {
        **message,
        "result_data": _coerce_json_dict(message.get("result_data")),
        "is_read": bool(message.get("is_read")),
    }
    return AdminSupportReply(payload=payload, target_email=target["email"])


def list_user_support_messages(user: dict[str, Any]) -> list[dict[str, Any]]:
    with db() as conn:
        repo = SupportRepository(conn)
        rows = repo.list_thread(support_email=SUPPORT_EMAIL, user_email=user["email"])
        repo.mark_user_messages_read(support_email=user["email"], user_email=SUPPORT_EMAIL)
        conn.commit()
    return [
        {
            **row,
            "result_data": _coerce_json_dict(row.get("result_data")),
            "is_read": bool(row.get("is_read")),
        }
        for row in rows
    ]


def send_user_support_message(req: SupportMessageCreateRequest, user: dict[str, Any]) -> UserSupportMessage:
    content = req.content.strip()
    if not content:
        raise ServiceError(400, "Повідомлення не може бути порожнім")
    with db() as conn:
        repo = SupportRepository(conn)
        message = repo.create_user_message(
            support_email=SUPPORT_EMAIL,
            user_email=user["email"],
            user_name=user["name"],
            content=content,
        )
        conn.commit()
    payload = {
        **message,
        "result_data": _coerce_json_dict(message.get("result_data")),
        "is_read": bool(message.get("is_read")),
    }
    return UserSupportMessage(payload=payload, user_email=user["email"])
