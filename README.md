# ClearDesk

**Multi-Agent Document Verification Desk for Banking** — KYC, loans, cards, tax filing, and 15+ other bank services.

Two AI agents work a document bundle **in parallel and argue about it**: one documents, the other audits and challenges. They decode, classify, cross-verify, and score raw uploads — but never approve. The output is an evidence-linked **Correctness Scorecard**; a human always makes the final call.

> *"AI reads the 40 pages. Humans judge the 4 problems."*

---

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

Both agents run **concurrently** on the same case and converse over an async message bus. Every message is persisted (audit trail) and streamed live to the UI.

- **Doc Agent** — intakes uploads, classifies each document, infers the business process from the bundle, extracts fields with evidence, and publishes each reading as a `DOC_CLAIM` the moment it has it. When challenged it re-reads the exact field and `DEFEND`s or `CONCEDE`s.
- **Audit Agent** — audits claims *as they arrive*: deterministic template checks (regex, required fields, expiry) plus its own **blind read** of the same evidence — it never sees the claimed value first, so agreement is real corroboration, not an echo. Doubts become `CHALLENGE`s (up to 3 rounds/claim); unresolved disagreements become discrepancies for a human. After `DOCS_COMPLETE` it sweeps the whole bundle for cross-document inconsistencies and process-rule violations.
- **Scorecard** — deterministic math over field confidences and open discrepancies. The LLM writes only the human-readable summary; **it cannot inflate its own grade.** The case lands in a human review queue.

The process inference is **data-driven**: each business process is a template row scored by how well the classified documents cover its required docs — adding a new bank service is a config row, not code.

---

## Feature highlights

**Verification pipeline**
- Parallel Doc/Audit agents with a live challenge → defend/concede → verdict loop.
- Handwritten *and* typed forms across PNG / JPG / WEBP / PDF; honest confidence on messy handwriting.
- Deterministic, tamper-proof scoring with an LLM-written executive summary.
- Human-in-the-loop review: accept AI finding, correct a value (fed back as a few-shot example), approve or reject.

**Case management**
- Unique **16-char reference** per case + an auto-generated human name (e.g. *"Home Loan Application — Ritadhwaj Ray"*).
- **Edit & retry**: remove/add documents, give a reason, rerun the agents. Every run is audited in a **Run History** with per-field diffs (added / updated / deleted) and the scorecard version it produced.
- **Exports**: any case scorecard and both activity logs to **Excel & PDF** (filename `*_ddmmyyyyhhmmss` in IST).

**Dashboards & audit**
- Server-side **paginated / filterable / sortable** case table (10 / 20 / 30 / 50 rows).
- Clickable **insight cards** (Awaiting review / Approved / Rejected) → SLA analytics with an animated donut chart, a process pivot table, and an on-time vs overdue case list.
- **Activity logs** for the logged-in user *and* per case (category, action, details), paginated + exportable.
- Created-by / last-updated-by tracking with full timestamps.

**Experience**
- Roles: **uploader**, **reviewer**, and **admin (superuser)** who can do everything.
- Classy **light/dark theme** with an animated sun↔moon toggle; animated login skyline (flying plane, drifting clouds, day/night) and an office-room sidebar that reacts to the theme.
- **Live clock** with an interactive **3D globe timezone picker** — real day/night terminator, blinking night-side city lights. Pick any city; every date/time in the app converts to that zone (data is stored canonically in IST).

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + Vite + TypeScript, Tailwind CSS, zustand, lucide-react |
| Backend | Python 3.11 + FastAPI (REST + WebSocket) |
| Agents | Async orchestrator + message bus (asyncio) |
| Database | PostgreSQL 16 (JSONB for agent output & diffs) |
| LLM | Pluggable: **mock** (no key), **Gemini** (free tier, vision), **Ollama** (local), **Anthropic** |
| Docs/exports | openpyxl (Excel), reportlab (PDF), pymupdf (PDF render), Pillow |

The LLM layer is provider-agnostic with image downscaling, a persistent response cache, and an automatic model-fallback chain to stay within free-tier limits.

---

## Project structure

```
cleardesk/
├─ backend/
│  └─ app/
│     ├─ main.py            # FastAPI entry, CORS, startup migrations
│     ├─ api/               # auth, cases, documents, reviews, activity, ws
│     ├─ agents/            # doc_agent, audit_agent, bus, orchestrator, prompts/
│     ├─ services/          # llm (multi-provider), events bus, files, scoring,
│     │                     #   export (xlsx/pdf), activity logging
│     └─ db/                # SQLAlchemy models, session, seed (templates + users)
├─ frontend/
│  └─ src/
│     ├─ pages/             # Login, Dashboard, NewCase, CaseDetail,
│     │                     #   ReviewQueue, ActivityLog, Insights
│     ├─ components/        # AgentFeed, ScorecardPanel, PipelineStepper,
│     │                     #   DiscrepancyCard, DataTable, Clock, GlobePicker,
│     │                     #   SkylineScene, OfficeScene, ThemeToggle, Layout, …
│     ├─ store/             # auth, theme, timezone (zustand)
│     └─ api/  hooks/
├─ sample_docs/            # categorized demo bundles (16 bank services)
├─ docs/                   # full system design
└─ docker-compose.yml      # PostgreSQL
```

---

## Sample documents

`sample_docs/` contains ready-to-demo bundles organized by bank service, with a mix of typed forms, digital PDFs, and simulated handwriting (neat and messy):

```
home_loan/  kyc_full/  kyc_partial/  new_account/  credit_card/  car_loan/
personal_loan/  business_loan/  locker_facility/  debit_card/  fastag/
cheque_book/  dormant_reactivation/  tax_filing/  nach_si_mandate/  passbook/
```

Drop any folder's files into **New Case** and the agents infer the matching process automatically.

---

## Running locally

```bash
# 1. Database
docker compose up -d

# 2. Backend
cd backend
python -m venv .venv && .venv\Scripts\activate       # Windows (use source .venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
copy .env.example .env                               # LLM_PROVIDER=mock runs with no API key
python -m app.db.seed                                # templates + demo users
uvicorn app.main:app --reload                        # http://localhost:8000/docs

# 3. Frontend
cd frontend
npm install
npm run dev                                          # http://localhost:5173
```

### LLM provider (`backend/.env`)

| `LLM_PROVIDER` | Needs | Notes |
|---|---|---|
| `mock` | nothing | Canned responses; full app + agent conversation runs offline. |
| `gemini` | free key | Vision-capable. Key from https://aistudio.google.com/apikey (no card). Best for real reading. |
| `ollama` | local install | Fully offline; pull a vision model, e.g. `ollama pull llama3.2-vision`. |
| `anthropic` | paid key | Claude models. |

Run `python scripts/check_gemini.py` to auto-detect a working Gemini model for your key.

### Demo logins (password `demo1234`)

| Account | Role | Can |
|---|---|---|
| `uploader@cleardesk.dev` | uploader | create & submit cases |
| `reviewer@cleardesk.dev` | reviewer | review & decide cases |
| `admin@cleardesk.dev` | admin (superuser) | everything |

---

## Docs

Full system design — architecture, database schema, APIs, agent protocol, and demo script: [`docs/cleardesk-system-design.md`](docs/cleardesk-system-design.md)
