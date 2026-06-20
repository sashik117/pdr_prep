from __future__ import annotations

import base64
import hashlib
import os
from typing import Any, Optional

from cryptography.fernet import Fernet, InvalidToken


ENCRYPTION_PREFIX = "enc:v1:"


def _secret_material() -> str:
    return (
        os.getenv("DATA_ENCRYPTION_KEY")
        or os.getenv("JWT_SECRET")
        or "driveprep-local-development-key"
    )


def _fernet() -> Fernet:
    digest = hashlib.sha256(_secret_material().encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_private_text(value: Optional[str]) -> str:
    if value is None:
        return ""
    text = str(value)
    if not text or text.startswith(ENCRYPTION_PREFIX):
        return text
    token = _fernet().encrypt(text.encode("utf-8")).decode("ascii")
    return f"{ENCRYPTION_PREFIX}{token}"


def decrypt_private_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value)
    if not text.startswith(ENCRYPTION_PREFIX):
        return text
    try:
        payload = text[len(ENCRYPTION_PREFIX) :].encode("ascii")
        return _fernet().decrypt(payload).decode("utf-8")
    except (InvalidToken, UnicodeDecodeError, ValueError):
        return ""


def decrypt_message_row(row: Any) -> dict[str, Any]:
    item = dict(row)
    item["content"] = decrypt_private_text(item.get("content"))
    return item
