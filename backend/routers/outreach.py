from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Body, Depends
from pydantic import BaseModel, Field

from core import db
from core.errors import not_found
from core.db import oid, serialize
from core.security import get_current_user
from services import outreach

router = APIRouter(prefix="/conversations", tags=["outreach"])

_STAGE_ORDER = {
    "drafting": 0, "draft_failed": 0, "draft_ready": 1, "contacted": 2, "engaged": 3,
    "meeting_requested": 4, "meeting_scheduled": 5, "negotiating": 6, "won": 7, "lost": 7,
}


async def _owned(conv_id: str, user: dict) -> dict:
    conv = await db.conversations.find_one({"_id": oid(conv_id), "user_email": user["email"]})
    if not conv:
        raise not_found("Conversation")
    return conv


async def _refresh_analysis(conv_id) -> None:
    conv = await db.conversations.find_one({"_id": conv_id})
    if not conv:
        return
    msgs = await outreach.conversation_messages(conv_id)
    analysis = await outreach.analyze(conv, msgs)
    update = {"analysis": analysis}
    # Pipeline stages only move forward (e.g. never undo "meeting_scheduled"), except won/lost.
    new, old = analysis["stage"], conv.get("stage", "")
    if new in ("won", "lost") or _STAGE_ORDER.get(new, 0) > _STAGE_ORDER.get(old, 0):
        update["stage"] = new
    await db.conversations.update_one({"_id": conv_id}, {"$set": update})


@router.get("")
async def list_conversations(user: dict = Depends(get_current_user)):
    cursor = db.conversations.find({"user_email": user["email"]}).sort("updated_at", -1)
    return serialize([c async for c in cursor])


@router.get("/{conv_id}")
async def get_conversation(conv_id: str, user: dict = Depends(get_current_user)):
    conv = await _owned(conv_id, user)
    if conv.get("unread"):
        await db.conversations.update_one({"_id": conv["_id"]}, {"$set": {"unread": 0}})
        conv["unread"] = 0
    msgs = await outreach.conversation_messages(conv["_id"])
    return {"conversation": serialize(conv), "messages": serialize(msgs), "can_deliver": outreach.can_deliver(conv)}


class MessageIn(BaseModel):
    content: str = Field(min_length=1, max_length=5000)
    # "user": we send it. "lead": logging a reply the prospect sent us.
    sender: Literal["user", "lead"] = "user"


@router.post("/{conv_id}/messages")
async def post_message(
    conv_id: str,
    background: BackgroundTasks,
    payload: MessageIn = Body(...),
    user: dict = Depends(get_current_user),
):
    conv = await _owned(conv_id, user)
    created = []
    if payload.sender == "user":
        msg = await outreach.add_message(conv["_id"], "user", payload.content.strip(), "draft", conv["channel"])
        msg["status"] = await outreach.deliver(conv, msg, user)
        await db.messages.update_one({"_id": msg["_id"]}, {"$set": {"status": msg["status"]}})
        created.append(msg)
    else:
        msg = await outreach.add_message(conv["_id"], "lead", payload.content.strip(), "received", conv["channel"])
        await db.conversations.update_one({"_id": conv["_id"]}, {"$set": {"unread": 0}})
        created.append(msg)
        if conv.get("ai_handling"):
            history = await outreach.conversation_messages(conv["_id"])
            text = await outreach.reply_message(user, conv, history)
            ai_msg = await outreach.add_message(conv["_id"], "ai", text, "draft", conv["channel"])
            ai_msg["status"] = await outreach.deliver(conv, ai_msg, user)
            await db.messages.update_one({"_id": ai_msg["_id"]}, {"$set": {"status": ai_msg["status"]}})
            created.append(ai_msg)
    background.add_task(_refresh_analysis, conv["_id"])
    return serialize(created)


class ApproveIn(BaseModel):
    content: Optional[str] = None


@router.post("/{conv_id}/messages/{msg_id}/approve")
async def approve_draft(
    conv_id: str, msg_id: str, payload: ApproveIn = Body(default=ApproveIn()), user: dict = Depends(get_current_user)
):
    conv = await _owned(conv_id, user)
    msg = await db.messages.find_one({"_id": oid(msg_id), "conversation_id": conv["_id"]})
    if not msg:
        raise not_found("Message")
    if payload.content:
        msg["content"] = payload.content.strip()
    msg["status"] = await outreach.deliver(conv, msg, user)
    await db.messages.update_one({"_id": msg["_id"]}, {"$set": {"content": msg["content"], "status": msg["status"]}})
    await db.conversations.update_one(
        {"_id": conv["_id"]},
        {"$set": {"last_message": msg["content"][:200], "updated_at": datetime.utcnow(),
                  **({"stage": "contacted"} if conv.get("stage") in ("drafting", "draft_ready") else {})}},
    )
    return serialize(msg)


@router.delete("/{conv_id}/messages/{msg_id}")
async def discard_draft(conv_id: str, msg_id: str, user: dict = Depends(get_current_user)):
    conv = await _owned(conv_id, user)
    await db.messages.delete_one({"_id": oid(msg_id), "conversation_id": conv["_id"], "status": "draft"})
    return {"status": "deleted"}


class SuggestIn(BaseModel):
    instruction: Optional[str] = ""


@router.post("/{conv_id}/suggest")
async def suggest_reply(conv_id: str, payload: SuggestIn = Body(default=SuggestIn()), user: dict = Depends(get_current_user)):
    conv = await _owned(conv_id, user)
    msgs = await outreach.conversation_messages(conv["_id"])
    return {"content": await outreach.reply_message(user, conv, msgs, payload.instruction or "")}


@router.post("/{conv_id}/follow-up")
async def follow_up(conv_id: str, user: dict = Depends(get_current_user)):
    """AI drafts a follow-up and saves it as a draft for review."""
    conv = await _owned(conv_id, user)
    msgs = await outreach.conversation_messages(conv["_id"])
    text = await outreach.reply_message(
        user, conv, msgs, "The prospect has not replied yet. Write a brief, polite follow-up that adds one new piece of value."
    )
    msg = await outreach.add_message(conv["_id"], "ai", text, "draft", conv["channel"])
    return serialize(msg)


class ConversationPatch(BaseModel):
    ai_handling: Optional[bool] = None
    status: Optional[Literal["active", "archived"]] = None
    channel: Optional[Literal["email", "linkedin", "whatsapp", "call"]] = None
    contact_email: Optional[str] = None


@router.patch("/{conv_id}")
async def update_conversation(conv_id: str, payload: ConversationPatch = Body(...), user: dict = Depends(get_current_user)):
    conv = await _owned(conv_id, user)
    update = {k: v for k, v in payload.model_dump().items() if v is not None and k != "contact_email"}
    if payload.contact_email is not None:
        update["contact.email"] = payload.contact_email.strip()
    if update:
        await db.conversations.update_one({"_id": conv["_id"]}, {"$set": update})
    return serialize(await db.conversations.find_one({"_id": conv["_id"]}))


@router.post("/{conv_id}/analyze")
async def analyze(conv_id: str, user: dict = Depends(get_current_user)):
    conv = await _owned(conv_id, user)
    await _refresh_analysis(conv["_id"])
    return serialize(await db.conversations.find_one({"_id": conv["_id"]}))
