"""Base ranking strategies (the 'component' in the decorator pattern).

A Ranker writes `score` (0..1) and a `score_breakdown` entry on every lead.
Decorators (decorators.py) wrap a Ranker and adjust its output.
"""
import threading
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List

from core.config import log, settings

from .features import FEATURE_NAMES, vector
from .feedback import FeedbackModel
from .regime import MarketRegime


@dataclass
class RankContext:
    user: dict
    articles: List[dict]
    regime: MarketRegime
    feedback: FeedbackModel
    semantic: Dict[str, float] = field(default_factory=dict)
    notes: List[str] = field(default_factory=list)  # engine-level explanations


class Ranker(ABC):
    name = "ranker"
    label = "Ranker"

    @abstractmethod
    def rank(self, leads: List[dict], ctx: RankContext) -> List[dict]:
        ...

    def describe(self) -> List[dict]:
        return [{"name": self.name, "label": self.label}]


def _add(lead: dict, label: str, delta: float) -> None:
    lead.setdefault("score_breakdown", []).append({"label": label, "delta": round(delta, 4)})


class StaticFitRanker(Ranker):
    """Offline fit score (`rank` from the ML pipeline, or intent signals)."""

    name, label = "static_fit", "Baseline fit model"

    def rank(self, leads, ctx):
        for l in leads:
            l["score"] = l["base_score"]
            l["score_breakdown"] = [{"label": "Baseline fit", "delta": round(l["base_score"], 4)}]
        return leads


# ---------------------------------------------------------------------------
# Random forest trained on this user's swipes
# ---------------------------------------------------------------------------

_models: Dict[str, tuple] = {}  # email -> (fingerprint, model, importances)
_models_lock = threading.Lock()


def _fingerprint(fb: FeedbackModel) -> tuple:
    return (fb.total, round(sum(e.weight for e in fb.events), 2))


def _train(fb: FeedbackModel):
    from sklearn.ensemble import RandomForestClassifier

    X = [vector(e.lead) for e in fb.events]
    y = [1 if e.approved else 0 for e in fb.events]
    w = [0.5 + e.weight for e in fb.events]  # recent swipes count more
    model = RandomForestClassifier(
        n_estimators=settings.RF_TREES, max_depth=5, min_samples_leaf=2,
        class_weight="balanced", random_state=42, n_jobs=1,
    )
    model.fit(X, y, sample_weight=w)
    importances = sorted(zip(FEATURE_NAMES, model.feature_importances_), key=lambda kv: kv[1], reverse=True)
    return model, importances


class RandomForestRanker(Ranker):
    """Learns P(approve) from the user's own swipes and blends it with the
    baseline. The blend leans on the model more as the history grows."""

    name, label = "random_forest", "Random forest (learned from your swipes)"

    def __init__(self, fallback: Ranker):
        self.fallback = fallback
        self.importances: List[tuple] = []
        self.trained_on = 0

    def rank(self, leads, ctx):
        leads = self.fallback.rank(leads, ctx)
        fb = ctx.feedback
        email = ctx.user["email"]
        try:
            fp = _fingerprint(fb)
            with _models_lock:
                cached = _models.get(email)
            if not cached or cached[0] != fp:
                model, importances = _train(fb)
                cached = (fp, model, importances)
                with _models_lock:
                    _models[email] = cached
            _, model, self.importances = cached
            self.trained_on = fb.total
        except Exception as e:  # never break ranking because of the model
            log.warning("Random forest unavailable, using baseline: %s", e)
            return leads

        approve_col = list(model.classes_).index(1)
        probs = model.predict_proba([vector(l) for l in leads])[:, approve_col]
        alpha = min(0.7, fb.total / 40)
        for l, p in zip(leads, probs):
            delta = alpha * (float(p) - l["score"])
            l["score"] += delta
            l["model_probability"] = round(float(p), 3)
            _add(l, "Random forest (your swipes)", delta)
        top = ", ".join(n for n, _ in self.importances[:3])
        ctx.notes.append(f"Random forest trained on {fb.total} swipes; it weighs {top} most")
        return leads

    def describe(self):
        return [{
            "name": self.name,
            "label": self.label,
            "trained_on": self.trained_on,
            "top_features": [{"feature": n, "importance": round(float(v), 3)} for n, v in self.importances[:5]],
        }]


def base_ranker(fb: FeedbackModel) -> Ranker:
    """Strategy selection for the base model."""
    static = StaticFitRanker()
    return RandomForestRanker(static) if fb.trainable else static


def forget_model(email: str) -> None:
    with _models_lock:
        _models.pop(email, None)


__all__ = ["RankContext", "Ranker", "StaticFitRanker", "RandomForestRanker", "base_ranker", "forget_model", "_add"]
