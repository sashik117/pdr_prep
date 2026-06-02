from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class MvsExamBlockResponse(BaseModel):
    key: str
    label: str
    required_count: int
    actual_count: int


class MvsExamResponse(BaseModel):
    category: str
    questions_count: int
    blocks: list[MvsExamBlockResponse]
    questions: list[dict[str, Any]]

