from __future__ import annotations

from typing import Any


def friend_counterpart(friendship: dict[str, Any], current_user_id: int) -> tuple[int, str]:
    if friendship["requester_id"] == current_user_id:
        return int(friendship["addressee_id"]), "outgoing"
    return int(friendship["requester_id"]), "incoming"
