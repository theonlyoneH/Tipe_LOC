"""AI outreach: first-touch messages, replies, conversation analysis, delivery."""
import smtplib
from datetime import datetime
from email.message import EmailMessage
from typing import Dict, List, Optional

from bson import ObjectId
from starlette.concurrency import run_in_threadpool

from core import db
from core.config import log, settings
from services import llm
from services.ranking import clip

CHANNELS = {"email", "linkedin", "whatsapp", "call"}

_CHANNEL_STYLE = {
    "email": "a concise business email (subject line first as 'Subject: ...', then 90-140 words)",
    "linkedin": "a LinkedIn connection/InMail message under 300 characters, warm and direct",
    "whatsapp": "a short WhatsApp message (2-3 sentences, friendly, no subject line)",
    "call": "a 30-second cold-call opening script with one discovery question",
}


def normalize_channel(value: str) -> str:
    v = (value or "").strip().lower()
    if v in CHANNELS:
        return v
    if "mail" in v:
        return "email"
    if "link" in v:
        return "linkedin"
    if "whats" in v or "sms" in v or "message" in v:
        return "whatsapp"
    if "call" in v or "phone" in v:
        return "call"
    return "email"


def _seller_context(user: dict) -> str:
    company = user.get("company_name") or user["email"].split("@")[0]
    return (
        f"Sender company: {company}\n"
        f"Role: {user.get('category', 'exporter')} in {user.get('industry', '')}"
        f"{' based in ' + user['country'] if user.get('country') else ''}\n"
        f"About the sender: {user.get('description') or 'not provided'}"
    )


def _lead_context(lead: dict) -> str:
    news = "; ".join(r["headline"] for r in (lead.get("news_reasons") or [])[:2]) or "none"
    signals = "; ".join(lead.get("signals") or []) or "none"
    return (
        f"Prospect: {lead.get('company_name')} ({lead.get('industry')}, {lead.get('country')})\n"
        f"Contact person: {(lead.get('contact') or {}).get('person') or 'unknown'}\n"
        f"Buying signals: {signals}\n"
        f"Relevant news: {news}\n"
        f"Certification: {lead.get('certification') or 'n/a'}"
    )


def _template_opening(user: dict, lead: dict, channel: str) -> str:
    """Deterministic fallback when no LLM is configured."""
    company = user.get("company_name") or "our team"
    hook = ""
    if lead.get("news_reasons"):
        hook = f"Given recent developments ({clip(lead['news_reasons'][0]['headline'], 80)}), I wanted to connect. "
    elif lead.get("signals"):
        hook = f"I noticed: {lead['signals'][0].lower()}. "
    body = (
        f"Hello {lead.get('company_name')} team,\n\n{hook}"
        f"I'm reaching out from {company}, a {user.get('industry', '')} "
        f"{user.get('category', 'exporter')}"
        f"{' in ' + user['country'] if user.get('country') else ''}. "
        f"We work with buyers in {lead.get('country') or 'your market'} and would value a short call "
        f"to see if our capabilities fit your sourcing plans. Would next week work?"
    )
    if channel == "email":
        return f"Subject: {user.get('industry', 'Trade')} supply partnership for {lead.get('company_name')}\n\n{body}"
    return body


async def opening_message(user: dict, lead: dict, channel: str) -> str:
    text = await llm.complete(
        [
            {
                "role": "system",
                "content": (
                    "You write B2B trade outreach for exporters/importers. Be specific, credible, "
                    "and human. Reference at most one buying signal or news item naturally. "
                    "Never invent facts, prices, certifications or names not given. "
                    "End with a low-friction call to action. Output only the message text."
                ),
            },
            {
                "role": "user",
                "content": f"{_seller_context(user)}\n\n{_lead_context(lead)}\n\nWrite {_CHANNEL_STYLE[channel]}.",
            },
        ],
        max_tokens=400,
        temperature=0.7,
    )
    return text or _template_opening(user, lead, channel)


def _history(msgs: List[dict]) -> str:
    who = {"user": "Us", "ai": "Us (AI)", "lead": "Prospect"}
    return "\n".join(f"{who.get(m['sender'], m['sender'])}: {m['content']}" for m in msgs[-14:])


async def reply_message(user: dict, conv: dict, msgs: List[dict], instruction: str = "") -> str:
    channel = conv.get("channel", "email")
    text = await llm.complete(
        [
            {
                "role": "system",
                "content": (
                    "You are a trade sales rep continuing a B2B outreach conversation on behalf of the sender. "
                    "Answer the prospect's latest message directly, move toward a meeting or sample/quote, "
                    "never invent prices, certifications or commitments not given; if information is missing, "
                    "offer to confirm it. Match the channel's tone and length. Output only the reply text."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"{_seller_context(user)}\n\nProspect: {conv.get('lead_company')} ({conv.get('country', '')})\n"
                    f"Channel: {channel} - write {_CHANNEL_STYLE[channel]}\n\nConversation so far:\n{_history(msgs)}"
                    + (f"\n\nExtra instruction from the sender: {instruction}" if instruction else "")
                ),
            },
        ],
        max_tokens=400,
        temperature=0.6,
    )
    if text:
        return text
    last = next((m for m in reversed(msgs) if m["sender"] == "lead"), None)
    if last:
        return (
            "Thank you for getting back to us. Happy to share details - could we set up a 20-minute call "
            "this week to understand your requirements and volumes?"
        )
    return "Just following up on my earlier note - would a short call next week be useful?"


async def analyze(conv: dict, msgs: List[dict]) -> dict:
    """Sentiment, stage and next action. LLM when available, heuristics otherwise."""
    lead_msgs = [m for m in msgs if m["sender"] == "lead"]
    fallback = {
        "sentiment": 0.5,
        "sentiment_label": "Awaiting reply" if not lead_msgs else "Neutral",
        "stage": "contacted" if not lead_msgs else "engaged",
        "meeting_intent": False,
        "next_action": "Follow up in 3 days if there is no reply." if not lead_msgs
        else "Reply and propose a call time.",
        "summary": "",
    }
    if not lead_msgs:
        return fallback
    text = " ".join(m["content"].lower() for m in lead_msgs[-3:])
    pos = sum(w in text for w in ("interested", "great", "yes", "sure", "send", "price", "quote", "sample", "call", "meet"))
    neg = sum(w in text for w in ("not interested", "no thanks", "unsubscribe", "stop", "busy", "later", "remove"))
    fallback["sentiment"] = max(0.05, min(0.95, 0.5 + 0.1 * pos - 0.2 * neg))
    fallback["sentiment_label"] = "Positive" if fallback["sentiment"] > 0.6 else "Negative" if fallback["sentiment"] < 0.4 else "Neutral"
    fallback["meeting_intent"] = any(w in text for w in ("call", "meet", "demo", "schedule", "available"))
    if fallback["meeting_intent"]:
        fallback["stage"], fallback["next_action"] = "meeting_requested", "Propose 2-3 time slots and schedule the meeting."

    data = await llm.complete_json(
        [
            {
                "role": "system",
                "content": (
                    "Analyse a B2B sales conversation. Return JSON with keys: sentiment (0..1 float), "
                    "sentiment_label (Positive|Neutral|Negative), stage (contacted|engaged|meeting_requested|"
                    "negotiating|won|lost), meeting_intent (bool), next_action (one sentence), summary (one sentence)."
                ),
            },
            {"role": "user", "content": _history(msgs)},
        ]
    )
    if not data:
        return fallback
    try:
        return {
            "sentiment": max(0.0, min(1.0, float(data.get("sentiment", fallback["sentiment"])))),
            "sentiment_label": str(data.get("sentiment_label") or fallback["sentiment_label"]),
            "stage": str(data.get("stage") or fallback["stage"]),
            "meeting_intent": bool(data.get("meeting_intent", fallback["meeting_intent"])),
            "next_action": str(data.get("next_action") or fallback["next_action"]),
            "summary": str(data.get("summary") or ""),
        }
    except Exception:
        return fallback


# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------

async def add_message(conv_id: ObjectId, sender: str, content: str, status: str, channel: str) -> dict:
    now = datetime.utcnow()
    doc = {
        "conversation_id": conv_id,
        "sender": sender,
        "content": content,
        "channel": channel,
        "status": status,  # draft | approved | delivered | received
        "created_at": now,
    }
    res = await db.messages.insert_one(doc)
    doc["_id"] = res.inserted_id
    update = {"$set": {"updated_at": now, "last_message": content[:200], "last_sender": sender}}
    if sender == "lead":
        update["$inc"] = {"unread": 1}
    await db.conversations.update_one({"_id": conv_id}, update)
    return doc


async def conversation_messages(conv_id: ObjectId) -> List[dict]:
    return [m async for m in db.messages.find({"conversation_id": conv_id}).sort("created_at", 1)]


def _send_email_sync(to: str, body: str, sender_name: str) -> None:
    subject = "Partnership enquiry"
    if body.lower().startswith("subject:"):
        first, _, rest = body.partition("\n")
        subject, body = first.split(":", 1)[1].strip(), rest.strip()
    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
    msg["To"] = to
    msg["Subject"] = subject
    msg["Reply-To"] = msg["From"]
    msg.set_content(body)
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as s:
        s.starttls()
        if settings.SMTP_USER:
            s.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        s.send_message(msg)


def can_deliver(conv: dict) -> bool:
    return bool(conv.get("channel") == "email" and settings.SMTP_HOST and (conv.get("contact") or {}).get("email"))


async def deliver(conv: dict, message: dict, user: dict) -> str:
    """Send through a real channel when configured; otherwise mark approved
    (ready for the user to send from their own inbox / app)."""
    if can_deliver(conv):
        try:
            await run_in_threadpool(_send_email_sync, conv["contact"]["email"], message["content"], user["email"])
            return "delivered"
        except Exception as e:
            log.warning("SMTP delivery failed: %s", e)
    return "approved"


async def start_conversation(user: dict, lead: dict, ai_handling: bool = True) -> Dict:
    """Create (or reuse) the conversation for an approved lead and draft the first touch."""
    existing = await db.conversations.find_one({"user_email": user["email"], "lead_id": lead["id"]})
    if existing:
        return existing
    channel = normalize_channel(lead.get("preferred_channel", "email"))
    now = datetime.utcnow()
    conv = {
        "user_email": user["email"],
        "lead_id": lead["id"],
        "lead_name": (lead.get("contact") or {}).get("person") or lead["company_name"],
        "lead_company": lead["company_name"],
        "country": lead.get("country", ""),
        "channel": channel,
        "contact": lead.get("contact") or {},
        "ai_handling": ai_handling,
        "status": "active",
        "stage": "drafting",
        "unread": 0,
        "last_message": "Drafting first message...",
        "last_sender": "ai",
        "match_percentage": lead.get("match_percentage"),
        "created_at": now,
        "updated_at": now,
    }
    res = await db.conversations.insert_one(conv)
    conv["_id"] = res.inserted_id
    return conv


async def draft_opening(user: dict, lead: dict, conv_id: ObjectId) -> None:
    """Background task: write the opening message for a fresh conversation."""
    try:
        conv = await db.conversations.find_one({"_id": conv_id})
        if not conv:
            return
        text = await opening_message(user, lead, conv["channel"])
        msg = await add_message(conv_id, "ai", text, "draft", conv["channel"])
        if conv.get("ai_handling"):
            status = await deliver(conv, msg, user)
            await db.messages.update_one({"_id": msg["_id"]}, {"$set": {"status": status}})
        await db.conversations.update_one(
            {"_id": conv_id},
            {"$set": {"stage": "contacted" if conv.get("ai_handling") else "draft_ready"}},
        )
    except Exception as e:
        log.exception("Opening draft failed: %s", e)
        await db.conversations.update_one({"_id": conv_id}, {"$set": {"stage": "draft_failed"}})
