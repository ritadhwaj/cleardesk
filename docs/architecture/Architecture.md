# VITA — Architecture

This document is the authoritative architecture description for VITA, reverse-engineered from
the source. Diagrams are Mermaid (render in GitHub/most Markdown viewers). Inferred or assumed
elements are marked **[INFERRED]** / **[ASSUMPTION]**; absent-but-commonly-expected elements are
marked **[NOT PRESENT]**.

## Contents

1. [Architecture style & rationale](#1-architecture-style--rationale)
2. [High-level system architecture](#2-high-level-system-architecture)
3. [C4 Model](#3-c4-model)
4. [Module dependency diagram](#4-module-dependency-diagram)
5. [Package structure](#5-package-structure)
6. [Request-flow diagram](#6-request-flow-diagram)
7. [Data-flow diagram](#7-data-flow-diagram)
8. [The agent subsystem (core innovation)](#8-the-agent-subsystem-core-innovation)
9. [Cross-cutting concerns](#9-cross-cutting-concerns)

---

## 1. Architecture style & rationale

**Classification: a layered _modular monolith_ with an internal _event-driven, message-passing
multi-agent core_.** It is a hybrid, and the label matters for reviewers:

| Dimension | Reality in code | Evidence |
|---|---|---|
| Deployment topology | **Monolith** — one FastAPI process serves REST, WebSocket, *and* the built SPA | `backend/app/main.py` mounts routers + `StaticFiles` in one app |
| Internal structure | **Layered / modular** — `api` → `services`/`agents` → `db`, one-directional | package layout under `backend/app/` |
| Agent orchestration | **Event-driven, actor-like** — two concurrent agents exchange typed messages via a bus | `agents/bus.py`, `agents/orchestrator.py` |
| Frontend | **SPA** (client-rendered, route-code-split) | `frontend/src/App.tsx` (`React.lazy`) |

**Why a modular monolith rather than microservices?** The domain (verify one document bundle,
then hand to a human) is a single bounded context with a strongly-coupled workflow: intake →
classify → extract → cross-verify → score → review. Splitting these into network services would
add latency, distributed-transaction complexity, and operational cost with no scaling benefit —
the unit of work is one case, processed in-memory. The monolith keeps the agent conversation an
in-process `asyncio` exchange (microsecond hops) instead of broker round-trips.

**Why event-driven *inside*?** The product's differentiator is that the two agents run
**concurrently and argue**. That maps naturally to message passing: each agent is an actor with
an inbox (`asyncio.Queue`); claims, challenges, defenses, and verdicts are typed messages. This
gives true concurrency (`asyncio.gather`) and a complete, replayable audit trail — every message
is persisted to `agent_events` and streamed to the UI.

```mermaid
flowchart LR
    subgraph Monolith["Single FastAPI process (monolith boundary)"]
        direction TB
        API["API layer<br/>(REST + WebSocket)"]
        subgraph Core["Event-driven agent core"]
            direction LR
            DOC["Doc Agent"] <-->|"typed messages<br/>(asyncio.Queue)"| AUD["Audit Agent"]
        end
        SVC["Services<br/>(llm · scoring · files · events · export · activity)"]
        DB[("PostgreSQL")]
        API --> SVC
        API -->|BackgroundTask| Core
        Core --> SVC
        SVC --> DB
    end
    SPA["React SPA"] -->|HTTP/WS same-origin| API
```

### Design principles enforced in code

- **Deterministic scoring, LLM-assisted facts.** The LLM extracts fields and writes prose; the
  *number* is pure Python math (`services/scoring.py`). "The AI cannot inflate its own grade."
- **Everything on the record.** Every agent action is persisted (`services/events.py::emit`);
  every human action is persisted (`services/activity.py`). Two independent audit trails.
- **Human-in-the-loop.** Agents never approve. The pipeline terminates in `IN_REVIEW`
  (`agents/orchestrator.py`); only a `reviewer`/`admin` can approve/reject (`api/reviews.py`).
- **Config over code.** Business processes and document types are database rows
  (`process_templates`, `doc_type_templates`), not classes. Adding a bank service = a seed row.
- **Provider-agnostic AI.** One wrapper, four back-ends (`services/llm.py`); the rest of the app
  never imports an SDK.

---

## 2. High-level system architecture

```mermaid
flowchart TB
    subgraph Users["Users"]
        U1["Uploader"]
        U2["Reviewer"]
        U3["Admin"]
    end

    subgraph Client["Client application"]
        SPA["React 18 SPA (Vite build)<br/>zustand · react-router · axios · WebSocket"]
    end

    subgraph Edge["PaaS edge — [INFERRED: Render-managed]"]
        LB["TLS termination + HTTP/WS routing<br/>[NOT PRESENT as code: no LB/CDN in repo]"]
    end

    subgraph App["Application — single FastAPI container"]
        REST["REST routers<br/>/api/auth · cases · documents · reviews · activity"]
        WS["WebSocket<br/>/api/ws/cases/{id}"]
        STATIC["Static SPA host (StaticFiles)"]
        ORCH["Agent orchestrator (BackgroundTask)"]
        AGENTS["Doc Agent ⇄ Audit Agent (asyncio bus)"]
        SVCS["Services: llm · scoring · files · events · export · activity · agent_log"]
    end

    DB[("PostgreSQL 16<br/>14 tables, JSONB")]
    FS["Local file system<br/>uploads/ (pages, crops, llm_cache.json, agent log)"]

    subgraph Ext["External systems (LLM provider — pluggable)"]
        GEM["Google Gemini API"]
        OLL["Ollama (local)"]
        ANT["Anthropic API"]
        MOCK["mock (no network)"]
    end

    U1 & U2 & U3 --> SPA --> LB --> REST & WS & STATIC
    REST --> SVCS
    REST -->|enqueue| ORCH --> AGENTS --> SVCS
    SVCS --> DB
    SVCS --> FS
    SVCS -->|"vision + JSON calls"| GEM & OLL & ANT & MOCK
    WS -. "live agent feed" .-> SPA
```

> **[NOT PRESENT]** There is no CDN, application load balancer, or reverse proxy defined in this
> repository. In a Render/Fly deployment the platform provides TLS + routing; that box is
> **[INFERRED]** from the deploy target, not from code.

---

## 3. C4 Model

### Level 1 — System Context

```mermaid
flowchart TB
    person1["👤 Bank staff<br/>(Uploader / Reviewer / Admin)"]
    subgraph s1[" "]
        vita["<b>VITA</b><br/>Multi-agent document<br/>verification desk<br/>[Software System]"]
    end
    llm["LLM Provider<br/>Gemini / Ollama / Anthropic<br/>[External System]"]

    person1 -->|"Submits document bundles,<br/>reviews scorecards,<br/>approves/rejects (HTTPS)"| vita
    vita -->|"Sends document images,<br/>requests JSON readings"| llm
    llm -->|"Returns classifications,<br/>field extractions"| vita
    vita -->|"Streams live agent<br/>conversation (WSS)"| person1
```

**Actors & externals**

- **Bank staff** — three roles (see [Security](../security/Security.md)).
- **LLM Provider** — one of four back-ends selected by `LLM_PROVIDER`. `mock` requires no
  external system at all (fully offline).

### Level 2 — Container Diagram

```mermaid
flowchart TB
    user["👤 Bank staff"]

    subgraph vita["VITA system boundary"]
        spa["<b>Web SPA</b><br/>React 18 + Vite + TS<br/>[Container: browser]"]
        api["<b>Application</b><br/>FastAPI (Python 3.11)<br/>REST + WebSocket + SPA host<br/>[Container: Docker]"]
        db[("<b>Database</b><br/>PostgreSQL 16<br/>[Container]")]
        fs["<b>File store</b><br/>Container filesystem: uploads/<br/>[Container: local disk]"]
    end

    llm["LLM Provider API<br/>[External]"]

    user -->|"HTTPS / WSS"| spa
    spa -->|"JSON over HTTPS<br/>Bearer JWT"| api
    spa -->|"WSS live events"| api
    api -->|"SQLAlchemy / psycopg2"| db
    api -->|"read/write page images,<br/>evidence crops, cache"| fs
    api -->|"HTTPS (vision + JSON)"| llm
```

> **[ASSUMPTION]** In the single-service production image the SPA is not a separate deployed
> container — it is a static build served **by** the FastAPI container (`main.py` `StaticFiles`).
> It is drawn as its own container only to reflect that it executes in the browser.

### Level 3 — Component Diagram (Application container)

```mermaid
flowchart TB
    subgraph api_layer["API layer (app/api)"]
        auth["auth.py<br/>login · current_user (JWT)"]
        cases["cases.py<br/>CRUD · run · resubmit · export · insights"]
        docs["documents.py<br/>file · evidence crop"]
        reviews["reviews.py<br/>review actions · decisions"]
        activity_api["activity.py<br/>user/case audit logs"]
        ws["ws.py<br/>WebSocket endpoint"]
    end

    subgraph agents["Agent core (app/agents)"]
        orch["orchestrator.py<br/>run_pipeline()"]
        bus["bus.py<br/>AgentBus (asyncio.Queue)"]
        doc_ag["doc_agent.py"]
        aud_ag["audit_agent.py"]
        prompts["prompts/*.txt"]
    end

    subgraph services["Services (app/services)"]
        llm_s["llm.py<br/>provider-agnostic wrapper + cache + fallback"]
        scoring["scoring.py<br/>deterministic scorecard + checklist + diff"]
        files["files.py<br/>prepare_pages · crop_evidence"]
        events["events.py<br/>emit() → DB + WsHub broadcast"]
        export["export.py<br/>xlsx / pdf"]
        act["activity.py<br/>log_activity()"]
        alog["agent_log.py<br/>human-readable prompt/message log"]
    end

    subgraph data["Data layer (app/db)"]
        models["models.py (ORM)"]
        session["session.py (engine/Session)"]
        seed["seed.py (templates + demo users)"]
    end

    db[("PostgreSQL")]
    llm_ext["LLM provider"]

    cases --> orch
    orch --> bus
    orch --> doc_ag & aud_ag
    doc_ag <--> bus
    aud_ag <--> bus
    doc_ag & aud_ag --> llm_s
    doc_ag & aud_ag --> files
    doc_ag & aud_ag --> events
    orch --> scoring
    llm_s --> prompts
    llm_s --> alog
    bus --> events
    bus --> alog
    llm_s --> llm_ext

    auth & cases & docs & reviews & activity_api --> models
    cases --> export
    cases & reviews & auth --> act
    scoring --> models
    events --> models
    models --> session --> db
    seed --> models
```

### Level 4 — Code Diagram (agent argument loop, where practical)

The most intricate logic is the challenge/defend/concede loop between agents. Rather than a
class diagram (agents are modules of async functions, not classes), the Level-4 view is the
control flow of a single disputed field:

```mermaid
flowchart TB
    start(["Doc Agent extracts field<br/>value V, confidence C"]) --> claim["send DOC_CLAIM → Audit"]
    claim --> blind["Audit blind-reads same crop<br/>(never sees V first)"]
    blind --> cmp{"Audit value ≈ V<br/>and no template rule broken?"}
    cmp -->|yes| verified["send VERDICT: VERIFIED"]
    cmp -->|no| challenge["send CHALLENGE(field, reason)"]
    challenge --> reread["Doc Agent re-reads exact crop<br/>(call_agent 'doc_agent_reread')"]
    reread --> dec{"decision?"}
    dec -->|DEFEND| defend["send DEFEND(V, reasoning)"]
    dec -->|CONCEDE| concede["persist revised field<br/>(extraction_round+1)<br/>send CONCEDE(V')"]
    defend --> round{"rounds < max_cross_verify_rounds (3)?"}
    concede --> verified
    round -->|yes| challenge
    round -->|no| dispute["record Discrepancy (OPEN)<br/>→ human review"]
    verified --> done(["field settled"])
    dispute --> done
```

> Source: `agents/doc_agent.py::_handle`, `agents/audit_agent.py`, cap from
> `settings.max_cross_verify_rounds` (default 3).

---

## 4. Module dependency diagram

Dependencies point **downward only** (api → agents/services → db). No layer imports upward; no
service imports an API router. This acyclic direction is the key structural invariant.

```mermaid
flowchart TB
    subgraph L1["Presentation — app/api"]
        A_auth[auth]; A_cases[cases]; A_docs[documents]; A_rev[reviews]; A_act[activity]; A_ws[ws]
    end
    subgraph L2["Orchestration — app/agents"]
        G_orch[orchestrator]; G_bus[bus]; G_doc[doc_agent]; G_aud[audit_agent]
    end
    subgraph L3["Domain services — app/services"]
        S_llm[llm]; S_score[scoring]; S_files[files]; S_evt[events]; S_exp[export]; S_act[activity]; S_alog[agent_log]
    end
    subgraph L4["Data — app/db"]
        D_models[models]; D_sess[session]; D_seed[seed]
    end
    subgraph L0["Config"]
        C[config.settings]
    end

    A_cases --> G_orch
    A_ws --> S_evt
    G_orch --> G_bus & G_doc & G_aud & S_score & S_llm
    G_doc & G_aud --> G_bus & S_llm & S_files & S_evt
    G_bus --> S_evt & S_alog
    S_llm --> S_alog
    A_auth & A_cases & A_docs & A_rev & A_act --> D_models
    A_cases --> S_exp & S_act
    A_rev & A_auth --> S_act
    S_score & S_evt & S_exp & S_act & S_alog --> D_models
    D_models --> D_sess
    D_seed --> D_models
    L1 & L2 & L3 & L4 -.->|read config| C
```

**Ownership** (**[INFERRED]** from a single-maintainer repo — adjust to your team's CODEOWNERS):

| Module group | Suggested owner |
|---|---|
| `app/api/*` | API / Platform team |
| `app/agents/*` | AI / Agents team |
| `app/services/llm.py` | AI / Agents team |
| `app/services/{scoring,export,files,activity,events}` | Core Backend team |
| `app/db/*` | Data / Backend team |
| `frontend/*` | Frontend team |

---

## 5. Package structure

```mermaid
flowchart LR
    subgraph backend["backend/app"]
        main["main.py"]
        config["config.py"]
        api["api/"]
        agents["agents/ (+ prompts/)"]
        services["services/"]
        dbp["db/"]
    end
    subgraph frontend["frontend/src"]
        appt["App.tsx / main.tsx"]
        pages["pages/"]
        components["components/"]
        store["store/ (zustand)"]
        apic["api/client.ts"]
        hooks["hooks/"]
    end
    main --> api & agents & services & dbp & config
    appt --> pages --> components & apic & store & hooks
```

Physical layout (verified against the tree):

```
cleardesk/
├─ backend/app/
│  ├─ main.py                 FastAPI app, CORS, startup migrations, SPA host
│  ├─ config.py               pydantic-settings (env/.env)
│  ├─ api/                    auth, cases, documents, reviews, activity, ws
│  ├─ agents/                 orchestrator, bus, doc_agent, audit_agent, prompts/
│  ├─ services/               llm, scoring, files, events, export, activity, agent_log
│  └─ db/                     models, session, seed
├─ frontend/src/
│  ├─ pages/                  Login, Dashboard, NewCase, CaseDetail, ReviewQueue, ActivityLog, Insights
│  ├─ components/             Layout, AgentFeed, ScorecardPanel, PipelineStepper, DiscrepancyCard,
│  │                          DataTable, Clock, GlobePicker, SkylineScene, OfficeScene, ThemeToggle, …
│  ├─ store/                  auth, theme, timezone (zustand)
│  ├─ api/client.ts           axios instance + typed API + WS URL
│  └─ hooks/useCaseSocket.ts  history + live WebSocket feed
├─ sample_docs/               demo bundle generator
├─ Dockerfile · render.yaml · docker-compose.yml
└─ docs/                      this documentation set
```

---

## 6. Request-flow diagram

Generic path for an authenticated REST call, including the exception branches actually present
in the code (401 invalid token, 403 role guard, 404 not found, 409 conflict).

```mermaid
flowchart TB
    req(["HTTP request + Bearer JWT"]) --> cors["CORS middleware"]
    cors --> route["FastAPI router match (/api/...)"]
    route --> dep["Depends(current_user):<br/>jwt.decode + user lookup"]
    dep -->|JWTError / no user| e401["HTTP 401"]
    dep -->|ok| guard{"role guard?<br/>require_uploader / reviewer"}
    guard -->|role mismatch| e403["HTTP 403"]
    guard -->|ok| valid["Pydantic body validation"]
    valid -->|invalid| e422["HTTP 422"]
    valid --> handler["Route handler (business logic)"]
    handler --> exists{"entity found?"}
    exists -->|no| e404["HTTP 404"]
    exists -->|state conflict| e409["HTTP 409 (e.g. already PROCESSING)"]
    exists -->|ok| svc["Service / ORM work"]
    svc --> audit["log_activity(...) → activity_logs"]
    audit --> commit["session commit"]
    commit --> resp(["HTTP 200 + JSON"])
    e401 & e403 & e404 & e409 & e422 --> errresp(["error JSON {detail}"])
```

> Handlers that mutate state (`create_case`, `upload_files`, `run_case`, `resubmit_case`,
> `review_action`, exports) additionally call `log_activity(...)`. The heavy verification work
> is **not** done in the request thread — `run_case` enqueues `run_pipeline` as a FastAPI
> `BackgroundTask` and returns `202`-style `{status: PROCESSING}` immediately.

---

## 7. Data-flow diagram

End-to-end flow of a document from upload to human decision.

```mermaid
flowchart LR
    subgraph input["Input"]
        up["Uploaded files<br/>(PNG/JPG/WEBP/PDF)"]
    end
    subgraph processing["Processing (agents)"]
        prep["prepare_pages()<br/>render → page images"]
        classify["Doc Agent: classify"]
        extract["Doc Agent: extract fields + crop evidence"]
        blind["Audit Agent: blind-read + template checks"]
        argue["challenge / defend / concede loop"]
        cross["Audit Agent: cross-doc + rule sweep"]
        score["scoring.recompute_scorecard()<br/>(deterministic)"]
        summary["LLM writes summary text only"]
    end
    subgraph persistence["Persistence"]
        db[("PostgreSQL")]
        fs["uploads/ (pages, crops, cache, log)"]
    end
    subgraph output["Output"]
        sc["Scorecard (correctness + completeness)"]
        feed["Live agent feed (WS)"]
        rev["Human review → APPROVED / REJECTED / RETURNED"]
        exp["Excel / PDF export"]
    end

    up --> prep --> classify --> extract --> blind --> argue --> cross --> score --> summary
    prep --> fs
    extract --> fs
    classify & extract & blind & argue & cross --> db
    score --> db
    db --> sc --> rev --> db
    argue --> feed
    sc --> exp
    rev -->|CORRECT → FeedbackExample| db
```

**Key data transformations**

1. **Files → page images** (`services/files.py::prepare_pages`) — PDFs/images normalised to
   per-page PNGs under `uploads/{case}/pages/`.
2. **Image → structured fields** — the LLM returns strict JSON; each field is persisted with a
   cropped evidence image (`crop_evidence`).
3. **Fields + discrepancies → number** — `scoring.py` averages field confidences and subtracts
   severity penalties (`INFO 0 / WARN 5 / FAIL 15`). Deterministic.
4. **Reviewer correction → training signal** — a `CORRECT` action writes a `FeedbackExample`
   later injected as few-shot context on the next extraction (`doc_agent.py`).

---

## 8. The agent subsystem (core innovation)

Two agents run under one `asyncio.gather`, each with an inbox queue on the `AgentBus`. The bus
does three things on every `send`: deliver to the recipient inbox, persist to `agent_events`
(audit), and broadcast over WebSocket (live UI). See
[sequence diagrams](../diagrams/sequence-diagrams.md) for the temporal view.

```mermaid
flowchart LR
    subgraph orchestrator["run_pipeline() — BackgroundTask"]
        gather["asyncio.gather(doc, audit)"]
    end
    subgraph bus["AgentBus"]
        q1["inbox: doc_agent (Queue)"]
        q2["inbox: audit_agent (Queue)"]
    end
    doc["doc_agent.run()"]
    aud["audit_agent.run()"]
    gather --> doc & aud
    doc -->|"DOC_CLAIM / DEFEND / CONCEDE / DOCS_COMPLETE"| q2
    aud -->|"CHALLENGE / VERDICT / AUDIT_COMPLETE"| q1
    q1 --> doc
    q2 --> aud
    bus -->|persist| evt[("agent_events")]
    bus -->|broadcast| wshub["WsHub → browser"]
    bus -->|human log| logf["agent_conversation.log"]
```

**Message protocol** (from `agents/bus.py` docstring — authoritative):

| Message | Direction | Meaning |
|---|---|---|
| `DOC_CLAIM` | doc → audit | "I read field X = V (conf C); evidence attached." |
| `DOCS_COMPLETE` | doc → audit | "Everything I was given is documented." |
| `CHALLENGE` | audit → doc | "I doubt claim K because R — re-read it." |
| `DEFEND` | doc → audit | "Re-read K: I confirm / revise to V'." |
| `CONCEDE` | doc → audit | "You're right, I misread K; revised to V'." |
| `VERDICT` | audit → doc | "Claim K is VERIFIED / DISPUTED (→ human)." |
| `AUDIT_COMPLETE` | audit → doc | "All claims settled; audit finished." |

**Termination.** The Doc Agent loops on its inbox until it receives `AUDIT_COMPLETE`; the
orchestrator's `gather` then returns, the scorecard is computed, and the case moves to
`IN_REVIEW`. Per-claim disputes are capped at `max_cross_verify_rounds` (default 3); unresolved
disputes become `Discrepancy` rows for a human.

---

## 9. Cross-cutting concerns

| Concern | Implementation | Location |
|---|---|---|
| **Configuration** | `pydantic-settings` from env/`.env` | `config.py` |
| **AuthN** | JWT HS256, bcrypt hashes | `api/auth.py` |
| **AuthZ** | role guards (`require_uploader`, reviewer check) | `api/cases.py`, `api/reviews.py` |
| **Async execution** | FastAPI `BackgroundTasks` + `asyncio.gather`; blocking LLM/IO wrapped in `asyncio.to_thread` | `orchestrator.py`, agents |
| **Messaging** | in-process `asyncio.Queue` bus **[NOT PRESENT: external broker]** | `agents/bus.py` |
| **Caching** | on-disk JSON LLM response cache | `services/llm.py` |
| **Rate limiting (egress)** | `_throttle()` spaces LLM calls (`llm_min_interval_s`) + model fallback chain | `services/llm.py` |
| **Logging** | agent prompt/message human log; audit trails in DB | `services/agent_log.py`, `events.py`, `activity.py` |
| **Exception handling** | per-file `try/except` so one bad upload never kills a case; pipeline errors reset status | agents, `orchestrator.py` |
| **Exports** | openpyxl (xlsx) + reportlab (pdf) | `services/export.py` |
| **Migrations** | `create_all` + `ALTER TABLE IF NOT EXISTS` at startup **[NOT PRESENT: Alembic]** | `main.py` startup |
| **Real-time** | WebSocket hub broadcasting `agent_events` | `services/events.py`, `api/ws.py` |
| **Timezone** | canonical IST storage; per-user display conversion | `db/models.py::now_ist`, frontend `store/timezone` |

See also: [DecisionLog.md](DecisionLog.md) for the reasoning behind these choices.
