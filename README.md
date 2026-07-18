# ClearDesk

**Multi-Agent Document Verification Desk for Banking** — KYC / Loan Application / Tax Filing.

An agent swarm that decodes, classifies, cross-verifies, and scores raw document uploads — but never approves. It produces an evidence-linked **Correctness Scorecard** and hands the final call to a human reviewer.

> *"AI reads the 40 pages. Humans judge the 4 problems."*

## How it works — two agents, in parallel, arguing

```
 ┌──────────────┐   claims / defenses    ┌──────────────┐
 │  DOC AGENT    │ ─────────────────────▶ │ AUDIT AGENT   │
 │  documenter   │                        │  adversary    │
 │  classify,    │ ◀───────────────────── │  blind read,  │
 │  extract      │  challenges / verdicts │  cross-check  │
 └──────┬───────┘      message bus        └──────┬───────┘
        └───────────────┬────────────────────────┘
                        ▼
            SCORECARD → human review
```

Both agents run **concurrently** on the same case and converse over a message bus (every message persisted + streamed live to the UI):

- **Doc Agent** — intakes uploads, classifies each document, infers the business process (KYC vs Loan vs Tax), extracts fields with evidence, and publishes each reading as a `DOC_CLAIM` the moment it has it. When challenged, it re-reads and `DEFEND`s or `CONCEDE`s.
- **Audit Agent** — audits claims *as they arrive*: deterministic template checks plus its own **blind read** of the same evidence (it never sees the claimed value first). Doubts become `CHALLENGE`s — up to 3 rounds per claim — then unresolved disagreements become discrepancies for a human. After `DOCS_COMPLETE` it sweeps the whole bundle for cross-document inconsistencies and process-rule violations.
- **Scorecard** — deterministic math over confidences and open discrepancies (the LLM writes only the summary; it cannot inflate the score). Case lands in a human **review queue**: reviewers see only flagged items, corrections re-score the case and feed back as few-shot examples.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + Vite + TypeScript, Tailwind + shadcn/ui |
| Backend | Python 3.11 + FastAPI (REST + WebSocket) |
| Agents | LangGraph |
| Database | PostgreSQL 16 (JSONB for agent output) |
| OCR/Vision | LLM vision API, pytesseract fallback |

## Docs

Full system design (architecture, DB schema, APIs, build plan, demo script): [`docs/cleardesk-system-design.md`](docs/cleardesk-system-design.md)

## Project structure

```
cleardesk/
├─ backend/
│  └─ app/
│     ├─ main.py          # FastAPI entry
│     ├─ api/             # auth, cases, documents, reviews, ws
│     ├─ agents/          # doc_agent + audit_agent + bus + orchestrator + prompts/
│     ├─ services/        # llm wrapper, events bus, files, deterministic scoring
│     └─ db/              # SQLAlchemy models, session, seed data
├─ frontend/
│  └─ src/
│     ├─ pages/           # Login, Dashboard, NewCase, CaseDetail, ReviewQueue
│     ├─ components/      # AgentFeed, ScorecardPanel, PipelineStepper, DiscrepancyCard
│     ├─ api/ hooks/ store/
├─ docs/                  # system design
└─ docker-compose.yml     # PostgreSQL
```

## Running locally

```bash
# 1. Database
docker compose up -d

# 2. Backend
cd backend
python -m venv .venv && .venv\Scripts\activate    # Windows
pip install -r requirements.txt
copy .env.example .env                            # LLM_PROVIDER=mock works with no API key
python -m app.db.seed                             # templates + demo users
uvicorn app.main:app --reload                     # http://localhost:8000/docs

# 3. Frontend
cd frontend
npm install
npm run dev                                       # http://localhost:5173
```

Demo logins: `uploader@cleardesk.dev` / `reviewer@cleardesk.dev`, password `demo1234`.
