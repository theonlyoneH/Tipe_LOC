"""Ranking decorators: each wraps a Ranker, runs it, then adjusts the scores.

    pipeline = Diversity(SkipPenalty(Feedback(NewsImpact(RandomForestRanker(...)))))

Every decorator records its contribution in `lead["score_breakdown"]`, so the
UI can show exactly why a lead sits where it does.
"""
from typing import List

from .rankers import Ranker, RankContext, _add


class RankerDecorator(Ranker):
    def __init__(self, inner: Ranker):
        self.inner = inner

    def rank(self, leads, ctx):
        leads = self.inner.rank(leads, ctx)
        self.adjust(leads, ctx)
        return leads

    def adjust(self, leads: List[dict], ctx: RankContext) -> None:
        raise NotImplementedError

    def describe(self):
        return self.inner.describe() + [{"name": self.name, "label": self.label}]


class NewsImpactDecorator(RankerDecorator):
    """Headlines about the lead's market. Weight depends on the regime."""

    name, label = "news_impact", "Live news impact"

    def __init__(self, inner: Ranker, weight: float):
        super().__init__(inner)
        self.weight = weight
        self.label = f"Live news impact (weight {weight:.2f})"

    def adjust(self, leads, ctx):
        for l in leads:
            d = self.weight * (l.get("news_score", 0.5) - 0.5)
            if d:
                l["score"] += d
                _add(l, "Live news", d)


class MomentumDecorator(RankerDecorator):
    """Boom regime: favour growing buyers in markets with good news."""

    name, label = "momentum", "Momentum boost (boom market)"

    def adjust(self, leads, ctx):
        hot = ctx.regime.hot_countries
        for l in leads:
            heat = max(0.0, hot.get(l.get("country") or "", 0.0))
            growth = any(k in s.lower() for s in l.get("signals", []) for k in ("funding", "hiring", "spike"))
            d = min(0.08, 0.04 * heat) + (0.03 if growth and heat > 0 else 0.0)
            if d:
                l["score"] += d
                _add(l, "Market momentum", d)


class RiskAversionDecorator(RankerDecorator):
    """Shock regime: penalise exposed markets and flagged risks, reward reliable payers."""

    name, label = "risk_aversion", "Risk aversion (shock market)"

    def adjust(self, leads, ctx):
        hot = ctx.regime.hot_countries
        for l in leads:
            d = 0.0
            neg = min(0.0, hot.get(l.get("country") or "", 0.0))
            d += max(-0.1, 0.05 * neg)
            if l.get("war_risk"):
                d -= 0.05
            if l.get("market_shock"):
                d -= 0.03
            if l.get("trust_verified"):
                d += 0.03
            if d:
                l["score"] += d
                _add(l, "Risk adjustment", d)


class SemanticDecorator(RankerDecorator):
    """Pinecone similarity between today's headlines and the lead."""

    name, label = "semantic", "Semantic news match (Pinecone)"

    def adjust(self, leads, ctx):
        for l in leads:
            s = ctx.semantic.get(l["id"])
            if s is not None:
                d = 0.1 * (s - 0.5)
                l["score"] += d
                l["semantic_score"] = round(s, 3)
                _add(l, "Semantic news match", d)


class FeedbackDecorator(RankerDecorator):
    """Rejection reasons + approval lookalikes from the user's swipes."""

    name, label = "swipe_feedback", "Swipe feedback (rejection reasons)"

    def adjust(self, leads, ctx):
        for l in leads:
            d, cause = ctx.feedback.adjust(l)
            l["preference_note"] = cause
            if d:
                l["score"] += d
                _add(l, "Your swipes", d)


class SkipPenaltyDecorator(RankerDecorator):
    name, label = "skip_penalty", "Skipped leads return later"

    def adjust(self, leads, ctx):
        for l in leads:
            if l.get("skipped"):
                d = -0.12
                l["score"] += d
                _add(l, "Skipped earlier", d)


class DiversityDecorator(RankerDecorator):
    """Re-orders (doesn't re-score) so the top of the deck isn't one country
    over and over - keeps exploring markets, like a dating app's feed."""

    name, label = "diversity", "Market diversity in the deck"

    def __init__(self, inner: Ranker, window: int = 30, max_run: int = 2):
        super().__init__(inner)
        self.window, self.max_run = window, max_run

    def rank(self, leads, ctx):
        leads = self.inner.rank(leads, ctx)
        leads.sort(key=lambda l: l["score"], reverse=True)
        remaining, out = leads, []
        for _ in range(min(self.window, len(leads))):
            run = [o.get("country") for o in out[-self.max_run:]]
            blocked = len(run) == self.max_run and len(set(run)) == 1 and run[0]
            # Next-best lead from a different market, if one exists anywhere below.
            pick = next((i for i, l in enumerate(remaining) if not blocked or l.get("country") != blocked), 0)
            out.append(remaining.pop(pick))
        return out + remaining

    def adjust(self, leads, ctx):  # pragma: no cover - rank() is overridden
        pass
