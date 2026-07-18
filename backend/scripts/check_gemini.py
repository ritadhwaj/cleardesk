"""Find a working Gemini model for your API key.

Run from the backend folder (venv active):
    python scripts/check_gemini.py

Tries a tiny request against each candidate model and tells you
which value to put in GEMINI_MODEL in .env.
"""
import sys
from pathlib import Path

import requests

# Static list kept as backup; the script now primarily tests whatever
# models the API says your key can see.
CANDIDATES = [
    "gemini-flash-latest",
    "gemini-flash-lite-latest",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
]


def read_env_key() -> str:
    env = Path(__file__).parent.parent / ".env"
    for line in env.read_text().splitlines():
        if line.startswith("GEMINI_API_KEY="):
            return line.split("=", 1)[1].strip()
    return ""


def main() -> None:
    key = read_env_key()
    if not key:
        sys.exit("No GEMINI_API_KEY in backend/.env")
    headers = {"x-goog-api-key": key}

    print("Models your key can see:")
    discovered: list[str] = []
    r = requests.get("https://generativelanguage.googleapis.com/v1beta/models",
                     headers=headers, timeout=30)
    if r.ok:
        names = [m["name"].removeprefix("models/") for m in r.json().get("models", [])
                 if "generateContent" in m.get("supportedGenerationMethods", [])]
        for n in names:
            print("  -", n)
        # test the key's own flash models first — they're current by definition
        discovered = sorted([n for n in names if "flash" in n],
                            key=lambda n: ("preview" in n, "lite" not in n, n))
    else:
        print("  (list failed:", r.status_code, r.text[:120], ")")

    to_test = discovered[:6] + [c for c in CANDIDATES if c not in discovered]
    print("\nTesting generateContent on candidates:")
    for model in to_test:
        r = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            headers=headers, timeout=60,
            json={"contents": [{"parts": [{"text": "Reply with the word OK"}]}]},
        )
        if r.ok:
            print(f"  ✅ {model}  <-- WORKS. Set GEMINI_MODEL={model} in backend/.env")
            return
        msg = r.json().get("error", {}).get("message", "")[:80] if r.headers.get(
            "content-type", "").startswith("application/json") else r.text[:80]
        print(f"  ❌ {model}: {r.status_code} {msg}")

    print("\nNo candidate worked. Check quota at https://aistudio.google.com "
          "or create a fresh key in a new project.")


if __name__ == "__main__":
    main()
