"""Thin wrapper around the LLM API.

One LLM, many personas: every agent is this same model with a different
system prompt (see app/agents/prompts/). All calls request strict JSON.
"""
import base64
import json
from pathlib import Path

import anthropic

from app.config import settings

_client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

PROMPTS_DIR = Path(__file__).parent.parent / "agents" / "prompts"


def load_prompt(name: str) -> str:
    return (PROMPTS_DIR / f"{name}.txt").read_text(encoding="utf-8")


def call_agent(agent_name: str, user_content: list | str, max_tokens: int = 2048) -> dict:
    """Call the LLM with the agent's system prompt. Returns parsed JSON."""
    if isinstance(user_content, str):
        user_content = [{"type": "text", "text": user_content}]
    response = _client.messages.create(
        model=settings.llm_model,
        max_tokens=max_tokens,
        system=load_prompt(agent_name),
        messages=[{"role": "user", "content": user_content}],
    )
    text = response.content[0].text
    # Agents are prompted to reply with pure JSON; strip fences defensively.
    text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```")
    return json.loads(text)


def image_block(image_path: str) -> dict:
    """Build a vision content block from an image file (for OCR/extraction agents)."""
    data = base64.b64encode(Path(image_path).read_bytes()).decode()
    media_type = "image/png" if image_path.endswith(".png") else "image/jpeg"
    return {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": data}}
