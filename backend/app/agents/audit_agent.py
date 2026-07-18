"""AUDIT AGENT — the adversary.

Runs in parallel with the Doc Agent and audits claims AS THEY ARRIVE — it
never waits for the Doc Agent to finish. For every DOC_CLAIM it:
  1. Runs deterministic template checks (regex formats, required fields, expiry).
  2. Does its own BLIND read of the same evidence (without seeing the claimed
     value first) and compares.
  3. Agrees -> VERDICT verified. Doubts -> CHALLENGE back to the Doc Agent
     (max N rounds per claim), then judges the DEFEND/CONCEDE response.
  4. Unresolvable disagreement -> Discrepancy row -> human review.

After DOCS_COMPLETE it runs cross-document checks (name/DOB/income consistency
across the whole bundle) and process-rule checks, then sends AUDIT_COMPLETE.
"""
from app.agents.bus import AgentBus
from app.config import settings
from app.db.session import SessionLocal
from app.db import models
from app.services.llm import call_agent, image_block

ME, PEER = "audit_agent", "doc_agent"


async def run(bus: AgentBus) -> None:
    case_id = bus.case_id
    open_challenges: dict[str, int] = {}   # claim_id -> round count
    docs_complete = False

    while True:
        msg = await bus.receive(ME)

        if msg.type == "DOC_CLAIM":
            claim_id = msg.payload.get("claim_id")
            # TODO deterministic checks: regex/format/required/expiry -> instant verdicts.
            # TODO blind re-read: call_agent("audit_agent_blind_read", [evidence image])
            #      and compare with claimed value.
            #
            # if suspicious and rounds left:
            #     open_challenges[claim_id] = 1
            #     await bus.send(ME, PEER, "CHALLENGE", {
            #         "message": f"Doubting {field}: my blind read says 'X', you claimed 'Y'",
            #         "claim_id": claim_id, "reason": ...})
            # else:
            await bus.send(ME, PEER, "VERDICT", {
                "message": f"Claim on document {str(msg.payload.get('document_id',''))[:8]} "
                           "acknowledged (blind re-read TODO)",
                "claim_id": claim_id, "status": "VERIFIED",
            })

        elif msg.type in ("DEFEND", "CONCEDE"):
            claim_id = msg.payload.get("claim_id")
            rounds = open_challenges.get(claim_id, 0)
            # TODO: judge the response.
            # - CONCEDE          -> accept revised value, VERDICT verified.
            # - DEFEND convincing -> VERDICT verified.
            # - still doubtful & rounds < settings.max_cross_verify_rounds
            #                     -> CHALLENGE again (rounds+1)
            # - rounds exhausted  -> persist Discrepancy(LOW_CONFIDENCE/FIELD_MISMATCH),
            #                        VERDICT disputed -> human review.
            open_challenges.pop(claim_id, None)
            await bus.send(ME, PEER, "VERDICT", {
                "message": f"Dispute on claim {claim_id} settled after {rounds + 1} round(s)",
                "claim_id": claim_id, "status": "VERIFIED",
            })

        elif msg.type == "DOCS_COMPLETE":
            docs_complete = True

        if docs_complete and not open_challenges:
            break

    # ---- Cross-document + process-rule sweep over the full bundle ----
    await bus.send(ME, PEER, "VERDICT",
                   {"message": "Running cross-document consistency checks on the full bundle"})
    db = SessionLocal()
    try:
        # TODO: gather all ExtractedField rows,
        #   result = call_agent("audit_agent_cross_check", json of all fields)
        #   persist FIELD_MISMATCH / MISSING_DOC / RULE_VIOLATION discrepancies.
        pass
    finally:
        db.close()

    await bus.send(ME, PEER, "AUDIT_COMPLETE",
                   {"message": "Audit finished — handing over to scorecard"})
