from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class BattleSubmitResponse(BaseModel):
    status: str
    score: int
    winner_email: Optional[str] = None
    seconds_left: Optional[int] = None

