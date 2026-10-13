import calendar
import copy
import time
from collections import OrderedDict
from datetime import datetime
from typing import Dict, Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Body, Depends
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from core import db
from core.errors import bad_request, not_found
from core.config import settings
from core.security import get_current_user
from services import leads as lead_service
from services import llm, news, outreach, ranking
from scraper import pipeline as scrape_pipeline

router = APIRouter(tags=["leads"])

# Per-user caches so re-ranking after every swipe is cheap.
_POOL_TTL = 300
_pool: Dict[str, tuple] = {}      # email -> (expires, [normalized leads], built_at)
_semantic: Dict[str, tuple] = {}  # email -> (expires, {lead_id: score})
_insights: "OrderedDict[str, str]" = OrderedDict()  # f"{email}:{lead_id}" -> text (LRU)
_INSIGHTS_MAX = 5000


def invalidate_user(email: str) -> None:
    _pool.pop(email, None)
    _semantic.pop(email, None)


def _sourcing_view(job: Optional[dict], demo: bool) -> dict:
    if demo:
        return {"mode": "demo", "status": "done"}
    job = job or {}
    return {
        "mode": "live",
        "status": job.get("status", "queued"),
        "stage": job.get("stage", "queued"),
        "found": job.get("found", 0),
        "enriched": job.get("enriched", 0),
        "updated_at": job["updated_at"].isoformat() + "Z" if job.get("updated_at") else None,
        "error": job.get("error"),
    }


async def _ranked(user: dict) -> dict:
    email = user["email"]
    now = time.time()
    demo = lead_service.is_demo(user)
    job = None if demo else await scrape_pipeline.ensure_fresh(user.get("industry", ""))
    # Mongo datetimes are naive UTC.
    job_ts = calendar.timegm(job["updated_at"].utctimetuple()) if job and job.get("updated_at") else 0

    pool = _pool.get(email)
    # Rebuild when expired, or when the scraper has stored new companies since.
    if not pool or pool[0] < now or (job_ts and job_ts > pool[2] and job.get("status") != "queued"):
        leads = await lead_service.candidates(user, lead_service.candidate_pool_size())
        sourcing_active = job and job.get("status") in ("queued", "running", "enriching")
        pool = (now + (15 if sourcing_active else _POOL_TTL), leads, now)
        _pool[email] = pool
    articles = await news.get_news(user.get("industry", ""))

    sem = _semantic.get(email)
    if not sem or sem[0] < now:
        try:
            scores = await ranking.semantic_scores(pool[1], articles, user)
        except Exception:
            scores = {}
        sem = (now + settings.NEWS_CACHE_SECONDS, scores)
        _semantic[email] = sem

    leads = copy.deepcopy(pool[1])
    feedback = await ranking.load_feedback(email)
    # Off the event loop: the random forest may (re)train here.
    ranked, engine = await run_in_threadpool(ranking.rank_leads, leads, articles, user, sem[1], feedback)
    return {
        "leads": ranked[: settings.LEADS_MAX],
        "total_candidates": len(ranked),
        "news_used": len([a for a in articles if a.get("countries")]),
        "learned_from_swipes": feedback.total,
        "engine": engine,
        "reject_reasons": [{"key": k, "label": v} for k, v in ranking.REJECT_REASONS.items()],
        "sourcing": _sourcing_view(job, demo),
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }


@router.get("/trade-news")
async def trade_news(industry: str = ""):
    return await news.get_news(industry)


@router.get("/leads")
async def get_leads(user: dict = Depends(get_current_user)):
    return await _ranked(user)


class DecisionSchema(BaseModel):
    decision: Literal["approved", "rejected", "skipped"]
    lead: Optional[dict] = None  # ranked snapshot from the client (scores, news reasons)


@router.post("/leads/{lead_id}/decision")
async def decide(
    lead_id: str,
    background: BackgroundTasks,
    payload: DecisionSchema = Body(...),
    user: dict = Depends(get_current_user),
):
    lead = await lead_service.get_lead(user, lead_id)
    if not lead:
        raise not_found("Lead")
    # Keep the ranking context the user saw when they swiped (used for outreach).
    if payload.lead:
        for key in ("match_percentage", "dynamic_score", "news_score", "news_reasons", "ai_reasoning"):
            if key in payload.lead:
                lead[key] = payload.lead[key]

    now = datetime.utcnow()
    record = {"status": payload.decision, "approved_at": now, "lead_data": lead, "reason": None, "reason_source": ""}
    if payload.decision == "rejected":
        # Best guess until the user tells us (POST /leads/{id}/feedback).
        feedback = await ranking.load_feedback(user["email"])
        pool = _pool.get(user["email"])
        record["reason"] = ranking.infer_reason(lead, feedback, pool[1] if pool else [])
        record["reason_source"] = "inferred"
    await db.decisions.update_one(
        {"user_email": user["email"], "lead_id": lead_id}, {"$set": record}, upsert=True
    )

    # Update the cached pool in place instead of recomputing it.
    pool = _pool.get(user["email"])
    if pool:
        if payload.decision == "skipped":
            for l in pool[1]:
                if l["id"] == lead_id:
                    l["skipped"] = True
        else:
            pool[1][:] = [l for l in pool[1] if l["id"] != lead_id]

    conversation_id = None
    if payload.decision == "approved":
        conv = await outreach.start_conversation(user, lead)
        conversation_id = str(conv["_id"])
        if conv.get("stage") == "drafting":
            background.add_task(outreach.draft_opening, user, lead, conv["_id"])
    return {
        "status": payload.decision,
        "conversation_id": conversation_id,
        "inferred_reason": record["reason"],
    }


class FeedbackSchema(BaseModel):
    reason: str


@router.post("/leads/{lead_id}/feedback")
async def rejection_feedback(lead_id: str, payload: FeedbackSchema = Body(...), user: dict = Depends(get_current_user)):
    """The user's own reason for a rejection; outranks the inferred one."""
    if payload.reason not in ranking.REJECT_REASONS:
        raise bad_request("UNKNOWN_REASON", "That rejection reason isn't recognised.")
    res = await db.decisions.update_one(
        {"user_email": user["email"], "lead_id": lead_id, "status": "rejected"},
        {"$set": {"reason": payload.reason, "reason_source": "user"}},
    )
    if not res.matched_count:
        raise not_found("Rejection", "NO_REJECTION")
    return {"status": "ok", "reason": payload.reason}


@router.delete("/leads/{lead_id}/decision")
async def undo_decision(lead_id: str, user: dict = Depends(get_current_user)):
    await db.decisions.delete_one({"user_email": user["email"], "lead_id": lead_id})
    conv = await db.conversations.find_one({"user_email": user["email"], "lead_id": lead_id})
    if conv and not await db.messages.find_one({"conversation_id": conv["_id"], "sender": "lead"}):
        await db.messages.delete_many({"conversation_id": conv["_id"]})
        await db.conversations.delete_one({"_id": conv["_id"]})
    invalidate_user(user["email"])
    ranking.forget_model(user["email"])
    return {"status": "undone"}


# Backward-compatible alias of the old endpoint.
@router.post("/leads/{lead_id}/approve")
async def approve_lead(lead_id: str, background: BackgroundTasks, user: dict = Depends(get_current_user)):
    return await decide(lead_id, background, DecisionSchema(decision="approved"), user)


@router.get("/approved-leads")
async def approved_leads(user: dict = Depends(get_current_user)):
    convs = {
        c["lead_id"]: c
        async for c in db.conversations.find({"user_email": user["email"]}, {"lead_id": 1, "stage": 1, "channel": 1})
    }
    out = []
    cursor = db.decisions.find({"user_email": user["email"], "status": "approved"}).sort("approved_at", -1)
    async for d in cursor:
        lead = d.get("lead_data") or {}
        if "company_name" not in lead:  # legacy raw document
            lead = lead_service.normalize({**lead, "_id": d["lead_id"]})
        conv = convs.get(d["lead_id"])
        out.append({
            **lead,
            "id": d["lead_id"],
            "approved_at": d.get("approved_at").isoformat() + "Z" if d.get("approved_at") else None,
            "conversation_id": str(conv["_id"]) if conv else None,
            "outreach_stage": conv.get("stage") if conv else None,
            "outreach_channel": conv.get("channel") if conv else None,
        })
    return out


@router.get("/leads/{lead_id}/insight")
async def lead_insight(lead_id: str, user: dict = Depends(get_current_user)):
    key = f"{user['email']}:{lead_id}"
    if key in _insights:
        _insights.move_to_end(key)
        return {"insight": _insights[key]}
    data = await _ranked(user)
    lead = next((l for l in data["leads"] if l["id"] == lead_id), None) or await lead_service.get_lead(user, lead_id)
    if not lead:
        raise not_found("Lead")
    news_lines = "\n".join(f"- {r['headline']} ({r['why']})" for r in lead.get("news_reasons", [])) or "- none"
    text = await llm.complete(
        [
            {
                "role": "system",
                "content": "You are a trade intelligence analyst. In 2-3 plain sentences (no markdown), explain "
                "why this prospect is or isn't a good fit right now and the best angle for outreach. Use only given facts.",
            },
            {
                "role": "user",
                "content": f"Seller: {user.get('category')} in {user.get('industry')} ({user.get('country') or 'n/a'}). "
                f"{user.get('description') or ''}\nProspect: {lead['company_name']}, {lead['country']}, "
                f"intent {lead['intent_score']}, response probability {lead['response_probability']}, "
                f"channel {lead['preferred_channel']}, signals: {', '.join(lead['signals']) or 'none'}.\n"
                f"Live news affecting them:\n{news_lines}",
            },
        ],
        max_tokens=220,
    )
    insight = text or lead.get("ai_reasoning") or ""
    if text:
        _insights[key] = text
        if len(_insights) > _INSIGHTS_MAX:
            _insights.popitem(last=False)  # evict least recently used
    return {"insight": insight}
