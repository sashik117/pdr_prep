from __future__ import annotations

from collections.abc import Callable
from typing import Any

import psycopg

from core.config import FRAME_SHOP
from core.database import db
from domain.profile import purchased_frames
from repositories.frame_repository import FrameRepository
from schemas.requests import FramePurchaseRequest
from services.errors import ServiceError


StarsResolver = Callable[[psycopg.Connection, dict[str, Any]], int]
FrameShopBuilder = Callable[[dict[str, Any], list[str], int], list[dict[str, Any]]]


def purchase_frame(
    req: FramePurchaseRequest,
    user: dict[str, Any],
    *,
    available_stars: StarsResolver,
    build_frame_shop: FrameShopBuilder,
) -> dict[str, Any]:
    frame_id = req.frame_id.strip()
    meta = FRAME_SHOP.get(frame_id)
    if not meta or frame_id == "default":
        raise ServiceError(404, "Рамку не знайдено")
    if meta.get("achievement_id"):
        raise ServiceError(400, "Ця рамка відкривається тільки через досягнення")

    with db() as conn:
        repo = FrameRepository(conn)
        user_row = repo.get_user(user_id=int(user["id"]))
        purchased = purchased_frames(user_row)
        if frame_id in purchased:
            return {
                "message": "Рамка вже відкрита",
                "purchased_frames": purchased,
                "available_stars": available_stars(conn, user_row),
            }

        price = int(meta.get("price") or 0)
        stars = available_stars(conn, user_row)
        if stars < price:
            raise ServiceError(400, "Недостатньо зірок для покупки цієї рамки")

        purchased.append(frame_id)
        repo.purchase_frame(user_id=int(user["id"]), frame_ids=purchased, price=price)
        conn.commit()

        updated = repo.get_user(user_id=int(user["id"]))
        earned_achievement_ids = repo.list_achievement_ids(user_id=int(user["id"]))
        current_stars = available_stars(conn, updated)

    return {
        "message": "Рамку відкрито",
        "purchased_frames": purchased_frames(updated),
        "available_stars": current_stars,
        "frame_shop": build_frame_shop(updated, earned_achievement_ids, current_stars),
    }
