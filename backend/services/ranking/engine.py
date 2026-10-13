"""Ranking engine: picks the algorithm for the current news regime and swipe history.

Strategy:  base model = RandomForestRanker once the user has enough swipes,
           otherwise StaticFitRanker.
Decorator: the news regime decides which decorators wrap the base model and
           how much weight news gets:
             calm   -> NewsImpact(low)
             active -> NewsImpact(medium)
             boom   -> NewsImpact(high) + Momentum
             shock  -> NewsImpact(highest) + RiskAversion
           then Semantic (if Pinecone), SwipeFeedback, SkipPenalty, Diversity.
"""
import math
from typing import Dict, List, Tuple

from core.config import log, settings
from services import vector

from . import decorators as d
from .features import clip, news_impact
from .feedback import FeedbackModel
from .rankers import RankContext, Ranker, base_ranker
from .regime import MarketRegime, detect


def _news_weights() -> Dict[str, float]:
    out = {"calm": 0.15, "active": 0.3, "boom": 0.35, "shock": 0.45}
    for part in settings.NEWS_WEIGHTS.split(","):
        if ":" in part:
            k, v = part.split(":", 1)
            try:
                out[k.strip()] = float(v)
            except ValueError:
                pass
    return out


def build_pipeline(regime: MarketRegime, fb: FeedbackModel, has_semantic: bool) -> Ranker:
    ranker: Ranker = base_ranker(fb)
    ranker = d.NewsImpactDecorator(ranker, _news_weights().get(regime.name, 0.3))
    if regime.name == "boom":
        ranker = d.MomentumDecorator(ranker)
    elif regime.name == "shock":
        ranker = d.RiskAversionDecorator(ranker)
    if has_semantic:
        ranker = d.SemanticDecorator(ranker)
    if fb.total:
        ranker = d.FeedbackDecorator(ranker)
    ranker = d.SkipPenaltyDecorator(ranker)
    return d.DiversityDecorator(ranker)


def _compose_reasoning(lead: dict) -> str:
    parts = []
    if lead.get("intent_score"):
        parts.append(f"Intent score {round(lead['intent_score'] * 100)}%")
    if lead.get("response_probability"):
        parts.append(f"{round(lead['response_probability'] * 100)}% likely to respond")
    if lead.get("preferred_channel"):
        parts.append(f"prefers {lead['preferred_channel']}")
    text = (", ".join(parts) + ".") if parts else ""
    if lead.get("certification"):
        text += f" Certified: {lead['certification']}."
    if lead.get("news_reasons"):
        r = lead["news_reasons"][0]
        text += f" News: {r['why'].lower()} ({clip(r['headline'], 90)})."
    if lead.get("preference_note"):
        text += f" {lead['preference_note']}."
    return text.strip()


def rank_leads(
    leads: List[dict], articles: List[dict], user: dict, semantic: Dict[str, float], fb: FeedbackModel
) -> Tuple[List[dict], dict]:
    regime = detect(articles)
    user_country = user.get("country") or ""

    # Feature enrichment shared by every ranker.
    for l in leads:
        l["news_score"], l["news_reasons"] = news_impact(l, articles, user_country)
        l["news_score"] = round(l["news_score"], 3)

    base_order = {l["id"]: i for i, l in enumerate(sorted(leads, key=lambda l: l["base_score"], reverse=True))}
    ctx = RankContext(user=user, articles=articles, regime=regime, feedback=fb, semantic=semantic)
    pipeline = build_pipeline(regime, fb, bool(semantic))
    try:
        ranked = pipeline.rank(leads, ctx)
    except Exception as e:  # last-resort safety net: keep the deck usable
        log.exception("Ranking pipeline failed: %s", e)
        ranked = sorted(leads, key=lambda l: l["base_score"], reverse=True)
        for l in ranked:
            l["score"] = l["base_score"]

    for i, l in enumerate(ranked):
        # Decorators add raw deltas; squash smoothly into 0..1 so strong leads
        # don't all pile up at 99% (order is preserved).
        l["dynamic_score"] = round(0.5 + 0.49 * math.tanh((l.pop("score") - 0.5) * 2.2), 4)
        l["match_percentage"] = max(1, min(99, round(l["dynamic_score"] * 100)))
        l["rank_delta"] = base_order[l["id"]] - i  # >0: moved up because of news/feedback
        l["ai_reasoning"] = _compose_reasoning(l)
        l.setdefault("preference_note", None)
        l.setdefault("semantic_score", 0.5)

    engine = {
        "regime": regime.to_dict(),
        "pipeline": pipeline.describe(),
        "notes": [regime.summary] + ctx.notes,
        "feedback": fb.summary(),
    }
    return ranked, engine


async def semantic_scores(leads: List[dict], articles: List[dict], user: dict) -> Dict[str, float]:
    if not articles or not leads:
        return {}
    namespace = "exporters" if user.get("category") == "importer" else "importers"
    if namespace not in settings.PINECONE_NAMESPACES:
        return {}
    headlines = "; ".join(a["headline"] for a in articles[:6])
    query = f"{user.get('industry', '')} buyers affected by: {headlines}"
    try:
        hits = await vector.search(query, [namespace], top_k=50)
    except Exception as e:
        log.warning("Semantic scoring skipped: %s", e)
        return {}
    if not hits:
        return {}
    by_name = {l["company_name"].lower(): l["id"] for l in leads}
    by_id = {l["id"]: l["id"] for l in leads}
    top = max(h.get("_score", 0) for h in hits) or 1.0
    out: Dict[str, float] = {}
    for h in hits:
        values = [str(h.get("_id", ""))] + [str(v) for v in (h.get("fields") or {}).values()]
        for v in values:
            lid = by_id.get(v) or by_name.get(v.lower())
            if lid and lid not in out:
                out[lid] = 0.5 + 0.5 * (h.get("_score", 0) / top)
                break
    return out
