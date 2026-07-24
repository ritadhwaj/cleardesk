# Class & Type Relationship Diagrams

UML views of the important packages. Note: the backend uses SQLAlchemy ORM classes plus
**module-level async functions** (the agents and services are functional, not OO). Diagrams
reflect that reality rather than inventing class hierarchies.

## Contents

1. [ORM domain model](#1-orm-domain-model)
2. [Agent subsystem (functional + AgentBus)](#2-agent-subsystem)
3. [LLM provider layer](#3-llm-provider-layer)
4. [Frontend state & API types](#4-frontend-state--api-types)

---

## 1. ORM domain model

SQLAlchemy classes from `backend/app/db/models.py`. See [Database.md](../database/Database.md)
for full column detail; this view emphasises relationships and multiplicity.

```mermaid
classDiagram
    class User {
        +UUID id
        +str email
        +str password_hash
        +str full_name
        +str role
        +datetime created_at
    }
    class ProcessTemplate {
        +UUID id
        +str code
        +str name
        +JSONB required_docs
        +JSONB rules
        +Text description
    }
    class DocTypeTemplate {
        +UUID id
        +str code
        +str display_name
        +JSONB expected_fields
        +JSONB validity_rules
    }
    class Case {
        +UUID id
        +str ref_no
        +str name
        +str status
        +Numeric inference_confidence
        +datetime created_at
        +datetime updated_at
    }
    class Upload {
        +UUID id
        +str file_path
        +str mime_type
        +int page_count
    }
    class Document {
        +UUID id
        +int page_start
        +int page_end
        +Numeric classify_confidence
        +str status
    }
    class ExtractedField {
        +UUID id
        +str field_name
        +Text value_raw
        +Text value_normalized
        +Numeric confidence
        +str evidence_crop_path
        +int extraction_round
    }
    class Discrepancy {
        +UUID id
        +str kind
        +str severity
        +str title
        +JSONB detail
        +str raised_by
        +str resolution
    }
    class Scorecard {
        +UUID id
        +int version
        +Numeric overall_score
        +JSONB doc_scores
        +Numeric completeness_score
        +JSONB checklist
    }
    class ReviewAction {
        +UUID id
        +str action
        +Text corrected_value
        +Text note
    }
    class CaseRun {
        +UUID id
        +int run_no
        +str trigger
        +JSONB prev_fields
        +JSONB field_diff
    }
    class AgentEvent {
        +int id
        +str agent
        +str event_type
        +JSONB payload
    }
    class ActivityLog {
        +int id
        +str category
        +str action
        +Text details
    }
    class FeedbackExample {
        +UUID id
        +str doc_type
        +str field_name
        +Text wrong_value
        +Text correct_value
    }

    User "1" --> "0..*" Case : creates
    ProcessTemplate "1" --> "0..*" Case : inferred/selected
    Case "1" --> "0..*" Upload
    Case "1" --> "0..*" Document
    Upload "1" --> "0..*" Document
    DocTypeTemplate "1" --> "0..*" Document : classified as
    Document "1" --> "0..*" ExtractedField
    Case "1" --> "0..*" Discrepancy
    Case "1" --> "0..*" Scorecard
    Case "1" --> "0..*" ReviewAction
    Case "1" --> "0..*" CaseRun
    Case "1" --> "0..*" AgentEvent
    User "1" --> "0..*" ReviewAction : reviewer
    Discrepancy "0..1" --> "0..*" ReviewAction
```

> `ActivityLog` and `FeedbackExample` reference cases/users by loose id/name (no FK) by design —
> they are append-only audit/learning stores decoupled from cascade behaviour.

---

## 2. Agent subsystem

`AgentBus`/`Message` are dataclasses; agents are modules exposing an async `run(bus)`.

```mermaid
classDiagram
    class AgentBus {
        +str case_id
        +dict~str,Queue~ inboxes
        +send(sender, recipient, msg_type, payload) async
        +receive(agent) Message async
        +try_receive(agent) Message?
    }
    class Message {
        +str sender
        +str type
        +dict payload
    }
    class doc_agent {
        <<module>>
        +run(bus) async
        -_process_upload(...) async
        -_infer_process(...)
        -_handle(msg) async
    }
    class audit_agent {
        <<module>>
        +run(bus) async
    }
    class orchestrator {
        <<module>>
        +run_pipeline(case_id, run_id) async
        -_write_summary(...) async
        -_finalize_run(...)
        -_name_case(...)
    }
    AgentBus "1" o-- "0..*" Message : delivers
    orchestrator ..> AgentBus : creates
    orchestrator ..> doc_agent : gather
    orchestrator ..> audit_agent : gather
    doc_agent ..> AgentBus : send/receive
    audit_agent ..> AgentBus : send/receive
```

---

## 3. LLM provider layer

`services/llm.py` — one public entry (`call_agent`) dispatching to private provider functions.

```mermaid
classDiagram
    class llm {
        <<module>>
        +call_agent(agent_name, content, max_tokens) dict
        +load_prompt(name) str
        +image_block(path) dict
        -_mock(agent_name) dict
        -_gemini(...) str
        -_ollama(...) str
        -_anthropic(...) str
        -_throttle()
        -_cache_get(key) / _cache_put(key,val)
        -_discover_models(headers) list
    }
    class Settings {
        +str llm_provider
        +str gemini_model
        +str gemini_fallback_models
        +bool llm_cache
        +float llm_min_interval_s
    }
    llm ..> Settings : reads
    llm ..> "prompts/*.txt" : load_prompt
    note for llm "Quota savers: image downscale (image_block),\nJSON response cache, model fallback chain"
```

---

## 4. Frontend state & API types

zustand stores + the typed axios client (`frontend/src/store/*`, `api/client.ts`).

```mermaid
classDiagram
    class useAuth {
        <<zustand store>>
        +string? token
        +string role
        +string fullName
        +login(token, role, name)
        +logout()
    }
    class useTheme {
        <<zustand store>>
        +"light"|"dark" mode
        +toggle()
    }
    class useTimezone {
        <<zustand store>>
        +TZOption tz
        +setTz(tz)
    }
    class apiClient {
        <<module>>
        +api: AxiosInstance (baseURL /api, Bearer)
        +createCase(process)
        +getTemplates()
        +getEvents(caseId)
        +fmtDateTime(iso)
    }
    class useCaseSocket {
        <<hook>>
        +events: AgentEvent[]
        +connected: bool
    }
    apiClient ..> useAuth : reads token
    useCaseSocket ..> apiClient : getEvents + WS
```
