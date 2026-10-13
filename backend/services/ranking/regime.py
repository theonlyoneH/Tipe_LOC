"""Market regime detection from the live news mix.

The regime decides which ranking pipeline runs (see engine.py):
  calm   - little relevant news: trust the lead's fundamentals
  active - steady news flow: news gets a normal say
  boom   - many strong opportunity headlines: chase momentum
  shock  - many strong risk / tariff headlines: weigh news heavily, be risk-averse
"""
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List

from core.config import settings


@dataclass
class MarketRegime:
    name: str
    intensity: float          # 0..~1.5, mean strength of the strongest headlines
    risk_share: float         # share of directional headlines that are risk/tariff
    hot_countries: Dict[str, float] = field(default_factory=dict)  # country -> net polarity
    summary: str = ""

    def to_dict(self) -> dict:
        top = sorted(self.hot_countries.items(), key=lambda kv: abs(kv[1]), reverse=True)[:6]
        return {
            "name": self.name,
            "intensity": round(self.intensity, 3),
            "risk_share": round(self.risk_share, 3),
            "hot_countries": [{"country": c, "polarity": round(p, 3)} for c, p in top],
            "summary": self.summary,
        }


def _strength(a: dict) -> float:
    directional = abs(a.get("polarity", 0)) + (0.5 if a.get("tariff") else 0)
    return directional * (0.4 + 0.6 * a.get("relevance", 0)) * (0.5 + 0.5 * a.get("recency", 0.5))


def detect(articles: List[dict]) -> MarketRegime:
    if not articles:
        return MarketRegime("calm", 0.0, 0.0, summary="No live news - ranking on fundamentals")

    strengths = sorted((_strength(a) for a in articles), reverse=True)
    top = strengths[: settings.REGIME_TOP_N]
    intensity = sum(top) / max(1, settings.REGIME_TOP_N)

    directional = [a for a in articles if a.get("tariff") or abs(a.get("polarity", 0)) > 0.15]
    risky = [a for a in directional if a.get("tariff") or a.get("polarity", 0) < 0]
    risk_share = len(risky) / len(directional) if directional else 0.0

    hot: Dict[str, float] = defaultdict(float)
    for a in articles:
        for c in a.get("countries", []):
            hot[c] += (-0.5 if a.get("tariff") else a.get("polarity", 0)) * (0.5 + 0.5 * a.get("recency", 0.5))

    if intensity >= settings.REGIME_HIGH:
        if risk_share >= settings.REGIME_RISK_SHARE:
            name = "shock"
            summary = f"Risk-heavy news cycle ({round(risk_share * 100)}% risk/tariff headlines) - risk-averse ranking"
        else:
            name = "boom"
            summary = f"Strong opportunity news ({round((1 - risk_share) * 100)}% positive) - momentum ranking"
    elif intensity >= settings.REGIME_ACTIVE:
        name, summary = "active", "Steady news flow - balanced news-aware ranking"
    else:
        name, summary = "calm", "Quiet news cycle - ranking on fundamentals and your swipes"
    return MarketRegime(name, intensity, risk_share, dict(hot), summary)
