from __future__ import annotations

from collections.abc import Callable
from typing import Any

import psycopg

from core.database import db
from domain.auth import normalize_username
from domain.friends import friend_counterpart
from repositories.friend_repository import FriendRepository
from schemas.requests import FriendInviteRequest
from services.errors import ServiceError


SocialUserResolver = Callable[[psycopg.Connection, str, dict[str, Any]], dict[str, Any] | None]


def list_friends(user: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    current_user_id = int(user["id"])
    current_email = str(user["email"])

    with db() as conn:
        repo = FriendRepository(conn)
        repo.mark_pending_seen(addressee_id=current_user_id)
        friendships = repo.list_friendships(user_id=current_user_id)

        accepted: list[dict[str, Any]] = []
        incoming: list[dict[str, Any]] = []
        outgoing: list[dict[str, Any]] = []

        for friendship in friendships:
            counterpart_id, direction = friend_counterpart(friendship, current_user_id)
            counterpart = repo.get_friend_summary_user(user_id=counterpart_id)
            if not counterpart:
                continue
            unread = repo.unread_count(to_email=current_email, from_email=counterpart["email"])
            last_message = repo.last_message_between(
                current_email=current_email,
                counterpart_email=counterpart["email"],
            )
            payload = {
                "id": friendship["id"],
                "status": friendship["status"],
                "created_at": str(friendship["created_at"]),
                "direction": direction,
                "user": counterpart,
                "unread_count": unread,
                "last_message": last_message,
            }
            if friendship["status"] == "accepted":
                accepted.append(payload)
            elif direction == "incoming":
                incoming.append(payload)
            else:
                outgoing.append(payload)
        conn.commit()

    return {"friends": accepted, "incoming": incoming, "outgoing": outgoing}


def invite_friend(
    req: FriendInviteRequest,
    user: dict[str, Any],
    *,
    resolve_social_user: SocialUserResolver,
) -> dict[str, Any]:
    handle = req.username.strip()
    target_username = normalize_username(handle)
    if target_username == normalize_username(user.get("username")):
        raise ServiceError(400, "Не можна додати себе в друзі")

    current_user_id = int(user["id"])
    with db() as conn:
        repo = FriendRepository(conn)
        target = resolve_social_user(conn, handle, user)
        if not target:
            raise ServiceError(404, "Користувача з таким email або ніком не знайдено")
        if target.get("is_blocked"):
            raise ServiceError(403, "Цей користувач тимчасово недоступний")

        existing = repo.find_between(requester_id=current_user_id, addressee_id=int(target["id"]))
        if existing:
            if existing["status"] == "accepted":
                return {
                    "payload": {
                        "message": "Ви вже в друзях",
                        "friendship_id": existing["id"],
                        "status": "accepted",
                    },
                    "emit": [],
                }
            if existing["addressee_id"] == current_user_id:
                repo.accept_friendship(friendship_id=int(existing["id"]))
                conn.commit()
                requester_email = repo.get_user_email(user_id=int(existing["requester_id"]))
                return {
                    "payload": {
                        "message": "Запрошення було вхідним, тому друга одразу додано",
                        "friendship_id": existing["id"],
                        "status": "accepted",
                    },
                    "emit": [email for email in (requester_email, user["email"]) if email],
                }
            return {
                "payload": {
                    "message": "Запрошення вже надіслано і ще очікує підтвердження",
                    "friendship_id": existing["id"],
                    "status": "pending",
                },
                "emit": [],
            }

        friendship = repo.create_invite(requester_id=current_user_id, addressee_id=int(target["id"]))
        conn.commit()
        return {
            "payload": {"message": "Запрошення надіслано", "friendship_id": friendship["id"]},
            "emit": [target["email"]],
            "event": "friend_request",
            "event_payload": {"from_email": user["email"]},
        }


def accept_friend(friendship_id: int, user: dict[str, Any]) -> dict[str, Any]:
    current_user_id = int(user["id"])
    with db() as conn:
        repo = FriendRepository(conn)
        friendship = repo.get_friendship(friendship_id=friendship_id)
        if not friendship:
            raise ServiceError(404, "Запрошення не знайдено")
        if friendship["addressee_id"] != current_user_id:
            raise ServiceError(403, "Немає доступу до цього запрошення")
        repo.accept_friendship(friendship_id=friendship_id)
        requester_email = repo.get_user_email(user_id=int(friendship["requester_id"]))
        conn.commit()
    return {
        "payload": {"message": "Друга додано"},
        "emit": [email for email in (requester_email, user["email"]) if email],
    }


def remove_friend(friendship_id: int, user: dict[str, Any]) -> dict[str, str]:
    current_user_id = int(user["id"])
    with db() as conn:
        repo = FriendRepository(conn)
        friendship = repo.get_friendship(friendship_id=friendship_id)
        if not friendship:
            raise ServiceError(404, "Запис не знайдено")
        if current_user_id not in {int(friendship["requester_id"]), int(friendship["addressee_id"])}:
            raise ServiceError(403, "Немає доступу")
        repo.delete_friendship(friendship_id=friendship_id)
        conn.commit()
    return {"message": "Запис видалено"}
