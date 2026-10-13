from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Body, Depends
from pydantic import BaseModel, Field

from core import db
from core.errors import not_found
from core.db import oid, serialize
from core.security import get_current_user
from services import llm, news

router = APIRouter(prefix="/content", tags=["content"])


class GenerateIn(BaseModel):
    topic: Optional[str] = ""
    headline: Optional[str] = ""
    tone: Optional[str] = "professional"


class PostIn(BaseModel):
    content: str = Field(min_length=1, max_length=3000)
    status: Literal["draft", "scheduled", "published"] = "draft"
    scheduled_date: Optional[datetime] = None
    source_headline: Optional[str] = ""


class PostPatch(BaseModel):
    content: Optional[str] = None
    status: Optional[Literal["draft", "scheduled", "published"]] = None
    scheduled_date: Optional[datetime] = None


def _naive(d: Optional[datetime]) -> Optional[datetime]:
    return (d - d.utcoffset()).replace(tzinfo=None) if d and d.tzinfo else d


@router.get("")
async def list_posts(user: dict = Depends(get_current_user)):
    return serialize([p async for p in db.content_posts.find({"user_email": user["email"]}).sort("created_at", -1)])


@router.get("/suggestions")
async def suggestions(user: dict = Depends(get_current_user)):
    """Post ideas derived from today's most relevant industry headlines."""
    articles = await news.get_news(user.get("industry", ""))
    out = []
    for a in articles:
        if a.get("relevance", 0) < 0.2:
            continue
        angle = {
            "opportunity": "Share how buyers can capitalise on this",
            "risk": "Explain how you help buyers de-risk supply",
            "tariff": "Explain what this tariff shift means for sourcing",
        }.get(a.get("signal"), "Offer your perspective as an industry insider")
        out.append({
            "topic": a["headline"],
            "angle": angle,
            "signal": a.get("signal"),
            "url": a.get("url"),
            "engagement": "High" if a.get("trade_signal_score", 0) >= 0.75 else "Medium",
        })
        if len(out) == 6:
            break
    return out


@router.post("/generate")
async def generate(payload: GenerateIn = Body(...), user: dict = Depends(get_current_user)):
    topic = payload.headline or payload.topic or f"trends in {user.get('industry', 'global trade')}"
    company = user.get("company_name") or "our company"
    text = await llm.complete(
        [
            {"role": "system", "content": "You write LinkedIn posts for B2B exporters/importers. 80-160 words, a strong "
             "first line, one concrete insight, a question to drive comments, 2-4 relevant hashtags. No fabricated "
             "statistics. Output only the post."},
            {"role": "user", "content": f"Author: {company}, a {user.get('industry')} {user.get('category')}"
             f"{' in ' + user['country'] if user.get('country') else ''}. {user.get('description') or ''}\n"
             f"Topic / news: {topic}\nTone: {payload.tone}"},
        ],
        max_tokens=400,
        temperature=0.8,
    )
    if not text:
        text = (
            f"{topic}\n\nAt {company}, we're watching how this affects {user.get('industry', 'our industry')} "
            f"supply chains. Buyers who plan sourcing early will be best placed.\n\n"
            f"How is your team responding?\n\n#{(user.get('industry') or 'Trade').replace(' ', '')} #GlobalTrade #Exports"
        )
    return {"content": text, "source_headline": payload.headline or ""}


@router.post("")
async def create_post(payload: PostIn = Body(...), user: dict = Depends(get_current_user)):
    now = datetime.utcnow()
    doc = {
        "user_email": user["email"],
        "content": payload.content.strip(),
        "status": payload.status,
        "scheduled_date": _naive(payload.scheduled_date),
        "published_date": now if payload.status == "published" else None,
        "source_headline": payload.source_headline or "",
        "created_at": now,
    }
    res = await db.content_posts.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize(doc)


@router.patch("/{post_id}")
async def update_post(post_id: str, payload: PostPatch = Body(...), user: dict = Depends(get_current_user)):
    post = await db.content_posts.find_one({"_id": oid(post_id), "user_email": user["email"]})
    if not post:
        raise not_found("Post")
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "scheduled_date" in update:
        update["scheduled_date"] = _naive(update["scheduled_date"])
    if update.get("status") == "published":
        update["published_date"] = datetime.utcnow()
    if update:
        await db.content_posts.update_one({"_id": post["_id"]}, {"$set": update})
    return serialize(await db.content_posts.find_one({"_id": post["_id"]}))


@router.delete("/{post_id}")
async def delete_post(post_id: str, user: dict = Depends(get_current_user)):
    await db.content_posts.delete_one({"_id": oid(post_id), "user_email": user["email"]})
    return {"status": "deleted"}
