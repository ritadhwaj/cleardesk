# ClearDesk — Full System Design
### Multi-Agent Document Verification Desk for Banking (KYC / Loan / Tax Filing)

---

## 1. Recommended Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | **React 18 + Vite + TypeScript** | Fast dev loop, TS catches bugs during a rushed hackathon. UI: **Tailwind CSS + shadcn/ui**. |
| Backend | **Python 3.11 + FastAPI** | Python wins over Java here: the entire AI ecosystem (LangGraph, LangChain, Anthropic/OpenAI SDKs, OCR libs) is Python-native. FastAPI gives async APIs + WebSockets + auto Swagger docs. |
| Agent orchestration | **LangGraph** | Built for exactly this: stateful agent graphs with loops (the Extractor ↔ Cross-Verifier to-and-fro). |
| Database | **PostgreSQL 16** (free) | Banking = relational, auditable data. Foreign keys, transactions, and constraints matter for an audit trail. Use `JSONB` columns for flexible agent output — you get Mongo-style flexibility inside Postgres. |
| File storage | Local disk (hackathon) → S3/MinIO path in schema | Store only file paths in DB. |
| Real-time | WebSocket (FastAPI native) | Live agent activity feed in the UI. |
| OCR / Vision | LLM vision API (Claude / GPT-4o) primary; `pytesseract` fallback | Vision LLM does OCR + understanding in one call — huge time saver. |
| Auth | JWT (`python-jose`) + bcrypt | Two roles: `uploader`, `reviewer`. |

**Why not Java?** Spring Boot is great for production banking, but you'd spend the weekend writing boilerplate and calling Python AI tools over HTTP anyway.
**Why not Mongo?** Your data is inherently relational (case → documents → fields → discrepancies → reviews) and judges will ask about audit integrity. Postgres + JSONB is the best of both.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  React SPA (Vite + TS + Tailwind)                           │
│  Upload · Case Dashboard · Agent Feed · Scorecard · Review  │
└──────────────┬───────────────────────────┬──────────────────┘
               │ REST (JSON)               │ WebSocket (live agent events)
┌──────────────▼───────────────────────────▼──────────────────┐
│  FastAPI Backend                                            │
│  ├─ /auth /cases /documents /scorecards /reviews            │
│  ├─ Pipeline Runner (async background task per case)        │
│  └─ WS Hub: broadcasts agent_events to subscribed clients   │
└──────────────┬──────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────┐
│  LangGraph Agent Pipeline (per case)                        │
│  Intake → Classifier → Extractor ⇄ Cross-Verifier           │
│                └→ Verifier ──→ Compliance → Scorecard       │
│  (loop: Cross-Verifier can send fields back to Extractor,   │
│   max 3 rounds, then flag "needs human review")             │
└──────────────┬──────────────────────────────────────────────┘
               │ SQLAlchemy
┌──────────────▼─────────────┐   ┌───────────────────────────┐
│  PostgreSQL                │   │  File store (/uploads)    │
│  cases, documents, fields, │   │  originals + page crops   │
│  agent_events, scorecards… │   │  (evidence snippets)      │
└────────────────────────────┘   └───────────────────────────┘
```

**Pipeline states:** `UPLOADED → PROCESSING → SCORED → IN_REVIEW → APPROVED / REJECTED / RETURNED`

---

## 3. Database Design (PostgreSQL)

```sql
-- Users & auth
users (
  id            UUID PK DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name     TEXT,
  role          TEXT CHECK (role IN ('uploader','reviewer','admin')),
  created_at    TIMESTAMPTZ DEFAULT now()
)

-- Business process definitions (KYC, LOAN, TAX) — config, not code
process_templates (
  id            UUID PK,
  code          TEXT UNIQUE,            -- 'KYC' | 'LOAN' | 'TAX'
  name          TEXT,
  required_docs JSONB,                  -- [{doc_type:'PAN', mandatory:true}, ...]
  rules         JSONB                   -- [{rule_id, description, severity}, ...]
)

-- Known document types & their expected fields
doc_type_templates (
  id             UUID PK,
  code           TEXT UNIQUE,           -- 'PAN','AADHAAR','FORM16','PAYSLIP','BANK_STMT','ITR'
  display_name   TEXT,
  expected_fields JSONB,                -- [{name:'pan_number', regex:'[A-Z]{5}[0-9]{4}[A-Z]', required:true}]
  validity_rules JSONB                  -- expiry checks, format checks
)

-- One submission = one case
cases (
  id                 UUID PK,
  created_by         UUID FK -> users,
  status             TEXT CHECK (status IN ('UPLOADED','PROCESSING','SCORED','IN_REVIEW','APPROVED','REJECTED','RETURNED')),
  inferred_process   UUID FK -> process_templates,   -- best-fit chosen by Classifier
  inference_confidence NUMERIC(5,2),                 -- e.g. 92.40
  created_at         TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ
)

-- Raw uploads (a file may contain multiple logical docs)
uploads (
  id         UUID PK,
  case_id    UUID FK -> cases,
  file_path  TEXT, mime_type TEXT, page_count INT,
  uploaded_at TIMESTAMPTZ
)

-- Logical documents after Intake splits/classifies
documents (
  id            UUID PK,
  case_id       UUID FK -> cases,
  upload_id     UUID FK -> uploads,
  doc_type      UUID FK -> doc_type_templates NULL,  -- NULL = unidentified
  page_range    INT4RANGE,
  classify_confidence NUMERIC(5,2),
  status        TEXT CHECK (status IN ('IDENTIFIED','UNIDENTIFIED','DUPLICATE','ILLEGIBLE'))
)

-- Every field an agent extracts, with evidence
extracted_fields (
  id           UUID PK,
  document_id  UUID FK -> documents,
  field_name   TEXT,
  value_raw    TEXT,                    -- exactly as read
  value_normalized TEXT,               -- cleaned (dates ISO, names casefolded)
  confidence   NUMERIC(5,2),
  evidence_crop_path TEXT,             -- cropped image snippet shown in review UI
  extraction_round INT DEFAULT 1,      -- increments on re-extraction requests
  UNIQUE (document_id, field_name, extraction_round)
)

-- Cross-document & rule findings
discrepancies (
  id          UUID PK,
  case_id     UUID FK -> cases,
  kind        TEXT CHECK (kind IN ('FIELD_MISMATCH','MISSING_DOC','EXPIRED_DOC',
                                   'FORMAT_INVALID','RULE_VIOLATION','LOW_CONFIDENCE')),
  severity    TEXT CHECK (severity IN ('INFO','WARN','FAIL')),
  title       TEXT,                    -- "Name mismatch: PAN vs Aadhaar"
  detail      JSONB,                   -- {field:'name', values:[{doc:'PAN', value:'RITADHWAJ RAY'},...]}
  raised_by   TEXT,                    -- agent name
  resolution  TEXT CHECK (resolution IN ('OPEN','AUTO_RESOLVED','HUMAN_ACCEPTED','HUMAN_CORRECTED')) DEFAULT 'OPEN',
  field_refs  UUID[]                   -- extracted_fields involved
)

-- Full agent audit trail (also streamed over WS)
agent_events (
  id         BIGSERIAL PK,
  case_id    UUID FK -> cases,
  agent      TEXT,                     -- 'intake','classifier','extractor','verifier','cross_verifier','compliance','scorecard'
  event_type TEXT,                     -- 'started','finding','dispute','rebuttal','resolved','completed'
  payload    JSONB,                    -- free-form agent message w/ citations
  created_at TIMESTAMPTZ DEFAULT now()
)

-- Final scorecard (versioned: re-runs create new rows)
scorecards (
  id             UUID PK,
  case_id        UUID FK -> cases,
  version        INT,
  overall_score  NUMERIC(5,2),         -- weighted correctness %
  doc_scores     JSONB,                -- {PAN: 98.0, PAYSLIP: 71.5, ...}
  summary        TEXT,                 -- agent-written executive summary
  auto_verified_count INT, review_needed_count INT, hard_fail_count INT,
  created_at     TIMESTAMPTZ,
  UNIQUE (case_id, version)
)

-- Human-in-the-loop actions (this table = your compliance story)
review_actions (
  id             UUID PK,
  case_id        UUID FK -> cases,
  reviewer_id    UUID FK -> users,
  discrepancy_id UUID FK -> discrepancies NULL,
  action         TEXT CHECK (action IN ('ACCEPT','CORRECT','REJECT_DOC','REQUEST_REUPLOAD','APPROVE_CASE','REJECT_CASE')),
  corrected_value TEXT NULL,
  note           TEXT,
  created_at     TIMESTAMPTZ
)

-- Reviewer corrections recycled as few-shot examples
feedback_examples (
  id           UUID PK,
  doc_type     TEXT, field_name TEXT,
  wrong_value  TEXT, correct_value TEXT,
  context_note TEXT,
  created_at   TIMESTAMPTZ
)
```

**Indexes:** `cases(status)`, `documents(case_id)`, `extracted_fields(document_id)`, `discrepancies(case_id, resolution)`, `agent_events(case_id, id)`.

---

## 4. Backend Design (FastAPI)

### Project layout
```
backend/
├─ app/
│  ├─ main.py                # FastAPI app, CORS, WS hub
│  ├─ config.py              # env vars (DB URL, LLM keys)
│  ├─ db/ (models.py, session.py, seed.py)
│  ├─ api/
│  │  ├─ auth.py             # POST /auth/register /auth/login
│  │  ├─ cases.py            # case CRUD + pipeline trigger
│  │  ├─ documents.py        # file upload/serve, evidence crops
│  │  ├─ reviews.py          # human-in-the-loop actions
│  │  └─ ws.py               # /ws/cases/{id} live agent feed
│  ├─ agents/
│  │  ├─ graph.py            # LangGraph wiring + state schema
│  │  ├─ intake.py  classifier.py  extractor.py
│  │  ├─ verifier.py  cross_verifier.py
│  │  ├─ compliance.py  scorecard.py
│  │  └─ prompts/            # one system prompt file per agent
│  └─ services/
│     ├─ ocr.py              # vision-LLM call + tesseract fallback
│     ├─ files.py            # save, split PDF, crop evidence (pypdf + Pillow)
│     └─ scoring.py          # deterministic score math (NOT the LLM)
└─ alembic/                  # migrations
```

### Key API endpoints
```
POST   /auth/login                       → JWT
POST   /cases                            → create case
POST   /cases/{id}/uploads               → multipart file upload
POST   /cases/{id}/run                   → start agent pipeline (BackgroundTask)
GET    /cases?status=IN_REVIEW           → reviewer queue
GET    /cases/{id}                       → case detail (docs, fields, discrepancies)
GET    /cases/{id}/scorecard             → latest scorecard
GET    /cases/{id}/events?after=<id>     → agent trail (paginated)
WS     /ws/cases/{id}                    → live agent events
POST   /reviews/{case_id}/actions        → ACCEPT / CORRECT / APPROVE_CASE ...
GET    /documents/{id}/file              → serve original / crop
GET    /admin/templates                  → process & doc templates (config UI optional)
```

### Agent pipeline (LangGraph state machine)
```python
class CaseState(TypedDict):
    case_id: str
    documents: list[DocMeta]
    fields: dict                 # doc_id -> {field: value, confidence}
    disputes: list[Dispute]      # open cross-verification disputes
    round: int                   # to-and-fro counter
    findings: list[Finding]

graph = StateGraph(CaseState)
graph.add_node("intake", intake)            # split, OCR, de-skew
graph.add_node("classifier", classifier)    # doc types + best-fit process
graph.add_node("extractor", extractor)      # field extraction w/ evidence crops
graph.add_node("verifier", verifier)        # per-doc template checks
graph.add_node("cross_verifier", cross_verifier)  # cross-doc consistency
graph.add_node("compliance", compliance)    # process-rule checks
graph.add_node("scorecard", scorecard)      # aggregate + summarize

graph.add_edge("intake", "classifier")
graph.add_edge("classifier", "extractor")
graph.add_edge("extractor", "verifier")
graph.add_edge("verifier", "cross_verifier")
graph.add_conditional_edges("cross_verifier",
    lambda s: "extractor" if s["disputes"] and s["round"] < 3 else "compliance")
graph.add_edge("compliance", "scorecard")
```
Every node writes an `agent_events` row and pushes it to the WebSocket hub → the UI feed animates in real time.

**Scoring is deterministic Python, not LLM:**
`overall = Σ(field_confidence × field_weight) − Σ(severity_penalty)` with mandatory-doc gates. Judges will ask "can the AI inflate its own score?" — answer: no, the LLM only produces facts; math produces the score.

---

## 5. Frontend Design (React)

### Project layout
```
frontend/src/
├─ api/client.ts              # axios + JWT interceptor
├─ hooks/useCaseSocket.ts     # WS subscription per case
├─ pages/
│  ├─ Login.tsx
│  ├─ Dashboard.tsx           # case list, status chips, scores
│  ├─ NewCase.tsx             # drag-drop upload (react-dropzone)
│  ├─ CaseDetail.tsx          # 3-tab workspace (see below)
│  └─ ReviewQueue.tsx         # reviewer inbox, sorted by review_needed_count
├─ components/
│  ├─ AgentFeed.tsx           # live chat-style agent activity (the demo star)
│  ├─ ScorecardPanel.tsx      # gauge + per-doc bars + flag counts
│  ├─ DiscrepancyCard.tsx     # side-by-side evidence crops + Accept/Correct
│  ├─ DocViewer.tsx           # original page image + field-highlight overlays
│  ├─ ProcessBadge.tsx        # "Best fit: Home Loan (92%)"
│  └─ PipelineStepper.tsx     # Intake→…→Scorecard progress
└─ store/ (zustand)           # auth + case cache
```

### Key screens
1. **New Case** — drag-drop a messy folder; files listed with type "detecting…"; big *Run Verification* button.
2. **Case Detail** (the demo screen), 3 tabs:
   - **Agent Activity**: live feed — each agent posts findings, disputes, rebuttals with doc/line citations. Disputes render highlighted with a ⚔️ badge and resolution status.
   - **Documents**: page image with bounding-box overlays; click a field → evidence crop + value + confidence.
   - **Scorecard**: overall gauge (e.g., 78%), per-doc bars, three counters (`auto-verified / needs review / hard fail`), missing-doc checklist, agent-written summary.
3. **Review Queue → Review Mode** — reviewer only sees flagged discrepancies as cards: evidence crops side-by-side, `Accept AI` / `Correct value` / `Request re-upload`. Corrections update the scorecard live (new version) and write `feedback_examples`. Final `Approve & Process` / `Reject` buttons.

**Design language:** clean banking neutrals; score colors green ≥90, amber 70–89, red <70; severity chips INFO/WARN/FAIL.

---

## 6. End-to-End Flow

1. Uploader creates case, drops 6 messy files → `POST /cases/{id}/run`.
2. Backend background task runs LangGraph; each node streams events over WS.
3. Intake splits a 12-page PDF into 3 logical docs; Classifier tags them + infers "Home Loan (92%)".
4. Extractor pulls fields with confidence + crops. Verifier checks templates (PAN regex, Aadhaar expiry).
5. Cross-Verifier finds "name differs PAN vs payslip" → dispute → Extractor re-reads (round 2) → still differs → flagged `needs human review`.
6. Compliance maps rules → Scorecard computes 78%, writes version 1, case → `IN_REVIEW`.
7. Reviewer resolves 4 flags in Review Mode, approves → case `APPROVED`, corrections saved as feedback examples.

---

## 7. Hackathon Build Plan (2 people × 2 days)

| Phase | Hours | Deliverable |
|---|---|---|
| 0 | 1h | Repo, docker-compose (postgres), FastAPI + Vite skeletons, seed templates for KYC |
| 1 | 4h | Auth, case/upload APIs, file storage, DB models + migrations |
| 2 | 6h | Agent pipeline: intake, classifier, extractor with vision LLM (start with 3 doc types: PAN, Aadhaar, payslip) |
| 3 | 4h | Verifier + Cross-Verifier loop + deterministic scoring |
| 4 | 6h | Frontend: upload, agent feed (WS), scorecard panel |
| 5 | 4h | Review mode + score recompute + approve flow |
| 6 | 3h | Seed demo dataset with 5 planted defects; rehearse demo; fix polish |

**Cut-list if behind:** drop Compliance agent (fold rules into Verifier), drop auth (hardcode 2 users), drop bounding boxes (show full-page crops).

---

## 8. Demo Script (5 min)

1. 30s problem slide: "Bank ops teams read 40 pages to find 4 problems."
2. Upload messy bundle live → pipeline stepper animates.
3. Zoom into Agent Activity: show the dispute + re-extraction round happening live.
4. Scorecard appears: 78%, 4 flags. "No AI approval — only evidence."
5. Switch to reviewer login → resolve flags in ~30s → score climbs → Approve.
6. Close: "Same engine, new template = loan processing or tax filing. Every decision human-owned, every claim evidence-linked."
