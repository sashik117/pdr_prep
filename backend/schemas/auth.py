from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel


class AuthMessageResponse(BaseModel):
    message: str
    dev_code: Optional[str] = None


class AuthTokenResponse(BaseModel):
    token: str
    user: dict[str, Any]
