from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Body, Depends
from pydantic import BaseModel, Field

from core import db
from core.errors import not_found
from core.db import oid, serialize
from core.security import get_current_user
from services import llm, outreach

router = APIRouter(prefix="/meetings", tags=["meetings"])


class MeetingIn(BaseModel):
    conversation_id: str
    title: str = Field(min_length=1, max_length=200)
    date: datetime
    duration: int = Field(default=30, ge=5, le=480)
    meeting_link: Optional[str] = ""
    notes: Optional[str] = ""


class MeetingPatch(BaseModel):
    title: Optional[str] = None
    date: Optional[datetime] = None
    duration: Optional[int] = None
    meeting_link: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[Literal["scheduled", "completed", "cancelled"]] = None


def _naive_utc(d: datetime) -> datetime:
    """Mongo stores naive UTC; convert aware datetimes from the client."""
    return (d - d.utcoffset()).replace(tzinfo=None) if d.tzinfo else d


async def _owned(meeting_id: str, user: dict) -> dict:
    m = await db.meetings.find_one({"_id": oid(meeting_id), "user_email": user["email"]})
    if not m:
        raise not_found("Meeting")
    return m


@router.get("")
async def list_meetings(user: dict = Depends(get_current_user)):
    return serialize([m async for m in db.meetings.find({"user_email": user["email"]}).sort("date", 1)])


@router.post("")
async def create_meeting(payload: MeetingIn = Body(...), user: dict = Depends(get_current_user)):
    conv = await db.conversations.find_one({"_id": oid(payload.conversation_id), "user_email": user["email"]})
    if not conv:
        raise not_found("Conversation")
    doc = {
        "user_email": user["email"],
        "conversation_id": conv["_id"],
        "lead_id": conv["lead_id"],
        "lead_name": conv.get("lead_name"),
        "lead_company": conv.get("lead_company"),
        "title": payload.title,
        "date": _naive_utc(payload.date),
        "duration": payload.duration,
        "meeting_link": payload.meeting_link or "",
        "notes": payload.notes or "",
        "status": "scheduled",
        "ai_summary": "",
        "follow_up_sent": False,
        "created_at": datetime.utcnow(),
    }
    res = await db.meetings.insert_one(doc)
    doc["_id"] = res.inserted_id
    await db.conversations.update_one({"_id": conv["_id"]}, {"$set": {"stage": "meeting_scheduled"}})
    return serialize(doc)


@router.patch("/{meeting_id}")
async def update_meeting(meeting_id: str, payload: MeetingPatch = Body(...), user: dict = Depends(get_current_user)):
    m = await _owned(meeting_id, user)
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "date" in update:
        update["date"] = _naive_utc(update["date"])
    if update:
        await db.meetings.update_one({"_id": m["_id"]}, {"$set": update})
    return serialize(await db.meetings.find_one({"_id": m["_id"]}))


@router.post("/{meeting_id}/summary")
async def summarize(meeting_id: str, user: dict = Depends(get_current_user)):
    m = await _owned(meeting_id, user)
    msgs = await outreach.conversation_messages(m["conversation_id"]) if m.get("conversation_id") else []
    history = "\n".join(f"{x['sender']}: {x['content']}" for x in msgs[-10:])
    text = await llm.complete(
        [
            {"role": "system", "content": "Summarise a B2B trade meeting in 3-4 plain sentences: needs discussed, "
             "commitments, open questions, next step. Use only the notes and conversation provided."},
            {"role": "user", "content": f"Meeting: {m['title']} with {m.get('lead_company')}\n"
             f"Notes:\n{m.get('notes') or '(no notes)'}\n\nPrior conversation:\n{history or '(none)'}"},
        ],
        max_tokens=300,
    )
    summary = text or (m.get("notes") or "Add meeting notes to generate a summary.")
    await db.meetings.update_one({"_id": m["_id"]}, {"$set": {"ai_summary": summary}})
    return serialize(await db.meetings.find_one({"_id": m["_id"]}))


@router.post("/{meeting_id}/follow-up")
async def follow_up(meeting_id: str, user: dict = Depends(get_current_user)):
    """Draft a post-meeting follow-up into the lead's conversation."""
    m = await _owned(meeting_id, user)
    conv = await db.conversations.find_one({"_id": m["conversation_id"]})
    if not conv:
        raise not_found("Conversation")
    msgs = await outreach.conversation_messages(conv["_id"])
    text = await outreach.reply_message(
        user, conv, msgs,
        f"We just had the meeting '{m['title']}'. Summary: {m.get('ai_summary') or m.get('notes') or 'n/a'}. "
        "Write a thank-you follow-up confirming next steps.",
    )
    await outreach.add_message(conv["_id"], "ai", text, "draft", conv["channel"])
    await db.meetings.update_one({"_id": m["_id"]}, {"$set": {"follow_up_sent": True}})
    return serialize(await db.meetings.find_one({"_id": m["_id"]}))
