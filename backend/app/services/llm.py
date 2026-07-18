"""Provider-agnostic LLM wrapper.

One LLM, many personas: every agent is the same model with a different system
prompt (see app/agents/prompts/). All calls request strict JSON.

Set LLM_PROVIDER in .env:
  mock      -> no API key, no network. Canned responses so the full pipeline,
               bus conversation, and UI run end-to-end. Default.
  gemini    -> Google AI Studio free tier (https://aistudio.google.com/apikey),
               no credit card, vision-capable. Best free option for real OCR.
  ollama    -> fully local via Ollama (https://ollama.com). Use a vision model:
               `ollama pull llama3.2-vision` or `qwen2.5vl`.
  anthropic -> Claude API (paid key).
"""
import base64
import json
from pathlib import Path

from app.config import settings

PROMPTS_DIR = Path(__file__).parent.parent / "agents" / "prompts"


def load_prompt(name: str) -> str:
    return (PROMPTS_DIR / f"{name}.txt").read_text(encoding="utf-8")


def image_block(image_path: str) -> dict:
    """Provider-neutral image block; translated per provider below."""
    data = base64.b64encode(Path(image_path).read_bytes()).decode()
    media_type = "image/png" if image_path.endswith(".png") else "image/jpeg"
    return {"type": "image", "media_type": media_type, "data": data}


def call_agent(agent_name: str, user_content: list | str, max_tokens: int = 2048) -> dict:
    """Call the configured LLM with the agent's system prompt. Returns parsed JSON."""
    if isinstance(user_content, str):
        user_content = [{"type": "text", "text": user_content}]

    provider = settings.llm_provider.lower()
    if provider == "mock":
        return _mock(agent_name)
    if provider == "gemini":
        text = _gemini(agent_name, user_content, max_tokens)
    elif provider == "ollama":
        text = _ollama(agent_name, user_content, max_tokens)
    else:
        text = _anthropic(agent_name, user_content, max_tokens)

    text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```")
    return json.loads(text)


# ---------------------------------------------------------------- providers

def _anthropic(agent_name: str, content: list, max_tokens: int) -> str:
    import anthropic  # lazy import: only needed when actually used
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    blocks = [
        {"type": "image", "source": {"type": "base64", "media_type": c["media_type"], "data": c["data"]}}
        if c["type"] == "image" else c
        for c in content
    ]
    resp = client.messages.create(
        model=settings.llm_model, max_tokens=max_tokens,
        system=load_prompt(agent_name),
        messages=[{"role": "user", "content": blocks}],
    )
    return resp.content[0].text


_throttle_lock = None
_last_call_ts = 0.0


def _throttle() -> None:
    """Space out calls to respect Gemini free-tier rate limits (~15 RPM)."""
    global _throttle_lock, _last_call_ts
    import threading
    import time
    if _throttle_lock is None:
        _throttle_lock = threading.Lock()
    with _throttle_lock:
        wait = settings.llm_min_interval_s - (time.time() - _last_call_ts)
        if wait > 0:
            time.sleep(wait)
        _last_call_ts = time.time()


def _gemini(agent_name: str, content: list, max_tokens: int) -> str:
    import time
    import requests
    parts = [
        {"inline_data": {"mime_type": c["media_type"], "data": c["data"]}}
        if c["type"] == "image" else {"text": c["text"]}
        for c in content
    ]
    url = (f"https://generativelanguage.googleapis.com/v1beta/models/"
           f"{settings.gemini_model}:generateContent?key={settings.gemini_api_key}")
    body = {
        "system_instruction": {"parts": [{"text": load_prompt(agent_name)}]},
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {"maxOutputTokens": max_tokens, "responseMimeType": "application/json"},
    }
    for attempt in range(4):
        _throttle()
        resp = requests.post(url, json=body, timeout=120)
        if resp.status_code in (429, 503) and attempt < 3:
            time.sleep(20)  # free-tier rate limit — back off and retry
            continue
        resp.raise_for_status()
        return resp.json()["candidates"][0]["content"]["parts"][0]["text"]
    raise RuntimeError("Gemini: retries exhausted")


def _ollama(agent_name: str, content: list, max_tokens: int) -> str:
    import requests
    text = "\n".join(c["text"] for c in content if c["type"] == "text")
    images = [c["data"] for c in content if c["type"] == "image"]
    resp = requests.post(f"{settings.ollama_base_url}/api/chat", json={
        "model": settings.ollama_model,
        "stream": False,
        "format": "json",
        "messages": [
            {"role": "system", "content": load_prompt(agent_name)},
            {"role": "user", "content": text, **({"images": images} if images else {})},
        ],
    }, timeout=300)
    resp.raise_for_status()
    return resp.json()["message"]["content"]


# ---------------------------------------------------------------- mock mode

_MOCK_RESPONSES: dict[str, dict] = {
    "doc_agent_classify": {
        "doc_type": "PAN", "confidence": 91.0, "process_guess": "KYC",
        "reason": "(mock) Income Tax Department card layout detected",
    },
    "doc_agent_extract": {
        "fields": [
            {"name": "pan_number", "value_raw": "ABCDE1234F", "value_normalized": "ABCDE1234F",
             "confidence": 96.0, "bbox": [100, 300, 360, 340], "note": None},
            {"name": "name", "value_raw": "Ritadhwaj Ray", "value_normalized": "RITADHWAJ RAY",
             "confidence": 88.0, "bbox": [100, 200, 420, 240], "note": None},
            {"name": "dob", "value_raw": "12/04/1999", "value_normalized": "1999-04-12",
             "confidence": 62.0, "bbox": [100, 400, 300, 440], "note": "(mock) digit smudged"},
        ],
    },
    "doc_agent_reread": {
        "decision": "CONCEDE", "value": "1999-04-21", "confidence": 90.0,
        "reasoning": "(mock) On re-read, final digits are '21', not '12' — challenger was right",
    },
    "audit_agent_blind_read": {
        "fields": [
            {"name": "pan_number", "value": "ABCDE1234F", "confidence": 95.0, "suspicion": None},
            {"name": "name", "value": "RITADHWAJ RAY", "confidence": 90.0, "suspicion": None},
            {"name": "dob", "value": "1999-04-21", "confidence": 58.0, "suspicion": "digits blurred"},
        ],
    },
    "audit_agent_cross_check": {
        "issues": [
            {"kind": "FIELD_MISMATCH", "severity": "WARN",
             "title": "(mock) Name format differs between PAN and payslip",
             "detail": {"field": "name", "values": [
                 {"doc": "PAN", "value": "RITADHWAJ RAY"},
                 {"doc": "PAYSLIP", "value": "R. RAY"}]}},
        ],
    },
    "scorecard": {
        "summary": "(mock) KYC bundle: PAN verified cleanly; DOB corrected after "
                   "agent dispute; one name-format variance needs reviewer judgment.",
    },
}


def _mock(agent_name: str) -> dict:
    """Deterministic canned responses: lets the whole system — parallel agents,
    bus conversation, disputes, scorecard, review flow — run with zero keys."""
    return _MOCK_RESPONSES.get(agent_name, {"note": f"(mock) no canned response for {agent_name}"})
