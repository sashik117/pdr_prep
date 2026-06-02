from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Optional, Pattern


EMAIL_RE = re.compile(r"[^@]+@[^@]+\.[^@]+")


def normalize_email(value: str) -> str:
    return (value or "").strip().lower()


def normalize_username(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    username = value.strip().lower()
    if username.startswith("@"):
        username = username[1:]
    return username or None


def username_is_valid(value: str, username_re: Pattern[str]) -> bool:
    username = normalize_username(value) or ""
    return bool(username_re.fullmatch(username))


def email_is_valid(value: str) -> bool:
    return bool(EMAIL_RE.fullmatch(normalize_email(value)))


def email_is_verified(user: Optional[dict[str, Any]]) -> bool:
    if not user:
        return False
    if "email_verified" in user and user.get("email_verified") is not None:
        return bool(user.get("email_verified"))
    return bool(user.get("email_confirmed"))


def is_email_login(identifier: str) -> bool:
    normalized = (identifier or "").strip()
    return "@" in normalized and not normalized.startswith("@")


def password_meets_policy(password: str, *, min_length: int = 6) -> bool:
    return len(password or "") >= min_length


def reset_code_is_expired(expires_at: Any, now: datetime) -> bool:
    return not expires_at or expires_at < now
