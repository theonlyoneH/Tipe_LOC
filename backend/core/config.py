"""Centralised settings. Everything tunable lives in environment variables."""
import logging
import os
from typing import List

from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger("tipe")


def _list(name: str, default: str = "") -> List[str]:
    return [v.strip() for v in os.getenv(name, default).split(",") if v.strip()]


class Settings:
    # --- Database ---
    MONGO_DETAILS: str = os.getenv("MONGO_DETAILS", "mongodb://localhost:27017")
    MONGO_DB: str = os.getenv("MONGO_DB", "proexport_db")

    # --- Auth ---
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    JWT_ALGORITHM: str = "HS256"
    TOKEN_TTL_HOURS: int = int(os.getenv("TOKEN_TTL_HOURS", "24"))

    # --- CORS ---
    ALLOWED_ORIGINS: List[str] = _list("ALLOWED_ORIGINS", "*")

    # --- LLM (Groq preferred, Gemini fallback; both optional) ---
    GROQ_API_KEYS: List[str] = _list("GROQ_API_KEYS")
    GEMINI_API_KEYS: List[str] = _list("GEMINI_API_KEYS")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    LLM_TIMEOUT_SECONDS: float = float(os.getenv("LLM_TIMEOUT_SECONDS", "30"))

    # --- Pinecone (optional) ---
    PINECONE_API_KEY: str = os.getenv("PINECONE_API_KEY", "")
    PINECONE_INDEX: str = os.getenv("PINECONE_INDEX", "")
    PINECONE_NAMESPACES: List[str] = _list("PINECONE_NAMESPACES", "exporters,importers,globalnews")
    PINECONE_TOP_K: int = int(os.getenv("PINECONE_TOP_K", "10"))

    # --- News ---
    # Google News search feed; {query} is replaced with the industry-specific query.
    NEWS_SEARCH_FEED: str = os.getenv(
        "NEWS_SEARCH_FEED",
        "https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en",
    )
    NEWS_EXTRA_FEEDS: List[str] = _list(
        "NEWS_EXTRA_FEEDS",
        "https://feeds.bbci.co.uk/news/business/rss.xml",
    )
    NEWS_CACHE_SECONDS: int = int(os.getenv("NEWS_CACHE_SECONDS", "600"))
    NEWS_MAX_ARTICLES: int = int(os.getenv("NEWS_MAX_ARTICLES", "25"))

    # --- Leads / ranking ---
    LEADS_MAX: int = int(os.getenv("LEADS_MAX", "200"))
    # News weight per market regime (see services/ranking/engine.py).
    NEWS_WEIGHTS: str = os.getenv("NEWS_WEIGHTS", "calm:0.15,active:0.30,boom:0.35,shock:0.45")

    # --- Ranking engine: market regime thresholds + learned model ---
    REGIME_TOP_N: int = int(os.getenv("REGIME_TOP_N", "8"))
    REGIME_ACTIVE: float = float(os.getenv("REGIME_ACTIVE", "0.25"))
    REGIME_HIGH: float = float(os.getenv("REGIME_HIGH", "0.42"))
    REGIME_RISK_SHARE: float = float(os.getenv("REGIME_RISK_SHARE", "0.45"))
    RF_MIN_DECISIONS: int = int(os.getenv("RF_MIN_DECISIONS", "8"))
    RF_TREES: int = int(os.getenv("RF_TREES", "80"))
    FEEDBACK_HALF_LIFE_HOURS: float = float(os.getenv("FEEDBACK_HALF_LIFE_HOURS", "72"))

    # --- Demo vs real users ---
    # These accounts see the bundled demo dataset; everyone else gets real scraped companies.
    DEMO_USER_EMAILS: List[str] = [e.lower() for e in _list("DEMO_USER_EMAILS", "test@gmail.com")]

    # --- Lead scraper (open data: Wikidata + GLEIF + company websites) ---
    SCRAPER_CONTACT: str = os.getenv("SCRAPER_CONTACT", "https://github.com/tipe-app")  # shown in our User-Agent
    SCRAPE_TTL_HOURS: float = float(os.getenv("SCRAPE_TTL_HOURS", "24"))
    SCRAPE_MAX_COMPANIES: int = int(os.getenv("SCRAPE_MAX_COMPANIES", "1500"))
    SCRAPE_ENRICH_PER_RUN: int = int(os.getenv("SCRAPE_ENRICH_PER_RUN", "120"))
    SCRAPE_ENRICH_ON_DEMAND: int = int(os.getenv("SCRAPE_ENRICH_ON_DEMAND", "25"))
    SCRAPE_ENRICH_MAX_AGE_DAYS: float = float(os.getenv("SCRAPE_ENRICH_MAX_AGE_DAYS", "14"))
    SCRAPE_INDUSTRIES: List[str] = _list("SCRAPE_INDUSTRIES")  # always keep these warm
    SCRAPE_ON_DEMAND: bool = os.getenv("SCRAPE_ON_DEMAND", "true").lower() == "true"

    # --- Outreach delivery (optional SMTP for the email channel) ---
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "")


settings = Settings()

if not settings.SECRET_KEY:
    # Never run with a guessable signing key. A random key keeps the server
    # secure but invalidates tokens on restart, so warn loudly.
    import secrets

    settings.SECRET_KEY = secrets.token_urlsafe(48)
    log.warning("SECRET_KEY not set - using a random per-process key; sessions reset on restart.")
