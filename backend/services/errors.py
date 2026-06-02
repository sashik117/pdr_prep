from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ServiceError(Exception):
    status_code: int
    message: str

