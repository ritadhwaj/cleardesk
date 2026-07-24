# Database

**Engine:** PostgreSQL 16. **Access:** SQLAlchemy ORM (`psycopg2-binary`), declarative models in
`backend/app/db/models.py`. **Schema management:** created at startup via
`Base.metadata.create_all` + idempotent `ALTER TABLE IF NOT EXISTS` mini-migrations in
`main.py` (**[NOT PRESENT: Alembic]** — see [ADR-009](../architecture/DecisionLog.md#adr-009)).

All timestamps are stored as **naive IST wall-clock** (`now_ist()`), converted to the viewer's
timezone in the frontend.

## Entity-Relationship Diagram

```mermaid
erDiagram
    users ||--o{ cases : "created_by"
    users ||--o{ review_actions : "reviewer_id"
    process_templates ||--o{ cases : "inferred_process_id"
    cases ||--o{ uploads : ""
    cases ||--o{ documents : ""
    cases ||--o{ discrepancies : ""
    cases ||--o{ scorecards : ""
    cases ||--o{ review_actions : ""
    cases ||--o{ case_runs : ""
    cases ||--o{ agent_events : ""
    uploads ||--o{ documents : ""
    doc_type_templates ||--o{ documents : "doc_type_id"
    documents ||--o{ extracted_fields : ""
    discrepancies ||--o{ review_actions : "discrepancy_id"

    users {
        uuid id PK
        string email UK
        string password_hash
        string full_name
        string role "uploader|reviewer|admin"
        datetime created_at
    }
    process_templates {
        uuid id PK
        string code UK "KYC|CAR_LOAN|..."
        string name
        jsonb required_docs
        jsonb rules
        text description
    }
    doc_type_templates {
        uuid id PK
        string code UK "PAN|AADHAAR|PAYSLIP|..."
        string display_name
        jsonb expected_fields
        jsonb validity_rules
    }
    cases {
        uuid id PK
        uuid created_by FK
        string ref_no UK "16-char, indexed"
        string name
        string updated_by "human name"
        string status
        uuid inferred_process_id FK
        numeric inference_confidence
        datetime created_at
        datetime updated_at
    }
    uploads {
        uuid id PK
        uuid case_id FK
        string file_path
        string mime_type
        int page_count
        datetime uploaded_at
    }
    documents {
        uuid id PK
        uuid case_id FK
        uuid upload_id FK
        uuid doc_type_id FK
        int page_start
        int page_end
        numeric classify_confidence
        string status "IDENTIFIED|UNIDENTIFIED|DUPLICATE|ILLEGIBLE"
    }
    extracted_fields {
        uuid id PK
        uuid document_id FK
        string field_name
        text value_raw
        text value_normalized
        numeric confidence
        string evidence_crop_path
        int extraction_round
    }
    discrepancies {
        uuid id PK
        uuid case_id FK
        string kind
        string severity "INFO|WARN|FAIL"
        string title
        jsonb detail
        string raised_by
        string resolution "OPEN|AUTO_RESOLVED|HUMAN_ACCEPTED|HUMAN_CORRECTED"
        uuid_array field_refs
    }
    agent_events {
        int id PK "autoincrement"
        uuid case_id FK
        string agent
        string event_type
        jsonb payload
        datetime created_at
    }
    scorecards {
        uuid id PK
        uuid case_id FK
        int version
        numeric overall_score
        jsonb doc_scores
        text summary
        int auto_verified_count
        int review_needed_count
        int hard_fail_count
        numeric completeness_score
        jsonb checklist
        datetime created_at
    }
    review_actions {
        uuid id PK
        uuid case_id FK
        uuid reviewer_id FK
        uuid discrepancy_id FK
        string action
        text corrected_value
        text note
        datetime created_at
    }
    case_runs {
        uuid id PK
        uuid case_id FK
        int run_no
        string trigger "INITIAL|RETRY"
        text note
        jsonb prev_fields
        jsonb field_diff
        int scorecard_version
        datetime started_at
        datetime finished_at
    }
    activity_logs {
        int id PK "autoincrement"
        uuid user_id "no FK (audit)"
        string user_name
        uuid case_id "no FK (audit)"
        string case_ref
        string category "AUTH|CASE|DOCUMENT|REVIEW|RETRY|EXPORT"
        string action
        text details
        datetime created_at
    }
    feedback_examples {
        uuid id PK
        string doc_type
        string field_name
        text wrong_value
        text correct_value
        text context_note
        datetime created_at
    }
```

## Tables (14)

| Table | Purpose | PK | Key FKs |
|---|---|---|---|
| `users` | Accounts + role | `id` (uuid) | — |
| `process_templates` | Bank-service config (required docs, rules) | `id` | — |
| `doc_type_templates` | Document-type config (expected fields) | `id` | — |
| `cases` | One verification case | `id` | `created_by`→users, `inferred_process_id`→process_templates |
| `uploads` | Raw uploaded files | `id` | `case_id`→cases |
| `documents` | Classified logical documents | `id` | `case_id`, `upload_id`, `doc_type_id` |
| `extracted_fields` | Field readings + evidence + round | `id` | `document_id`→documents |
| `discrepancies` | Issues raised by agents | `id` | `case_id`→cases |
| `agent_events` | AI audit trail (streamed) | `id` (serial) | `case_id`→cases |
| `scorecards` | Versioned correctness+completeness | `id` | `case_id`→cases |
| `review_actions` | Human decisions | `id` | `case_id`, `reviewer_id`, `discrepancy_id` |
| `case_runs` | Per-run audit + field diff | `id` | `case_id`→cases |
| `activity_logs` | Human audit trail | `id` (serial) | loose ids (no FK) |
| `feedback_examples` | Reviewer corrections as few-shots | `id` | loose (no FK) |

## Indexes

**Defined explicitly in the model:**

- `cases.ref_no` — `unique=True, index=True` (case lookup by reference).
- Unique constraints (each backed by a unique index): `users.email`, `process_templates.code`,
  `doc_type_templates.code`, `cases.ref_no`.
- Primary keys are indexed by PostgreSQL automatically.

**[INFERRED / recommended, NOT PRESENT]** For production query patterns observed in the code
(filtering by `case_id`, ordering `agent_events`/`scorecards` by id/version, activity by
`user_id`/`case_id`), consider adding:

```sql
CREATE INDEX ix_documents_case_id        ON documents(case_id);
CREATE INDEX ix_extracted_fields_doc_id  ON extracted_fields(document_id);
CREATE INDEX ix_discrepancies_case_id    ON discrepancies(case_id);
CREATE INDEX ix_agent_events_case_id_id  ON agent_events(case_id, id);
CREATE INDEX ix_scorecards_case_version  ON scorecards(case_id, version DESC);
CREATE INDEX ix_activity_user_created    ON activity_logs(user_id, created_at DESC);
CREATE INDEX ix_activity_case_created    ON activity_logs(case_id, created_at DESC);
```

These are not in the codebase today; add them via a migration when data volume grows.

## JSONB payload shapes

Documented from producer/consumer code (`services/scoring.py`, `seed.py`, agents):

```jsonc
// process_templates.required_docs
[ { "doc_type": "PAN", "mandatory": true }, { "doc_type": "PAYSLIP", "mandatory": false } ]

// doc_type_templates.expected_fields
[ { "name": "pan_number", "regex": "[A-Z]{5}[0-9]{4}[A-Z]", "required": true } ]

// scorecards.doc_scores            → { "<document_id>": 98.0 }
// scorecards.checklist             → [ { "code","name","mandatory","present" } ]
// discrepancies.detail             → { "field":"name", "values":[ {"doc":"PAN","value":"..."} ] }
// case_runs.prev_fields            → { "PAN.name": "RITADHWAJ RAY", ... }
// case_runs.field_diff             → { "added":[], "updated":[{field,old,new}], "deleted":[] }
// agent_events.payload             → { "message": "...", "to": "audit_agent", ... }
```

## Case status lifecycle

```mermaid
stateDiagram-v2
    [*] --> UPLOADED : create_case
    UPLOADED --> PROCESSING : run
    PROCESSING --> SCORED : agents converge
    SCORED --> IN_REVIEW : scorecard ready
    PROCESSING --> UPLOADED : pipeline error (reset)
    IN_REVIEW --> APPROVED : APPROVE_CASE
    IN_REVIEW --> REJECTED : REJECT_CASE
    IN_REVIEW --> RETURNED : REQUEST_REUPLOAD
    RETURNED --> PROCESSING : resubmit
    APPROVED --> PROCESSING : resubmit (re-open)
    REJECTED --> PROCESSING : resubmit (re-open)
```

> `SCORED` is a transient state inside `run_pipeline`; cases land in `IN_REVIEW` for humans.
> Values are strings (`Case.status`), not an enum type — the set is enumerated in the model
> comment.

## Seed data

`db/seed.py` (run on startup when `AUTO_SEED=true`, or `python -m app.db.seed`) upserts:

- **17 process templates** (Full/Partial KYC, savings account, personal/car/MSME/home loan,
  credit/debit card, cheque book, locker, FASTag, NACH/SI, passbook, dormant reactivation,
  mobile banking, tax filing), each with mandatory + optional document lists.
- **Document-type templates** with expected fields.
- **3 demo users** — `uploader@cleardesk.dev`, `reviewer@cleardesk.dev`, `admin@cleardesk.dev`
  (password `demo1234`, bcrypt-hashed).

Templates are re-applied (refreshed) on each seed; users are created only if absent.
