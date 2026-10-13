"""Swipe feedback: why leads were rejected, and what that implies for the rest.

Every rejection carries a reason - picked by the user, or inferred by comparing
the lead with what the user has approved. Each reason maps to a rule that
penalises similar leads; approvals boost lookalikes. Recent swipes weigh more
(exponential decay), so the deck adapts within a session like a dating app.
"""
import math
import statistics
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from core import db
from core.config import settings
from services.leads import normalize

from .features import channel_key, similarity

REJECT_REASONS: Dict[str, str] = {
    "wrong_market": "Wrong market / country",
    "too_small": "Company too small",
    "low_intent": "Not buying now",
    "wrong_channel": "Can't reach them this way",
    "not_relevant": "Not a fit for my product",
}


@dataclass
class FeedbackEvent:
    lead: dict
    approved: bool
    reason: Optional[str]
    source: str      # "user" | "inferred" | ""
    weight: float    # recency (x0.6 when the reason was inferred)


class FeedbackModel:
    def __init__(self, events: List[FeedbackEvent]):
        self.events = events
        self.total = len(events)
        self.approved = [e for e in events if e.approved]
        self.rejected = [e for e in events if not e.approved]
        # Laplace-smoothed approval rates per attribute, recency-weighted.
        self.rates: Dict[str, Dict[str, List[float]]] = {"country": defaultdict(lambda: [0.0, 0.0]),
                                                          "channel": defaultdict(lambda: [0.0, 0.0])}
        for e in events:
            for attr, val in (("country", e.lead.get("country")), ("channel", channel_key(e.lead))):
                if val:
                    self.rates[attr][val][0 if e.approved else 1] += e.weight
        self.reason_counts: Dict[str, float] = defaultdict(float)
        for e in self.rejected:
            if e.reason:
                self.reason_counts[e.reason] += e.weight

    @property
    def trainable(self) -> bool:
        return (len(self.approved) >= 2 and len(self.rejected) >= 2
                and self.total >= settings.RF_MIN_DECISIONS)

    def _rate(self, attr: str, val: str) -> float:
        a, r = self.rates[attr].get(val, [0.0, 0.0]) if val else (0.0, 0.0)
        return (a + 1) / (a + r + 2)

    def adjust(self, lead: dict) -> Tuple[float, Optional[str]]:
        """Score delta in about -0.35..+0.2 and the strongest human-readable cause."""
        if not self.events:
            return 0.0, None
        delta = 0.0
        causes: List[Tuple[float, str]] = []

        for e in self.rejected:
            ref = e.lead
            hit = 0.0
            if e.reason == "wrong_market" and lead.get("country") and lead.get("country") == ref.get("country"):
                hit = 0.25
            elif e.reason == "too_small" and (lead.get("revenue_usd") or 0) <= (ref.get("revenue_usd") or 0) * 2.5:
                hit = 0.12
            elif e.reason == "low_intent" and (lead.get("intent_score") or 0) <= (ref.get("intent_score") or 0) + 0.05:
                hit = 0.12
            elif e.reason == "wrong_channel" and channel_key(lead) == channel_key(ref):
                hit = 0.12
            elif e.reason in ("not_relevant", None):
                sim = similarity(lead, ref)
                hit = 0.2 * sim if sim > 0.8 else 0.0
            if hit:
                d = -hit * e.weight
                delta += d
                label = REJECT_REASONS.get(e.reason or "", "a lead you rejected")
                causes.append((d, f"Similar to {ref.get('company_name')} you rejected ({label.lower()})"))

        for e in self.approved:
            sim = similarity(lead, e.lead)
            if sim > 0.8:
                d = 0.08 * sim * e.weight
                delta += d
                causes.append((d, f"Looks like {e.lead.get('company_name')}, which you approved"))

        # Aggregate taste for markets and channels.
        if self.total >= 3:
            d = 0.12 * (self._rate("country", lead.get("country") or "") - 0.5) + 0.06 * (self._rate("channel", channel_key(lead)) - 0.5)
            delta += d
            if abs(d) > 0.02:
                causes.append((d, f"You {'tend to approve' if d > 0 else 'often reject'} leads in {lead.get('country')}"))

        delta = max(-0.35, min(0.2, delta))
        cause = max(causes, key=lambda c: abs(c[0]))[1] if causes else None
        return delta, cause

    def summary(self) -> dict:
        top = sorted(self.reason_counts.items(), key=lambda kv: kv[1], reverse=True)
        return {
            "decisions": self.total,
            "approved": len(self.approved),
            "rejected": len(self.rejected),
            "top_reject_reasons": [{"reason": r, "label": REJECT_REASONS[r], "weight": round(w, 2)} for r, w in top[:3] if r in REJECT_REASONS],
        }


def infer_reason(lead: dict, model: FeedbackModel, pool: List[dict]) -> str:
    """Best guess at why a lead was rejected when the user didn't say."""
    approved = [e.lead for e in model.approved]
    ref = approved or pool
    if not ref:
        return "not_relevant"
    country = lead.get("country")
    approved_countries = {l.get("country") for l in approved}
    if approved and country and country not in approved_countries and model._rate("country", country) < 0.5:
        return "wrong_market"
    revs = [l.get("revenue_usd") or 0 for l in ref if l.get("revenue_usd")]
    if revs and (lead.get("revenue_usd") or 0) < 0.5 * statistics.median(revs):
        return "too_small"
    intents = [l.get("intent_score") or 0 for l in ref]
    if intents and (lead.get("intent_score") or 0) < statistics.median(intents) - 0.1:
        return "low_intent"
    if approved and channel_key(lead) not in {channel_key(l) for l in approved}:
        return "wrong_channel"
    return "not_relevant"


async def load_feedback(user_email: str) -> FeedbackModel:
    now = datetime.utcnow()
    half_life = settings.FEEDBACK_HALF_LIFE_HOURS
    events = []
    cursor = db.decisions.find(
        {"user_email": user_email, "status": {"$in": ["approved", "rejected"]}},
        {"status": 1, "lead_data": 1, "approved_at": 1, "reason": 1, "reason_source": 1, "lead_id": 1},
    ).sort("approved_at", -1).limit(500)
    async for d in cursor:
        lead = d.get("lead_data") or {}
        if "company_name" not in lead:  # legacy raw Mongo document
            lead = normalize({**lead, "_id": d.get("lead_id", "")})
        age_h = (now - d["approved_at"]).total_seconds() / 3600 if d.get("approved_at") else half_life
        weight = math.pow(0.5, age_h / half_life)
        if d.get("reason_source") == "inferred":
            weight *= 0.6
        events.append(FeedbackEvent(lead, d.get("status") == "approved", d.get("reason"), d.get("reason_source", ""), weight))
    return FeedbackModel(events)
