from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.events import hub

router = APIRouter()


@router.websocket("/ws/cases/{case_id}")
async def case_events_ws(websocket: WebSocket, case_id: str):
    """Live agent-event feed for one case. Frontend hook: useCaseSocket."""
    await hub.connect(case_id, websocket)
    try:
        while True:
            await websocket.receive_text()  # keepalive; client sends pings
    except WebSocketDisconnect:
        hub.disconnect(case_id, websocket)
