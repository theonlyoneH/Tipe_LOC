"""News- and feedback-driven lead ranking (strategy + decorator pattern).

See engine.py for how the pipeline is assembled.
"""
from .engine import build_pipeline, rank_leads, semantic_scores
from .features import clip, news_impact
from .feedback import REJECT_REASONS, FeedbackModel, infer_reason, load_feedback
from .rankers import forget_model
from .regime import detect as detect_regime

__all__ = [
    "build_pipeline", "rank_leads", "semantic_scores", "clip", "news_impact",
    "REJECT_REASONS", "FeedbackModel", "infer_reason", "load_feedback", "forget_model", "detect_regime",
]
