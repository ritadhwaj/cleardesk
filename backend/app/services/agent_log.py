"""Human-readable logging of the agents' inner workings.

Two things get logged when `LOG_AGENT_PROMPTS` is on (default):
  1. Every LLM **prompt** an agent sends (which agent, which task, what it asked,
     and the model's reply) — the actual reasoning the agents perform.
  2. Every **message the two agents send each other** over the bus
     (DOC_CLAIM / CHALLENGE / DEFEND / CONCEDE / VERDICT …).

Output goes to `<upload_dir>/agent_conversation.log` and to the server console,
formatted so a human can follow the whole conversation.
"""
import json
import logging
from pathlib import Path

from app.config import settings

_logger: logging.Logger | None = None


def _get() -> logging.Logger:
    global _logger
    if _logger:
        return _logger
    lg = logging.getLogger("cleardesk.agents")
    lg.setLevel(logging.INFO)
    lg.propagate = False
    if not lg.handlers:
        try:
            Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
            fh = logging.FileHandler(
                Path(settings.upload_dir) / "agent_conversation.log", encoding="utf-8")
            fh.setFormatter(logging.Formatter("%(asctime)s  %(message)s", "%H:%M:%S"))
            lg.addHandler(fh)
        except Exception:  # noqa: BLE001
            pass
        ch = logging.StreamHandler()
        ch.setFormatter(logging.Formatter("[agents] %(message)s"))
        lg.addHandler(ch)
    _logger = lg
    return lg


def _clip(text, n: int = 500) -> str:
    s = " ".join(str(text).split())
    return s if len(s) <= n else s[: n - 1] + "…"


# nicer labels for the prompt files
_LABEL = {
    "doc_agent_classify": ("DOC AGENT", "classify document"),
    "doc_agent_extract": ("DOC AGENT", "extract fields"),
    "doc_agent_reread": ("DOC AGENT", "re-read challenged field"),
    "audit_agent_blind_read": ("AUDIT AGENT", "blind re-read"),
    "audit_agent_cross_check": ("AUDIT AGENT", "cross-document check"),
    "scorecard": ("SCORECARD", "write summary"),
}


def log_prompt(prompt_name: str, system_prompt: str, user_content, reply, source: str) -> None:
    """Log one LLM call: who, what task, the ask, and the reply."""
    if not settings.log_agent_prompts:
        return
    who, task = _LABEL.get(prompt_name, (prompt_name.upper(), "reason"))
    asks = []
    for c in user_content:
        if c.get("type") == "image":
            asks.append("[document image]")
        else:
            asks.append(_clip(c.get("text", ""), 400))
    lg = _get()
    lg.info("─" * 72)
    lg.info(f"🧠  {who} · {task}   (via {source})")
    sys_first = (system_prompt.strip().splitlines() or [""])[0]
    lg.info(f"    role   : {_clip(sys_first, 110)}")
    lg.info(f"    asks   : {' ⟩ '.join(asks)}")
    lg.info(f"    replies: {_clip(json.dumps(reply, default=str), 500)}")


_ARROW = "──▶"


def log_message(sender: str, recipient: str, msg_type: str, message: str) -> None:
    """Log one agent-to-agent bus message in plain language."""
    if not settings.log_agent_prompts:
        return
    _get().info(f"💬  {sender.upper():<11} {_ARROW} {recipient.upper():<11} "
                f"[{msg_type}]  {_clip(message, 300)}")
