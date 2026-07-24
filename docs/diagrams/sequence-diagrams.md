# Sequence Diagrams

Temporal views of the system's key flows. Every participant and message corresponds to real code
paths (file references given per diagram). Diagrams are Mermaid `sequenceDiagram`.

## Contents

1. [Login (authentication)](#1-login-authentication)
2. [Create case → upload → run pipeline (primary business workflow)](#2-create-case--upload--run-pipeline)
3. [Agent argument loop (challenge → defend/concede → verdict)](#3-agent-argument-loop)
4. [Live agent feed over WebSocket](#4-live-agent-feed-over-websocket)
5. [Human review & decision (CRUD-style mutation)](#5-human-review--decision)
6. [Edit-and-retry (resubmit) async workflow](#6-edit-and-retry-resubmit)
7. [Export scorecard (external-format generation)](#7-export-scorecard)
8. [Scheduled jobs](#8-scheduled-jobs)

---

## 1. Login (authentication)

Source: `frontend/src/pages/Login.tsx`, `backend/app/api/auth.py`.

```mermaid
sequenceDiagram
    autonumber
    actor U as User (browser)
    participant SPA as React SPA
    participant API as FastAPI /api/auth/login
    participant DB as PostgreSQL
    participant ACT as activity.log_activity

    U->>SPA: enter email + password, submit
    SPA->>API: POST /api/auth/login {email, password}
    API->>DB: SELECT user WHERE email=?
    DB-->>API: user row (or none)
    alt no user OR bcrypt.verify fails
        API-->>SPA: 401 Invalid credentials
        SPA-->>U: "Invalid credentials — try demo logins"
    else valid
        API->>API: jwt.encode({sub, role, exp+480m}, HS256)
        API->>ACT: log LOGIN (AUTH)
        ACT->>DB: INSERT activity_logs
        API-->>SPA: 200 {access_token, role, full_name}
        SPA->>SPA: useAuth.login(token, role, name)
        SPA-->>U: navigate("/") dashboard
    end
```

---

## 2. Create case → upload → run pipeline

The primary business workflow. `run_case` returns immediately; verification runs in the
background. Source: `api/cases.py`, `agents/orchestrator.py`.

```mermaid
sequenceDiagram
    autonumber
    actor U as Uploader
    participant SPA
    participant API as /api/cases
    participant DB as PostgreSQL
    participant BG as BackgroundTasks
    participant ORCH as run_pipeline

    U->>SPA: pick template, create case
    SPA->>API: POST /api/cases {process}
    API->>API: require_uploader(user)
    API->>DB: INSERT case (status=UPLOADED, template locked)
    API-->>SPA: {id, status}

    U->>SPA: drag-drop files
    SPA->>API: POST /api/cases/{id}/uploads (multipart)
    API->>DB: save files + INSERT uploads
    API-->>SPA: {saved:[...]}

    U->>SPA: Run verification
    SPA->>API: POST /api/cases/{id}/run
    API->>DB: status=PROCESSING; INSERT case_runs(run_no=1, INITIAL)
    API->>BG: add_task(run_pipeline, case_id, run_id)
    API-->>SPA: 200 {status: PROCESSING}
    Note over SPA: SPA opens WebSocket (see diagram 4)

    BG->>ORCH: run_pipeline(case_id, run_id)
    Note over ORCH: asyncio.gather(doc_agent, audit_agent) — see diagram 3
    ORCH->>DB: recompute_scorecard() (deterministic)
    ORCH->>ORCH: LLM writes summary text only
    ORCH->>DB: finalize CaseRun (field diff), name case, status=IN_REVIEW
```

---

## 3. Agent argument loop

The heart of the system. Both agents run concurrently over `AgentBus`. Source:
`agents/orchestrator.py`, `agents/bus.py`, `agents/doc_agent.py`, `agents/audit_agent.py`.

```mermaid
sequenceDiagram
    autonumber
    participant ORCH as orchestrator
    participant DOC as Doc Agent
    participant BUS as AgentBus (queues)
    participant AUD as Audit Agent
    participant LLM as llm.call_agent
    participant EVT as events.emit → DB + WS

    ORCH->>DOC: run(bus)
    ORCH->>AUD: run(bus)  (gather: concurrent)

    loop for each upload
        DOC->>LLM: classify(pages[:3])
        LLM-->>DOC: {doc_type, confidence}
        DOC->>LLM: extract(fields template + few-shots)
        LLM-->>DOC: {fields[...]}
        DOC->>EVT: findings (Reading '..', classified ..)
        DOC->>BUS: DOC_CLAIM(field values + evidence)
        BUS->>AUD: deliver DOC_CLAIM
        BUS->>EVT: persist + broadcast
    end

    AUD->>LLM: blind_read(same crop, value hidden)
    LLM-->>AUD: independent reading
    alt readings disagree / template rule fails
        AUD->>BUS: CHALLENGE(field, reason)
        BUS->>DOC: deliver CHALLENGE
        DOC->>LLM: reread(exact crop)
        alt DEFEND
            DOC->>BUS: DEFEND(value, reasoning)
        else CONCEDE
            DOC->>DB: INSERT revised field (round+1)
            DOC->>BUS: CONCEDE(new value)
        end
        Note over AUD: repeat up to max_cross_verify_rounds (3)
        AUD->>DB: unresolved → INSERT Discrepancy (OPEN)
    else agree
        AUD->>BUS: VERDICT VERIFIED
    end

    DOC->>BUS: DOCS_COMPLETE
    AUD->>AUD: cross-document + process-rule sweep
    AUD->>BUS: AUDIT_COMPLETE
    Note over DOC,AUD: gather() returns → orchestrator scores
```

---

## 4. Live agent feed over WebSocket

Source: `frontend/src/hooks/useCaseSocket.ts`, `api/ws.py`, `services/events.py`.

```mermaid
sequenceDiagram
    autonumber
    participant SPA as CaseDetail (useCaseSocket)
    participant HTTP as GET /api/cases/{id}/events
    participant WS as WS /api/ws/cases/{id}
    participant HUB as WsHub
    participant EMIT as events.emit (agents)

    SPA->>HTTP: load history (events after 0)
    HTTP-->>SPA: past agent_events[]
    SPA->>WS: open WebSocket
    WS->>HUB: hub.connect(case_id, ws)
    loop keepalive every 20s
        SPA->>WS: "ping"
    end
    Note over EMIT: each agent action calls emit()
    EMIT->>HUB: broadcast(case_id, message)
    HUB-->>SPA: live event JSON
    SPA->>SPA: append (dedupe by id), render feed
    SPA->>WS: close on unmount → hub.disconnect
```

---

## 5. Human review & decision

Source: `api/reviews.py`. Corrections recompute the scorecard and feed back as training examples.

```mermaid
sequenceDiagram
    autonumber
    actor R as Reviewer / Admin
    participant SPA
    participant API as POST /api/reviews/{case_id}/actions
    participant DB as PostgreSQL
    participant SC as scoring.recompute_scorecard

    R->>SPA: choose action on a discrepancy / case
    SPA->>API: {action, discrepancy_id?, corrected_value?, note?}
    API->>API: role in (reviewer, admin)? else 403
    API->>DB: INSERT review_actions
    alt action = ACCEPT
        API->>DB: discrepancy.resolution=HUMAN_ACCEPTED
    else action = CORRECT
        API->>DB: resolution=HUMAN_CORRECTED
        API->>DB: INSERT FeedbackExample (few-shot for future runs)
    else APPROVE_CASE / REJECT_CASE / REQUEST_REUPLOAD
        API->>DB: case.status = APPROVED / REJECTED / RETURNED
    end
    opt action in (ACCEPT, CORRECT)
        API->>SC: recompute_scorecard(case_id)
        SC->>DB: INSERT scorecard (new version)
    end
    API->>DB: log_activity(action, REVIEW)
    API-->>SPA: {ok, case_status}
```

---

## 6. Edit-and-retry (resubmit)

Async re-run that snapshots fields, wipes prior analysis (keeping audit rows), and diffs.
Source: `api/cases.py::resubmit_case`, `orchestrator._finalize_run`.

```mermaid
sequenceDiagram
    autonumber
    actor U as Uploader
    participant API as POST /api/cases/{id}/resubmit
    participant DB
    participant BG as BackgroundTasks
    participant ORCH as run_pipeline

    U->>API: {note} (reason for retry)
    API->>API: require_uploader; reject if status=PROCESSING (409)
    API->>DB: snapshot fields_map() → prev_fields
    API->>DB: INSERT case_runs(run_no+1, RETRY, note, prev_fields)
    API->>DB: DELETE extracted_fields, documents, discrepancies (analysis only)
    Note over DB: scorecards + agent_events + review_actions KEPT as audit
    API->>DB: status=PROCESSING
    API->>BG: add_task(run_pipeline, case_id, run_id)
    API-->>U: {status: PROCESSING, run_no}
    BG->>ORCH: re-run agents
    ORCH->>DB: diff_fields(prev, new) → case_runs.field_diff (added/updated/deleted)
```

---

## 7. Export scorecard

Source: `api/cases.py::export_case`, `services/export.py`.

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant API as GET /api/cases/{id}/export?format=
    participant EXP as export.build_export
    participant DB

    U->>API: request xlsx | pdf
    API->>API: validate format ∈ {xlsx, pdf} else 400
    API->>DB: load case + scorecard + discrepancies
    API->>EXP: build_export(db, case, format)
    EXP-->>API: (bytes, media_type, filename base *_ddmmyyyyhhmmss IST)
    API->>DB: log_activity(EXPORTED_XLSX/PDF, EXPORT)
    API-->>U: 200 file (Content-Disposition: attachment)
```

---

## 8. Scheduled jobs

**[NOT PRESENT].** The application defines **no** cron, scheduler, or batch job. Verification is
triggered only by an explicit `POST /run` or `/resubmit`. The single time-based behaviour is the
**SLA calculation** in `GET /api/cases/insights`, which is computed on-read (comparing
`created_at`/`updated_at` against a 24h window), not by a scheduled task.

> If recurring jobs are later required (e.g. nightly SLA-breach digests), they would be added as
> an external scheduler invoking an endpoint — no in-app scheduler exists today.
