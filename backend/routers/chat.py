from typing import List, Optional

from fastapi import APIRouter, Body, Depends
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

from core.config import log
from core.errors import AppError
from core.security import bearer, get_current_user
from services import llm, news, vector

router = APIRouter(tags=["chat"])


class ChatTurn(BaseModel):
    role: str
    content: str


class ChatIn(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    history: Optional[List[ChatTurn]] = None


async def optional_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> Optional[dict]:
    if not creds:
        return None
    try:
        return await get_current_user(creds)
    except AppError:
        return None


SYSTEM_PROMPT = """You are TIPE AI, the assistant inside TIPE (Trade Intent Prediction Engine), a RAG-powered trade intelligence platform.

Rules:
- Ground answers in the retrieved trade records and live news below when they are relevant. Cite the source type (Exporter / Importer / News) for each record you use.
- If the records are not relevant, say so briefly and answer from general trade knowledge, clearly marked as general guidance.
- If the user asks for N results, return exactly N (default 5) when enough relevant records exist.
- For lead/market requests, use: a 1-2 line summary, then a numbered list (entity, location, why relevant, key signals), then 2-3 strategic insights.
- Plain text with simple numbered/bulleted lists; no markdown bold or headings. Never mention embeddings, JSON or internal systems.
- Never invent companies, numbers or contacts that are not in the records."""


def _context(hits: List[dict], articles: List[dict]) -> str:
    lines = []
    for h in hits[:10]:
        fields = {k: v for k, v in (h.get("fields") or {}).items() if v not in (None, "")}
        lines.append(f"[{h.get('_record_type')}] id={h.get('_id')} score={round(h.get('_score', 0), 3)} {fields}")
    for a in articles[:5]:
        lines.append(f"[News] {a['headline']} (signal: {a.get('signal')}, countries: {', '.join(a.get('countries', [])) or 'n/a'})")
    return "\n".join(lines) or "(no records retrieved)"


@router.post("/chat")
async def chat(payload: ChatIn = Body(...), user: Optional[dict] = Depends(optional_user)):
    query = payload.query.strip()
    try:
        hits = await vector.search(query)
        articles = await news.get_news(user.get("industry", "")) if user else []
    except Exception as e:
        log.warning("Chat retrieval failed: %s", e)
        hits, articles = [], []

    profile = (
        f"User: {user.get('category')} in {user.get('industry')} ({user.get('country') or 'n/a'}). {user.get('description') or ''}"
        if user else "User: anonymous"
    )
    messages = [{"role": "system", "content": f"{SYSTEM_PROMPT}\n\n{profile}\n\nRetrieved records:\n{_context(hits, articles)}"}]
    for turn in (payload.history or [])[-8:]:
        if turn.role in ("user", "assistant") and turn.content:
            messages.append({"role": turn.role, "content": turn.content[:2000]})
    messages.append({"role": "user", "content": query})

    answer = await llm.complete(messages, max_tokens=1500, temperature=0.4)
    if not answer:
        if not llm.provider():
            answer = "The AI assistant isn't configured yet (no GROQ_API_KEYS or GEMINI_API_KEYS on the server)."
        else:
            answer = "I couldn't reach the AI service just now. Please try again in a moment."
    return {"response": answer, "sources": len(hits)}
