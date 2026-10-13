from collections import Counter, defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends

from core import db
from core.security import get_current_user

router = APIRouter(tags=["analytics"])

WEEKS = 6


def _week_index(d: datetime, start: datetime) -> int:
    return (d - start).days // 7


@router.get("/analytics")
async def analytics(user: dict = Depends(get_current_user)):
    email = user["email"]
    now = datetime.utcnow()
    start = (now - timedelta(weeks=WEEKS - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    start -= timedelta(days=start.weekday())

    weekly = [{"week": (start + timedelta(weeks=i)).strftime("%d %b"), "approved": 0, "rejected": 0,
               "conversations": 0, "meetings": 0} for i in range(WEEKS)]

    # --- Swipe decisions ---
    decision_counts = Counter()
    approved_by_country = Counter()
    async for d in db.decisions.find({"user_email": email}, {"status": 1, "approved_at": 1, "lead_data": 1}):
        status = d.get("status", "approved")
        decision_counts[status] += 1
        at = d.get("approved_at")
        if at and at >= start and status in ("approved", "rejected"):
            idx = _week_index(at, start)
            if 0 <= idx < WEEKS:
                weekly[idx][status] += 1
        if status == "approved":
            lead = d.get("lead_data") or {}
            approved_by_country[lead.get("country") or lead.get("Country") or "Unknown"] += 1

    # --- Conversations + replies ---
    convs = [c async for c in db.conversations.find(
        {"user_email": email}, {"channel": 1, "country": 1, "created_at": 1, "stage": 1})]
    conv_ids = [c["_id"] for c in convs]
    replied = set()
    if conv_ids:
        replied = set(await db.messages.distinct("conversation_id", {"conversation_id": {"$in": conv_ids}, "sender": "lead"}))
    sent = set()
    if conv_ids:
        sent = set(await db.messages.distinct(
            "conversation_id",
            {"conversation_id": {"$in": conv_ids}, "sender": {"$in": ["user", "ai"]}, "status": {"$ne": "draft"}},
        ))

    # --- Meetings ---
    meetings = [m async for m in db.meetings.find({"user_email": email}, {"status": 1, "conversation_id": 1, "created_at": 1})]
    meeting_convs = {m.get("conversation_id") for m in meetings if m.get("status") != "cancelled"}

    channels = defaultdict(lambda: {"contacted": 0, "responded": 0, "meetings": 0})
    country_replies = Counter()
    for c in convs:
        ch = channels[c.get("channel", "email")]
        if c["_id"] in sent:
            ch["contacted"] += 1
        if c["_id"] in replied:
            ch["responded"] += 1
            country_replies[c.get("country") or "Unknown"] += 1
        if c["_id"] in meeting_convs:
            ch["meetings"] += 1
        at = c.get("created_at")
        if at and at >= start:
            idx = _week_index(at, start)
            if 0 <= idx < WEEKS:
                weekly[idx]["conversations"] += 1
    for m in meetings:
        at = m.get("created_at")
        if at and at >= start:
            idx = _week_index(at, start)
            if 0 <= idx < WEEKS:
                weekly[idx]["meetings"] += 1

    approved = decision_counts["approved"]
    rejected = decision_counts["rejected"]
    contacted = len(sent)
    completed = sum(1 for m in meetings if m.get("status") == "completed")
    scheduled = sum(1 for m in meetings if m.get("status") == "scheduled")

    segments = sorted(
        (
            {"segment": country, "approved": n, "replies": country_replies.get(country, 0),
             "reply_rate": round(100 * country_replies.get(country, 0) / n) if n else 0}
            for country, n in approved_by_country.items()
        ),
        key=lambda s: (s["approved"], s["replies"]),
        reverse=True,
    )[:6]

    return {
        "decisions": {"approved": approved, "rejected": rejected, "skipped": decision_counts["skipped"]},
        "approval_rate": round(100 * approved / (approved + rejected)) if approved + rejected else 0,
        "conversations": len(convs),
        "contacted": contacted,
        "responded": len(replied),
        "response_rate": round(100 * len(replied) / contacted) if contacted else 0,
        "meetings": {"scheduled": scheduled, "completed": completed, "total": len(meetings)},
        "meeting_conversion": round(100 * len(meeting_convs) / len(convs)) if convs else 0,
        "funnel": [
            {"stage": "Approved", "count": approved},
            {"stage": "Contacted", "count": contacted},
            {"stage": "Replied", "count": len(replied)},
            {"stage": "Meetings", "count": len(meetings)},
            {"stage": "Completed", "count": completed},
        ],
        "channels": [{"channel": k.capitalize() if k != "linkedin" else "LinkedIn", **v} for k, v in channels.items()],
        "weekly": weekly,
        "segments": segments,
    }
