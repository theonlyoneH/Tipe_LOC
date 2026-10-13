"""Shared feature engineering: news impact per lead, ML feature vectors, similarity."""
import math
from typing import List, Tuple

CHANNELS = ("email", "linkedin", "whatsapp")

FEATURE_NAMES = [
    "intent", "reply odds", "prompt response", "revenue", "team size", "payment history",
    "tariff exposure", "buying signals", "news impact", "baseline fit",
    "email channel", "linkedin channel", "whatsapp channel",
]


def clip(text: str, n: int) -> str:
    """Shorten at a word boundary so headlines don't end mid-word."""
    text = text.strip()
    if len(text) <= n:
        return text
    return text[:n].rsplit(" ", 1)[0].rstrip(",;:-") + "…"


def channel_key(lead: dict) -> str:
    v = (lead.get("preferred_channel") or "").lower()
    return next((c for c in CHANNELS if c[:4] in v), "email")


def vector(lead: dict) -> List[float]:
    """Numeric features, each roughly in 0..1, for the learned rankers."""
    ch = channel_key(lead)
    return [
        float(lead.get("intent_score") or 0),
        float(lead.get("response_probability") or 0),
        float(lead.get("prompt_response") or 0),
        min(1.0, math.log10((lead.get("revenue_usd") or 0) + 1) / 10),
        min(1.0, math.log10((lead.get("team_size") or 0) + 1) / 5),
        1.0 if lead.get("trust_verified") else 0.0,
        1.0 if lead.get("tariff_exposed") else 0.0,
        min(1.0, len(lead.get("signals") or []) / 5),
        float(lead.get("news_score", 0.5)),
        float(lead.get("base_score") or 0),
    ] + [1.0 if ch == c else 0.0 for c in CHANNELS]


def similarity(a: dict, b: dict) -> float:
    """0..1 lookalike score: firmographic distance plus same market/channel."""
    va, vb = vector(a)[:8], vector(b)[:8]  # exclude news/base/channel: those change daily
    dist = math.sqrt(sum((x - y) ** 2 for x, y in zip(va, vb)))
    sim = max(0.0, 1 - dist / 1.4)
    if a.get("country") and a.get("country") == b.get("country"):
        sim = min(1.0, sim + 0.15)
    if channel_key(a) == channel_key(b):
        sim = min(1.0, sim + 0.05)
    return sim


def news_impact(lead: dict, articles: List[dict], user_country: str) -> Tuple[float, List[dict]]:
    """0..1 (0.5 neutral) score of how today's headlines affect this lead's market."""
    country = lead.get("country") or ""
    if not country:
        return 0.5, []
    raw = 0.0
    reasons = []
    for a in articles:
        if country not in a.get("countries", []):
            continue
        weight = (0.4 + 0.6 * a.get("relevance", 0)) * (0.5 + 0.5 * a.get("recency", 0.5))
        if a.get("tariff"):
            # Tariffs between the user's market and the lead's hurt the deal;
            # tariffs hitting the lead's market from elsewhere push that buyer
            # to diversify suppliers - an opening for the user.
            if user_country and user_country in a.get("countries", []):
                impact, why = -0.5, "Tariff friction between your market and theirs"
            elif lead.get("tariff_exposed"):
                impact, why = 0.7, "Tariff shift - buyer actively diversifying suppliers"
            else:
                impact, why = 0.35, "Tariff change may open supplier diversification"
        else:
            impact = a.get("polarity", 0)
            if abs(impact) < 0.1:
                continue
            why = "Positive market momentum" if impact > 0 else "Market risk headline"
        contribution = impact * weight
        raw += contribution
        reasons.append({
            "headline": a["headline"],
            "url": a.get("url", ""),
            "source": a.get("source", ""),
            "impact": round(contribution, 3),
            "why": why,
        })
    reasons.sort(key=lambda r: abs(r["impact"]), reverse=True)
    return 0.5 + 0.5 * math.tanh(raw), reasons[:3]
