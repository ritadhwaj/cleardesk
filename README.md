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

## Project structure (planned)

```
cleardesk/
├─ backend/     # FastAPI app + LangGraph agent pipeline
├─ frontend/    # React SPA
└─ docs/        # design documents
```
