"""Agent-to-agent message bus.

Both agents run CONCURRENTLY and talk through this bus. Every message is:
  1. delivered to the recipient's inbox (asyncio.Queue),
  2. persisted to agent_events (audit trail),
  3. streamed to the UI over WebSocket (the live agent conversation).

Message protocol
----------------
DOC_CLAIM      doc  -> audit  "I read field X = value V (conf C), here's my evidence"
DOCS_COMPLETE  doc  -> audit  "I've documented everything I was given"
CHALLENGE      audit-> doc    "I doubt claim K because R — re-read it"
DEFEND         doc  -> audit  "Re-read K: I confirm / revise to V' (conf C')"
CONCEDE        doc  -> audit  "You're right, I misread K; revised to V'"
VERDICT        audit-> doc    "Claim K is VERIFIED / DISPUTED (goes to human)"
AUDIT_COMPLETE audit-> doc    "All claims settled; audit finished"
"""
import asyncio
from dataclasses import dataclass, field

from app.services.events import emit


@dataclass
class Message:
    sender: str          # 'doc_agent' | 'audit_agent'
    type: str            # see protocol above
    payload: dict = field(default_factory=dict)


class AgentBus:
    def __init__(self, case_id: str, agents: tuple[str, ...] = ("doc_agent", "audit_agent")):
        self.case_id = case_id
        self.inboxes: dict[str, asyncio.Queue[Message]] = {a: asyncio.Queue() for a in agents}

    async def send(self, sender: str, recipient: str, msg_type: str, payload: dict) -> None:
        # Audit trail + live UI feed. 'message' key is what humans read in the feed.
        emit(self.case_id, sender, msg_type.lower(), {**payload, "to": recipient})
        # human-readable log of the agent-to-agent conversation
        try:
            from app.services.agent_log import log_message
            log_message(sender, recipient, msg_type, str(payload.get("message", "")))
        except Exception:  # noqa: BLE001
            pass
        await self.inboxes[recipient].put(Message(sender=sender, type=msg_type, payload=payload))

    async def receive(self, agent: str) -> Message:
        return await self.inboxes[agent].get()

    def try_receive(self, agent: str) -> Message | None:
        try:
            return self.inboxes[agent].get_nowait()
        except asyncio.QueueEmpty:
            return None
