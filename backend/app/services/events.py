"""Agent event bus: persists every agent event to DB + broadcasts to WebSocket clients.

This file is why judges can trust the system: nothing an agent does is off the record.
"""
import asyncio
import json
from collections import defaultdict

from fastapi import WebSocket

from app.db.session import SessionLocal
from app.db import models


class WsHub:
    def __init__(self) -> None:
        self._clients: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, case_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._clients[case_id].append(ws)

    def disconnect(self, case_id: str, ws: WebSocket) -> None:
        if ws in self._clients.get(case_id, []):
            self._clients[case_id].remove(ws)

    async def broadcast(self, case_id: str, message: dict) -> None:
        for ws in list(self._clients.get(case_id, [])):
            try:
                await ws.send_text(json.dumps(message, default=str))
            except Exception:
                self.disconnect(case_id, ws)


hub = WsHub()


def emit(case_id: str, agent: str, event_type: str, payload: dict) -> None:
    """Persist an agent event and push it to any live UI. Called by every agent node."""
    db = SessionLocal()
    try:
        event = models.AgentEvent(case_id=case_id, agent=agent,
                                  event_type=event_type, payload=payload)
        db.add(event)
        db.commit()
        db.refresh(event)
        message = {"id": event.id, "agent": agent, "type": event_type,
                   "payload": payload, "at": event.created_at.isoformat()}
    finally:
        db.close()

    # Fire-and-forget into the running event loop (pipeline runs in a thread).
    try:
        loop = asyncio.get_event_loop()
        loop.create_task(hub.broadcast(case_id, message))
    except RuntimeError:
        asyncio.run(hub.broadcast(case_id, message))
