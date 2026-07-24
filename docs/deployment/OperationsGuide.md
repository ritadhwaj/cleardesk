# Operations Guide

Consolidates **Configuration, Environment Variables, Logging, Monitoring, Performance, and
Troubleshooting** for VITA. Everything here reflects behaviour in the code.

## Contents

1. [Configuration & environment variables](#1-configuration--environment-variables)
2. [Logging](#2-logging)
3. [Monitoring & health](#3-monitoring--health)
4. [Performance & quota management](#4-performance--quota-management)
5. [Troubleshooting](#5-troubleshooting)

---

## 1. Configuration & environment variables

Configuration is centralised in `backend/app/config.py` (`pydantic-settings`), loaded from the
process environment or a local `.env`. Every setting and its default:

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql://cleardesk:cleardesk@localhost:5432/cleardesk` | SQLAlchemy connection. `postgres://` is auto-normalised to `postgresql://`. |
| `JWT_SECRET` | `change-me-in-prod` | HS256 signing key — **must** be overridden in prod. |
| `JWT_ALGORITHM` | `HS256` | JWT algorithm. |
| `JWT_EXPIRY_MINUTES` | `480` | Token lifetime (8h). |
| `LLM_PROVIDER` | `mock` | `mock` \| `gemini` \| `ollama` \| `anthropic`. |
| `ANTHROPIC_API_KEY` | `""` | Anthropic key (if that provider). |
| `LLM_MODEL` | `claude-sonnet-5` | Anthropic model. |
| `GEMINI_API_KEY` | `""` | Gemini key (if that provider). |
| `GEMINI_MODEL` | `gemini-2.5-flash-lite` | Primary Gemini model. |
| `GEMINI_FALLBACK_MODELS` | `gemini-2.5-flash,gemini-2.0-flash,gemini-2.0-flash-lite` | Fallback chain on 404/429. |
| `LLM_CACHE` | `true` | Persistent response cache (zero-quota re-runs). |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama endpoint. |
| `OLLAMA_MODEL` | `llama3.2-vision` | Ollama vision model. |
| `UPLOAD_DIR` | `uploads` | Root for files, page renders, crops, cache, agent log. |
| `MAX_CROSS_VERIFY_ROUNDS` | `3` | Cap on challenge/defend rounds per field. |
| `LLM_MIN_INTERVAL_S` | `6.0` | Minimum spacing between LLM calls (free-tier friendly). |
| `AUTO_SEED` | `true` | Seed templates + demo users at startup. |
| `LOG_AGENT_PROMPTS` | `true` | Human-readable agent prompt/message logging. |

**Provider selection quick reference:**

| `LLM_PROVIDER` | Needs | Data leaves host? |
|---|---|---|
| `mock` | nothing | No — canned responses, fully offline |
| `gemini` | free API key | Yes — images sent to Google |
| `ollama` | local Ollama + vision model | No — local inference |
| `anthropic` | paid API key | Yes — images sent to Anthropic |

**Secrets policy:** keep real keys only in `.env` (gitignored) or the platform env store; never
in `.env.example` or any tracked file. See [Security.md](../security/Security.md).

---

## 2. Logging

Three distinct logging surfaces:

| Surface | What it records | Where | Toggle |
|---|---|---|---|
| **Agent conversation log** | Human-readable LLM prompts + agent-to-agent messages | console **and** `{UPLOAD_DIR}/agent_conversation.log` | `LOG_AGENT_PROMPTS` |
| **Agent event audit (DB)** | Every agent action, structured | `agent_events` table (streamed to UI) | always on |
| **Human activity audit (DB)** | Every human action | `activity_logs` table | always on |

The agent log (`services/agent_log.py`) is written by `llm.call_agent` (`log_prompt`) and
`AgentBus.send` (`log_message`), each wrapped in `try/except` so logging can never break a run.

**On Render/containers:** console output appears in the platform **Logs** tab. The
`agent_conversation.log` file lives on the ephemeral container disk (wiped on redeploy) — treat
console as the durable stream; the file is a convenience for local inspection.

**[NOT PRESENT]:** structured JSON logs, log shipping (ELK/Datadog), correlation IDs, log levels
config. Application uses `print`/logger statements and the DB audit trails.

---

## 3. Monitoring & health

- **Health endpoint:** `GET /health` → `{"status":"ok"}` (used by Render's `healthCheckPath`).
- **Operational signals available in-app:** case `status` distribution (`GET /api/cases` `stats`),
  SLA on-time/overdue analytics (`GET /api/cases/insights`), and the two audit tables.

```mermaid
flowchart LR
    hc["/health"] --> render["Render health check → gates traffic"]
    logs["console logs"] --> tab["Render Logs tab"]
    events["agent_events / activity_logs"] --> ui["In-app dashboards + insights"]
```

**[NOT PRESENT]:** metrics endpoint (Prometheus `/metrics`), APM/tracing, alerting, uptime
probes beyond the platform health check. For production, add a metrics exporter and wire alerts
on health-check failures and error-rate.

---

## 4. Performance & quota management

The design assumes constrained free-tier LLM quotas and optimises accordingly (`services/llm.py`):

1. **Image downscaling** — every image is thumbnailed to ≤1024px and re-encoded JPEG q80 before
   sending (`image_block`), cutting image tokens ~4–10× with no practical OCR loss.
2. **Persistent response cache** — identical (provider + agent + content) calls hit a JSON cache
   (`uploads/llm_cache.json`); re-running the same demo docs costs zero quota.
3. **Call throttling** — `_throttle()` enforces `LLM_MIN_INTERVAL_S` (6s) spacing to respect
   Gemini's ~15 RPM free limit.
4. **Model fallback + discovery** — on `404`/`429`/`503`, the Gemini path walks
   `GEMINI_MODEL` → `GEMINI_FALLBACK_MODELS` → API-discovered flash models, and promotes the one
   that worked for subsequent calls.
5. **Concurrency** — the two agents run under one `asyncio.gather`; blocking LLM/file calls are
   offloaded with `asyncio.to_thread` so the event loop (and the WebSocket feed) stays responsive.
6. **Frontend** — route-level code splitting (`React.lazy`) and server-side pagination on the
   dashboard and activity logs keep payloads small.

**Cost/latency note:** the adversarial design roughly doubles LLM calls per field vs a single
agent; the cache + downscaling + `mock` default keep this affordable. On `mock`, a full case runs
in seconds with no network.

**Scaling limits** (see [DeploymentGuide §7](DeploymentGuide.md#7-persistence--scaling-caveats)):
in-process cache and WS hub mean single-instance today; multi-replica needs an external cache and
pub/sub.

---

## 5. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Frontend can't reach API in dev | Vite proxy / backend not running | Ensure `uvicorn` is up on `:8000`; Vite proxies `/api`. |
| `localhost:5173` refuses connection | dev server stopped | Restart `npm run dev` in `frontend/`. |
| Login fails on fresh DB | seed didn't run | Check logs for `seed skipped`; ensure `AUTO_SEED=true` or run `python -m app.db.seed`. |
| `relation does not exist` | DB not reachable at startup | Verify `DATABASE_URL`; tables are created on boot. |
| Agents error `404`/`429` | Gemini model retired / quota | App auto-falls back; or run `python scripts/check_gemini.py`; or set `LLM_PROVIDER=mock`. |
| Blank screen after submitting a case | WS/history load | Fixed by history backfill in `useCaseSocket`; hard-refresh; check WS console. |
| Uploaded files gone after redeploy | ephemeral container disk | Expected on free tier; attach a disk or object storage for persistence. |
| Case stuck in `PROCESSING` | pipeline exception | Check console; on error the orchestrator resets status to `UPLOADED` — re-run. |
| Export downloads empty/blocked | wrong `format` | Use `?format=xlsx` or `?format=pdf` only. |
| PDF/handwriting renders poorly | missing fonts | The image installs `fonts-dejavu-core`; ensure the build stage ran. |

**Diagnostics:**
- `GET /health` for liveness.
- `GET /api/cases/{id}/events` to inspect what the agents actually did.
- `agent_conversation.log` (or console) for the exact prompts/messages when `LOG_AGENT_PROMPTS=true`.
- `python scripts/check_gemini.py` to detect a working Gemini model for your key.
