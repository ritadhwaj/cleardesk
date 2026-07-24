# VITA — Architecture & Engineering Documentation

> **VITA — Verify · Improve · Trust · Audit**
> Multi-agent document-verification desk for banking (KYC, loans, cards, tax filing).
> Two AI agents work each document bundle **in parallel and argue** over it, producing an
> evidence-linked correctness scorecard; a human always makes the final decision.

This folder is the **enterprise documentation set**: an architecture review, reverse-engineered
directly from the codebase. Every diagram and table below reflects code that exists in this
repository. Where something is **inferred** or **assumed**, it is labelled inline; where a
commonly-expected component is **absent**, that is stated explicitly rather than invented.

---

## How to read this set

| If you are… | Start with |
|---|---|
| A senior engineer onboarding | [`developer/DeveloperGuide.md`](developer/DeveloperGuide.md) |
| An architect reviewing the design | [`architecture/Architecture.md`](architecture/Architecture.md) |
| A reviewer of data model / schema | [`database/Database.md`](database/Database.md) |
| An API consumer | [`api/APIDocumentation.md`](api/APIDocumentation.md) |
| A security reviewer | [`security/Security.md`](security/Security.md) |
| An SRE / operator deploying | [`deployment/DeploymentGuide.md`](deployment/DeploymentGuide.md), [`deployment/OperationsGuide.md`](deployment/OperationsGuide.md) |

---

## Document map

```
docs/
├─ README.md                         ← you are here (index)
├─ architecture/
│  ├─ Architecture.md                Style + rationale, high-level, C4, modules, packages, request/data flow
│  └─ DecisionLog.md                 Architecture Decision Records (ADRs)
├─ diagrams/
│  ├─ sequence-diagrams.md           Login, run pipeline, agent argument loop, review, retry, export, WS
│  ├─ class-relationships.md         UML class diagrams (agents, services, ORM)
│  └─ external-integrations.md       LLM providers, browser, file system
├─ database/
│  └─ Database.md                    ER diagram, tables, keys, indexes, JSONB shapes
├─ api/
│  └─ APIDocumentation.md            Every REST + WebSocket endpoint, request/response, auth, errors
├─ security/
│  └─ Security.md                    AuthN/AuthZ, JWT, RBAC, secrets, threat notes
└─ deployment/
   ├─ DeploymentGuide.md             Docker, Render blueprint, deployment + infrastructure diagrams
   └─ OperationsGuide.md             Config, env vars, logging, monitoring, performance, troubleshooting
```

### Requested-topic → location index

The original documentation request listed many separate files. To keep the set maintainable
(one source of truth per topic), related subjects are consolidated. This table maps every
requested topic to where it now lives:

| Requested doc | Location |
|---|---|
| Architecture.md | `architecture/Architecture.md` |
| DeveloperGuide.md / LocalDevelopment.md / CodingStandards.md / Contributing.md | `developer/DeveloperGuide.md` |
| DeploymentGuide.md | `deployment/DeploymentGuide.md` |
| Configuration.md / EnvironmentVariables.md | `deployment/OperationsGuide.md` §Configuration |
| APIDocumentation.md | `api/APIDocumentation.md` |
| Security.md | `security/Security.md` |
| Database.md | `database/Database.md` |
| Performance.md / Monitoring.md / Logging.md / Troubleshooting.md / OperationsGuide.md | `deployment/OperationsGuide.md` |
| ReleaseProcess.md | `deployment/DeploymentGuide.md` §Release process |
| DecisionLog.md | `architecture/DecisionLog.md` |
| FAQ.md / Glossary.md | `developer/DeveloperGuide.md` §Glossary & FAQ |
| README.md (project) | repository root [`../README.md`](../README.md) |

> `developer/DeveloperGuide.md` is generated alongside this index — see the document map.

---

## System at a glance

| Property | Value (from code) |
|---|---|
| Architecture style | **Modular monolith** (layered) with an **internal event-driven multi-agent core** — see [Architecture.md](architecture/Architecture.md) |
| Frontend | React 18 + Vite + TypeScript, Tailwind, zustand, react-router (`frontend/`) |
| Backend | Python 3.11 + FastAPI (REST + WebSocket) (`backend/app/`) |
| Persistence | PostgreSQL 16 via SQLAlchemy ORM (14 tables) |
| Concurrency model | `asyncio.gather` of two agents over an in-process message bus; pipeline runs as a FastAPI `BackgroundTask` |
| LLM integration | Provider-agnostic: `mock` / `gemini` / `ollama` / `anthropic` |
| AuthN | JWT (HS256) bearer tokens, bcrypt password hashing |
| AuthZ | Role-based: `uploader` / `reviewer` / `admin` |
| Deployment | Single Docker image (SPA served same-origin by FastAPI) + managed Postgres; Render blueprint |

### Components deliberately **NOT** present (do not assume otherwise)

The following are common in enterprise stacks but **do not exist** in this codebase. They are
listed so reviewers do not expect diagrams for them:

- No message broker (Kafka / RabbitMQ / SQS). The "message bus" is an in-process `asyncio.Queue`.
- No Redis / external cache. The only cache is an on-disk JSON file (`uploads/llm_cache.json`).
- No Kubernetes manifests / Helm charts. Deployment is a single container (Docker + Render).
- No CDN, no dedicated load balancer definition (the PaaS terminates TLS and routes).
- No OAuth / SSO / external IdP. Auth is local username + password → JWT.
- No scheduler / cron / batch jobs **inside the application**.
- No CI/CD pipeline file in-repo; deploys are triggered by Git push (`autoDeploy: true` on Render).
- No Alembic migrations; schema is created at startup with lightweight `ALTER TABLE IF NOT EXISTS` mini-migrations.

_Last synchronised with code: see Git history for `docs/`._
