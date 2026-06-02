from __future__ import annotations

from typing import Any

from core.config import SUPPORT_EMAIL
from core.database import db
from repositories.notification_repository import NotificationRepository


def get_notifications_summary(user: dict[str, Any]) -> dict[str, int]:
    with db() as conn:
        repo = NotificationRepository(conn)
        friend_requests = repo.pending_friend_requests(user_id=int(user["id"]))
        unread_friend_messages = repo.unread_friend_messages(
            email=user["email"],
            support_email=SUPPORT_EMAIL,
        )
        battle_invites = repo.pending_battle_invites(email=user["email"])
        support_unread = repo.unread_support_messages(
            email=user["email"],
            support_email=SUPPORT_EMAIL,
        )
    return {
        "friends": friend_requests + unread_friend_messages,
        "battles": battle_invites,
        "support": support_unread,
    }
