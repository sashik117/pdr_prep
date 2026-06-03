from __future__ import annotations

import hashlib
import hmac
import re
from datetime import date
from typing import Any

from core.config import JWT_SECRET
from repositories.access_limit_repository import consume_usage, get_usage

ACTION_LIMITS = {
    "test": (1, 3),
    "test_v2": (1, 3),
    "section_test": (1, 3),
    "section_test_v2": (1, 3),
    "ticket_preview": (1, 3),
    "ticket_preview_v2": (1, 3),
}

GUEST_RE = re.compile(r"[^a-zA-Z0-9:_-]+")


def clean_guest_id(value: str | None) -> str:
    clean = GUEST_RE.sub("", (value or "").strip())[:96]
    return clean or "anonymous"


def hash_value(value: str) -> str:
    return hmac.new(JWT_SECRET.encode("utf-8"), value.encode("utf-8"), hashlib.sha256).hexdigest()


def limit_for(action: str, user: dict[str, Any] | None) -> int | None:
    limits = ACTION_LIMITS.get(action)
    if not limits:
        return None
    guest_limit, user_limit = limits
    return user_limit if user else guest_limit


def access_scope(*, user: dict[str, Any] | None, guest_id: str | None, ip_address: str | None) -> dict[str, Any]:
    if user:
        user_id = int(user["id"])
        return {
            "scope_hash": hash_value(f"user:{user_id}"),
            "user_id": user_id,
            "guest_id": None,
            "ip_hash": None,
        }

    clean_guest = clean_guest_id(guest_id)
    clean_ip = (ip_address or "unknown").split(",")[0].strip() or "unknown"
    return {
        "scope_hash": hash_value(f"guest:{clean_guest}:ip:{clean_ip}"),
        "user_id": None,
        "guest_id": clean_guest,
        "ip_hash": hash_value(clean_ip),
    }


def check_access_limit(*, action: str, user: dict[str, Any] | None, guest_id: str | None, ip_address: str | None) -> dict[str, Any]:
    if user and bool(user.get("is_premium")):
        return {"allowed": True, "count": 0, "limit": None, "remaining": None, "premium": True}

    limit = limit_for(action, user)
    if not limit:
        return {"allowed": True, "count": 0, "limit": None, "remaining": None, "premium": False}

    scope = access_scope(user=user, guest_id=guest_id, ip_address=ip_address)
    today = date.today()
    row = get_usage(usage_date=today, action=action, scope_hash=scope["scope_hash"])
    count = int(row["count"] if row else 0)
    return {
        "allowed": count < limit,
        "count": count,
        "limit": limit,
        "remaining": max(0, limit - count),
        "premium": False,
    }


def consume_access_limit(*, action: str, user: dict[str, Any] | None, guest_id: str | None, ip_address: str | None) -> dict[str, Any]:
    if user and bool(user.get("is_premium")):
        return {"allowed": True, "count": 0, "limit": None, "remaining": None, "premium": True}

    limit = limit_for(action, user)
    if not limit:
        return {"allowed": True, "count": 0, "limit": None, "remaining": None, "premium": False}

    scope = access_scope(user=user, guest_id=guest_id, ip_address=ip_address)
    result = consume_usage(
        usage_date=date.today(),
        action=action,
        scope_hash=scope["scope_hash"],
        limit=limit,
        user_id=scope["user_id"],
        guest_id=scope["guest_id"],
        ip_hash=scope["ip_hash"],
    )
    count = int(result["count"])
    return {
        "allowed": bool(result["allowed"]),
        "count": count,
        "limit": limit,
        "remaining": max(0, limit - count),
        "premium": False,
    }
