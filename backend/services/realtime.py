from __future__ import annotations

from collections import defaultdict
from typing import Any, Optional

from fastapi import WebSocket


class RealtimeHub:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, email: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[email.strip().lower()].add(websocket)

    def disconnect(self, email: str, websocket: WebSocket) -> None:
        normalized = email.strip().lower()
        sockets = self._connections.get(normalized)
        if not sockets:
            return
        sockets.discard(websocket)
        if not sockets:
            self._connections.pop(normalized, None)

    async def emit(self, email: str, event: str, payload: Optional[dict[str, Any]] = None) -> None:
        normalized = email.strip().lower()
        sockets = list(self._connections.get(normalized, set()))
        stale: list[WebSocket] = []
        for socket in sockets:
            try:
                await socket.send_json({"event": event, "payload": payload or {}})
            except Exception:
                stale.append(socket)
        for socket in stale:
            self.disconnect(normalized, socket)
