# Architecture Decision Log (ADRs)

Each record captures a decision that is **observable in the code**, its context, and its
consequences. Status is `Accepted` unless noted. Records are immutable once merged; supersede
rather than edit.

| # | Decision | Status |
|---|---|---|
| [ADR-001](#adr-001-modular-monolith-not-microservices) | Modular monolith, not microservices | Accepted |
| [ADR-002](#adr-002-in-process-asyncio-message-bus-instead-of-a-broker) | In-process asyncio bus instead of a broker | Accepted |
| [ADR-003](#adr-003-two-adversarial-agents-running-in-parallel) | Two adversarial agents in parallel | Accepted |
| [ADR-004](#adr-004-deterministic-scoring-llm-produces-facts-not-the-number) | Deterministic scoring; LLM never scores | Accepted |
| [ADR-005](#adr-005-provider-agnostic-llm-layer-with-mock-default) | Provider-agnostic LLM layer, `mock` default | Accepted |
| [ADR-006](#adr-006-single-service-same-origin-deployment) | Single-service, same-origin deployment | Accepted |
| [ADR-007](#adr-007-jwt-bearer-auth-with-role-based-access) | JWT bearer auth + RBAC | Accepted |
| [ADR-008](#adr-008-config-driven-business-processes-and-document-types) | Config-driven processes & doc types | Accepted |
| [ADR-009](#adr-009-startup-create_all-mini-migrations-instead-of-alembic) | Startup `create_all` + mini-migrations | Accepted (tech debt) |
| [ADR-010](#adr-010-ist-canonical-timestamp-storage) | IST-canonical timestamp storage | Accepted |
| [ADR-011](#adr-011-two-independent-audit-trails-agent-vs-human) | Two independent audit trails | Accepted |

---

## ADR-001: Modular monolith, not microservices

**Context.** The domain is a single bounded context: verify one document bundle, hand to a
human. The workflow steps are tightly coupled and share in-memory state per case.

**Decision.** Ship one FastAPI process that serves REST, WebSocket, and the built SPA. Keep
internal boundaries via packages (`api` / `agents` / `services` / `db`).

**Consequences.** (+) No distributed transactions, no network hops in the agent conversation,
trivial local dev and deploy. (−) Horizontal scale is per-process; a very high case volume would
require sharding by case or extracting the agent runner. Acceptable for the target scale.

---

## ADR-002: In-process asyncio message bus instead of a broker

**Context.** Agents need to exchange typed messages and the exchange must be auditable and
live-streamable.

**Decision.** Implement `AgentBus` with one `asyncio.Queue` inbox per agent (`agents/bus.py`).
Every `send` also persists to `agent_events` and broadcasts over WebSocket.

**Consequences.** (+) Microsecond message delivery, zero infra, complete audit trail for free.
(−) Messaging is bounded to one process/case; there is **no** cross-process durability. If the
process dies mid-run, the case is re-runnable (idempotent re-analysis via resubmit) but the
in-flight conversation is lost. **[NOT PRESENT: Kafka/RabbitMQ/Redis Streams]** — intentional.

---

## ADR-003: Two adversarial agents running in parallel

**Context.** A single extraction agent tends to "echo" its own reading — no independent check.

**Decision.** Run a **Doc Agent** (documenter) and an **Audit Agent** (adversary) concurrently
under `asyncio.gather`. The Audit Agent **blind-reads** the same evidence before seeing the
claimed value, so agreement is genuine corroboration. Disputes iterate up to
`max_cross_verify_rounds` (3), then escalate to a human as a discrepancy.

**Consequences.** (+) Independent verification, self-correction on misreads (CONCEDE path),
strong demo narrative. (−) Roughly doubles LLM calls per field; mitigated by ADR-005's cache,
throttle, and downscaling.

---

## ADR-004: Deterministic scoring; LLM produces facts, not the number

**Context.** A trustworthy grade cannot be produced by the same model being graded.

**Decision.** `services/scoring.py` computes the score in pure Python: average field confidence
minus severity penalties (`INFO 0 / WARN 5 / FAIL 15`), floored at 0. The LLM writes only the
human-readable `summary`.

**Consequences.** (+) Tamper-proof, reproducible, explainable score. (−) Scoring weights are
hard-coded constants; tuning requires a code change (candidate for future config).

---

## ADR-005: Provider-agnostic LLM layer with `mock` default

**Context.** The app must run offline for demos/CI and must survive free-tier quota limits.

**Decision.** One wrapper (`services/llm.py`) with four back-ends (`mock`/`gemini`/`ollama`/
`anthropic`) behind `call_agent()`. Include three quota savers: image downscaling to ≤1024px
JPEG-q80, a persistent JSON response cache, and a Gemini model **fallback chain** with runtime
model discovery on 404/429.

**Consequences.** (+) `mock` runs the entire pipeline with no key/network; provider swap is one
env var; identical re-runs cost zero quota. (−) Cache is a local file (not shared across
instances) — fine for single-instance deploys.

---

## ADR-006: Single-service, same-origin deployment

**Context.** Separate frontend/backend hosting means CORS, cross-URL config, and two deploys.

**Decision.** A multi-stage `Dockerfile` builds the SPA and copies it into the backend image;
`main.py` serves it via `StaticFiles` with an SPA fallback, and all APIs live under `/api`.
`render.yaml` provisions Postgres + the one web service.

**Consequences.** (+) One origin → no CORS in prod, WSS works out of the box, one deploy unit.
(−) Frontend and backend version together (cannot scale independently). Uploads live on
ephemeral container disk — see [OperationsGuide](../deployment/OperationsGuide.md).

---

## ADR-007: JWT bearer auth with role-based access

**Decision.** Local email+password → bcrypt verify → HS256 JWT (`sub`, `role`, `exp`,
default 8h). Every protected route depends on `current_user`; mutating routes add role guards
(`uploader`/`reviewer`/`admin`).

**Consequences.** (+) Stateless, simple, no session store, wildcard CORS is safe (no cookies).
(−) No token revocation list, no refresh tokens, no SSO. **[NOT PRESENT: OAuth/OIDC]**. See
[Security.md](../security/Security.md).

---

## ADR-008: Config-driven business processes and document types

**Decision.** `process_templates` and `doc_type_templates` are database rows (JSONB for required
docs, rules, expected fields). Process inference scores templates by document coverage
(`doc_agent.py::_infer_process`).

**Consequences.** (+) Adding a bank service = a seed row, no code. (−) Complex validation rules
are limited to what the JSONB schema + audit checks express.

---

## ADR-009: Startup `create_all` + mini-migrations instead of Alembic

**Decision.** On startup, `Base.metadata.create_all` plus idempotent
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements and a ref-number backfill (`main.py`).

**Consequences.** (+) Zero migration tooling; a fresh DB is ready instantly. (−) No down-migrations,
no history, risky for destructive schema changes. **Explicitly flagged tech debt** — adopt
Alembic before this handles data that cannot be re-derived.

---

## ADR-010: IST-canonical timestamp storage

**Decision.** All timestamps stored as naive IST wall-clock (`db/models.py::now_ist`); the
frontend converts to the viewer's chosen timezone (globe picker).

**Consequences.** (+) One canonical zone, predictable exports. (−) Naive datetimes require every
reader to know the convention; a future move to UTC-canonical + tz-aware columns is cleaner.
**[ASSUMPTION]** IST was chosen for an India-banking demo context.

---

## ADR-011: Two independent audit trails (agent vs human)

**Decision.** `agent_events` records everything the AI did (streamed live); `activity_logs`
records everything **people** did (`log_activity`). They are never merged.

**Consequences.** (+) Clean separation for compliance: "what the machine claimed" vs "what a
human decided." (−) Two tables to query for a full timeline; the UI stitches them per case.
