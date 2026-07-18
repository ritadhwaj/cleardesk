# ClearDesk

**Multi-Agent Document Verification Desk for Banking** — KYC / Loan Application / Tax Filing.

An agent swarm that decodes, classifies, cross-verifies, and scores raw document uploads — but never approves. It produces an evidence-linked **Correctness Scorecard** and hands the final call to a human reviewer.

> *"AI reads the 40 pages. Humans judge the 4 problems."*

## How it works

```
Intake → Classifier → Extractor ⇄ Cross-Verifier → Compliance → Scorecard → Human Review
```

- **Intake** — OCR, de-skew, split multi-doc uploads
- **Classifier** — identifies doc types and infers the best-fit business process (KYC vs Loan vs Tax)
- **Extractor** — pulls fields with confidence scores and evidence crops
- **Verifier** — per-document template and validity checks
- **Cross-Verifier** — cross-document consistency; disputes loop back to the Extractor (max 3 rounds)
- **Compliance** — maps findings to process rules
- **Scorecard** — deterministic score math (the LLM produces facts, not the score)
- **Human-in-the-loop** — reviewers resolve only flagged items; corrections feed back as few-shot examples

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
│     ├─ agents/          # LangGraph pipeline: one file per agent + prompts/
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
copy .env.example .env                            # add your ANTHROPIC_API_KEY
python -m app.db.seed                             # templates + demo users
uvicorn app.main:app --reload                     # http://localhost:8000/docs

# 3. Frontend
cd frontend
npm install
npm run dev                                       # http://localhost:5173
```

Demo logins: `uploader@cleardesk.dev` / `reviewer@cleardesk.dev`, password `demo1234`.
