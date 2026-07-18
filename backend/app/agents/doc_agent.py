"""DOC AGENT — the documenter.

Runs in parallel with the Audit Agent. Its job:
  1. Intake raw uploads, classify each document, infer the business process.
  2. Extract every template field WITH evidence, and immediately publish each
     one as a DOC_CLAIM on the bus — it does not wait to finish everything.
  3. Keep listening for CHALLENGEs while still working: when challenged it
     re-reads the exact field character by character and DEFENDs or CONCEDEs.
  4. Exit when the Audit Agent sends AUDIT_COMPLETE.
"""
import asyncio

from app.agents.bus import AgentBus, Message
from app.db.session import SessionLocal
from app.db import models
from app.services.llm import call_agent, image_block

ME, PEER = "doc_agent", "audit_agent"


async def run(bus: AgentBus) -> None:
    case_id = bus.case_id

    # ---- Phase 1: intake + classify + publish claims (peer audits in parallel) ----
    db = SessionLocal()
    try:
        uploads = db.query(models.Upload).filter(models.Upload.case_id == case_id).all()
        for up in uploads:
            doc = models.Document(case_id=case_id, upload_id=up.id, status="UNIDENTIFIED")
            db.add(doc)
            db.flush()
            db.commit()

            # TODO: pages = render_pages_to_images(up.file_path)
            # TODO: cls = call_agent("doc_agent_classify", [image_block(p) for p in pages])
            #       doc.doc_type, doc.classify_confidence = ...
            # TODO: fields = call_agent("doc_agent_extract", pages + template + few_shots)
            #       persist ExtractedField rows, then per field:
            #
            # await bus.send(ME, PEER, "DOC_CLAIM", {
            #     "message": f"Read {field.name} = '{field.value}' ({field.confidence}%) from {doc_type}",
            #     "claim_id": str(field.id), "document_id": str(doc.id),
            #     "field": field.name, "value": field.value,
            #     "confidence": field.confidence, "evidence": field.evidence_crop_path,
            # })
            await bus.send(ME, PEER, "DOC_CLAIM", {
                "message": f"Documented upload '{up.file_path.split('/')[-1]}' (extraction TODO)",
                "document_id": str(doc.id),
            })
            # Drain any challenges that arrived while we were extracting.
            while (msg := bus.try_receive(ME)) is not None:
                await _handle(bus, msg)
    finally:
        db.close()

    await bus.send(ME, PEER, "DOCS_COMPLETE",
                   {"message": "All documents classified and extracted — over to you"})

    # ---- Phase 2: stay alive answering challenges until the audit is done ----
    while True:
        msg = await bus.receive(ME)
        if msg.type == "AUDIT_COMPLETE":
            break
        await _handle(bus, msg)


async def _handle(bus: AgentBus, msg: Message) -> None:
    """Respond to a single message from the Audit Agent."""
    if msg.type == "CHALLENGE":
        claim_id = msg.payload.get("claim_id")
        # TODO: re-read the disputed field with the challenge as context:
        #   result = call_agent("doc_agent_reread", [evidence image + challenge reason])
        #   if result confirms original -> DEFEND with reasoning
        #   if result revises          -> CONCEDE with new value, bump extraction_round
        await bus.send(ME, PEER, "DEFEND", {
            "message": f"Re-read claim {claim_id}: (re-extraction TODO — confirming original)",
            "claim_id": claim_id,
            "confirmed": True,
        })
    elif msg.type == "VERDICT":
        pass  # informational; audit agent already persisted the outcome
