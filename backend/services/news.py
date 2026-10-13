"""Live trade news: fetch, classify (countries + opportunity/risk) and cache.

The classified articles drive both the ticker in the UI and the dynamic lead
ranking (see services/ranking/).
"""
import hashlib
import math
import re
import time
from calendar import timegm
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Dict, List, Optional
from urllib.parse import quote_plus

import feedparser
import requests
from starlette.concurrency import run_in_threadpool

from core.config import log, settings

# ---------------------------------------------------------------------------
# Reference data
# ---------------------------------------------------------------------------

# Canonical country -> aliases that appear in headlines.
COUNTRY_ALIASES: Dict[str, List[str]] = {
    "USA": ["united states", "u.s.", "usa", "america", "american", "washington"],
    "UK": ["united kingdom", "britain", "british", "uk", "england", "london"],
    "China": ["china", "chinese", "beijing"],
    "India": ["india", "indian", "new delhi", "modi"],
    "Germany": ["germany", "german", "berlin"],
    "France": ["france", "french", "paris"],
    "Japan": ["japan", "japanese", "tokyo"],
    "South Korea": ["south korea", "korean", "seoul"],
    "Canada": ["canada", "canadian", "ottawa"],
    "Mexico": ["mexico", "mexican"],
    "Brazil": ["brazil", "brazilian"],
    "Australia": ["australia", "australian"],
    "Netherlands": ["netherlands", "dutch", "rotterdam", "amsterdam"],
    "Italy": ["italy", "italian"],
    "Spain": ["spain", "spanish"],
    "UAE": ["uae", "united arab emirates", "dubai", "abu dhabi", "emirati"],
    "Saudi Arabia": ["saudi", "riyadh"],
    "Singapore": ["singapore"],
    "Vietnam": ["vietnam", "vietnamese"],
    "Indonesia": ["indonesia", "indonesian"],
    "Turkey": ["turkey", "turkish", "türkiye"],
    "Russia": ["russia", "russian", "moscow", "kremlin"],
    "Poland": ["poland", "polish"],
    "Sweden": ["sweden", "swedish"],
    "Switzerland": ["switzerland", "swiss"],
    "South Africa": ["south africa"],
    "Bangladesh": ["bangladesh"],
    "Thailand": ["thailand", "thai"],
    "Malaysia": ["malaysia", "malaysian"],
    "Egypt": ["egypt", "egyptian"],
    "Nigeria": ["nigeria", "nigerian"],
    "Israel": ["israel", "israeli"],
    "Iran": ["iran", "iranian"],
    "Ukraine": ["ukraine", "ukrainian"],
}

# Regional terms that should touch several countries.
REGION_COUNTRIES: Dict[str, List[str]] = {
    "european union": ["Germany", "France", "Italy", "Spain", "Netherlands", "Poland", "Sweden"],
    "eu": ["Germany", "France", "Italy", "Spain", "Netherlands", "Poland", "Sweden"],
    "europe": ["Germany", "France", "Italy", "Spain", "Netherlands", "Poland", "Sweden", "UK"],
    "gulf": ["UAE", "Saudi Arabia"],
    "middle east": ["UAE", "Saudi Arabia", "Israel", "Egypt"],
    "asean": ["Singapore", "Vietnam", "Indonesia", "Thailand", "Malaysia"],
    "southeast asia": ["Singapore", "Vietnam", "Indonesia", "Thailand", "Malaysia"],
    "latin america": ["Brazil", "Mexico"],
}

OPPORTUNITY_TERMS = {
    "surge": 0.6, "growth": 0.5, "grow": 0.4, "boom": 0.6, "record": 0.4, "demand": 0.5,
    "deal": 0.5, "agreement": 0.6, "free trade": 0.8, "fta": 0.8, "pact": 0.5, "partnership": 0.4,
    "expand": 0.4, "expansion": 0.4, "investment": 0.4, "invest": 0.3, "rebound": 0.5, "recovery": 0.4,
    "eases": 0.4, "lifts": 0.5, "cut tariffs": 0.8, "tariff cut": 0.8, "subsid": 0.4, "incentive": 0.4,
    "rises": 0.3, "jumps": 0.4, "soars": 0.5, "strong": 0.3, "order": 0.3, "shortage": 0.4,
    "diversif": 0.6, "china plus one": 0.8, "reshoring": 0.4, "nearshoring": 0.4, "approval": 0.3,
}
RISK_TERMS = {
    "ban": 0.7, "sanction": 0.8, "war": 0.8, "conflict": 0.6, "crisis": 0.6, "recession": 0.6,
    "slump": 0.5, "decline": 0.4, "falls": 0.3, "plunge": 0.6, "slowdown": 0.5, "strike": 0.4,
    "shutdown": 0.5, "default": 0.6, "inflation": 0.3, "disruption": 0.5, "blockade": 0.7,
    "embargo": 0.8, "probe": 0.4, "anti-dumping": 0.7, "duty": 0.3, "restriction": 0.5,
    "weak": 0.3, "layoff": 0.4, "bankrupt": 0.7, "attack": 0.5, "delay": 0.3,
}
# Tariff news is two-sided: it hurts the targeted exporter but pushes buyers to
# diversify suppliers. Ranking treats it specially.
TARIFF_TERMS = ["tariff", "duty", "duties", "levy", "trade war", "customs"]

# Extra vocabulary per industry family, matched by substring against the
# user's industry so new industries still work via their own name.
INDUSTRY_SYNONYMS: Dict[str, List[str]] = {
    "textile": ["textile", "fabric", "cotton", "yarn", "garment", "apparel", "knitwear", "denim", "silk", "polyester"],
    "pharma": ["pharma", "drug", "medicine", "biotech", "vaccine", "generic drug", "fda", "healthcare"],
    "medical": ["medical device", "medtech", "diagnostic", "hospital", "healthcare", "fda", "implant"],
    "auto": ["auto", "automotive", "vehicle", "cars", "electric vehicle", "auto parts", "battery", "tyre"],
    "electronic": ["electronics", "semiconductor", "chip", "pcb", "smartphone", "display", "consumer electronics"],
    "chemical": ["chemical", "petrochemical", "polymer", "resin", "plastic", "fertilizer", "coating"],
    "machinery": ["machinery", "machine tool", "industrial equipment", "capital goods", "pump", "compressor"],
    "engineering": ["engineering goods", "engineering", "capital goods", "fabrication", "industrial"],
    "solar": ["solar", "photovoltaic", "pv module", "renewable", "clean energy", "green energy"],
    "software": ["software", "it services", "saas", "cloud", "outsourcing", "digital"],
    "it": ["software", "it services", "saas", "cloud", "outsourcing", "tech"],
    "agri": ["agriculture", "crop", "wheat", "rice", "grain", "harvest", "farm"],
    "food": ["food", "dairy", "seafood", "spices", "edible oil", "sugar", "tea", "coffee"],
    "steel": ["steel", "iron", "metal", "alloy", "aluminium", "aluminum", "scrap"],
}

GENERIC_TRADE_TERMS = ["export", "import", "trade", "tariff", "supply chain", "shipping", "customs", "buyer"]


def industry_terms(industry: str) -> List[str]:
    ind = (industry or "").lower().strip()
    terms = set()
    if ind:
        terms.add(ind)
        terms.update(w for w in re.split(r"[^a-z]+", ind) if len(w) > 2)
    for key, words in INDUSTRY_SYNONYMS.items():
        if (has_term(ind, key) if len(key) <= 2 else key in ind):
            terms.update(words)
    return sorted(terms)


def _industry_query(industry: str) -> str:
    base = (industry or "global").strip()
    return f'"{base}" (export OR import OR tariff OR trade OR demand)'


# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------

_pattern_cache: Dict[str, "re.Pattern"] = {}


def has_term(text: str, term: str) -> bool:
    """Word-boundary match. Short terms must match a whole word; longer ones
    may be stems (e.g. "subsid" matches "subsidy")."""
    pat = _pattern_cache.get(term)
    if pat is None:
        esc = re.escape(term)
        pat = re.compile(rf"(?<![a-z]){esc}(?![a-z])" if len(term) <= 4 else rf"(?<![a-z]){esc}")
        _pattern_cache[term] = pat
    return pat.search(text) is not None


def detect_countries(text: str) -> List[str]:
    t = text.lower()
    found = {c for c, aliases in COUNTRY_ALIASES.items() if any(has_term(t, a) for a in aliases)}
    for region, countries in REGION_COUNTRIES.items():
        if has_term(t, region):
            found.update(countries)
    # "US" is only unambiguous before lower-casing (vs. the pronoun "us").
    if re.search(r"(?<![A-Za-z])US(?![A-Za-z])", text):
        found.add("USA")
    return sorted(found)


def classify(headline: str, summary: str, industry: str, published_ts: Optional[float]) -> dict:
    text = f"{headline} {summary}".lower()
    opp = sum(w for term, w in OPPORTUNITY_TERMS.items() if has_term(text, term))
    risk = sum(w for term, w in RISK_TERMS.items() if has_term(text, term))
    tariff = any(has_term(text, term) for term in TARIFF_TERMS)

    polarity = math.tanh(opp - risk)  # -1 (risk) .. +1 (opportunity)
    if polarity > 0.15:
        signal = "opportunity"
    elif polarity < -0.15:
        signal = "risk"
    else:
        signal = "neutral"
    if tariff:
        signal = "tariff" if signal != "opportunity" else signal

    terms = industry_terms(industry)
    ind_hits = sum(1 for t in terms if has_term(text, t))
    trade_hits = sum(1 for t in GENERIC_TRADE_TERMS if has_term(text, t))
    relevance = min(1.0, 0.25 * ind_hits + 0.12 * trade_hits)

    age_hours = max(0.0, (time.time() - published_ts) / 3600) if published_ts else 24.0
    recency = math.exp(-age_hours / 48)  # half-life ~33h

    score = 0.35 + 0.35 * relevance + 0.2 * min(1.0, abs(polarity) + (0.3 if tariff else 0)) + 0.1 * recency
    score = round(min(score, 0.99), 2)

    return {
        "countries": detect_countries(f"{headline} {summary}"),
        "signal": signal,
        "polarity": round(polarity, 3),
        "tariff": tariff,
        "relevance": round(relevance, 3),
        "recency": round(recency, 3),
        "trade_signal_score": score,
        "importance_tag": "High Impact" if score >= 0.75 else "Moderate" if score >= 0.6 else "Low",
    }


# ---------------------------------------------------------------------------
# Fetching + cache
# ---------------------------------------------------------------------------

_cache: Dict[str, tuple] = {}  # industry -> (expires_at, articles)
_pool = ThreadPoolExecutor(max_workers=4)
_http = requests.Session()
_http.headers["User-Agent"] = "Mozilla/5.0 (TIPE trade-intel bot)"


def _fetch_feed(url: str) -> list:
    try:
        r = _http.get(url, timeout=8)
        r.raise_for_status()
        return feedparser.parse(r.content).entries
    except Exception as e:
        log.warning("News feed failed %s: %s", url, e)
        return []


def _strip_html(s: str) -> str:
    return re.sub(r"<[^>]+>", " ", s or "").replace("&nbsp;", " ").strip()


def _build(industry: str) -> List[dict]:
    feeds = [settings.NEWS_SEARCH_FEED.format(query=quote_plus(_industry_query(industry)))]
    feeds.append(settings.NEWS_SEARCH_FEED.format(query=quote_plus("global trade tariffs exports")))
    feeds.extend(settings.NEWS_EXTRA_FEEDS)

    seen = set()
    articles = []
    for url, entries in zip(feeds, _pool.map(_fetch_feed, feeds)):
        for e in entries:
            title = (e.get("title") or "").strip()
            if not title:
                continue
            source = (e.get("source") or {}).get("title") if isinstance(e.get("source"), dict) else None
            # Google News appends " - Publisher" to titles
            if " - " in title and "news.google" in url:
                title, _, pub = title.rpartition(" - ")
                source = source or pub
            key = re.sub(r"\W+", "", title.lower())[:80]
            if key in seen:
                continue
            seen.add(key)

            parsed = e.get("published_parsed") or e.get("updated_parsed")
            ts = timegm(parsed) if parsed else None
            summary = _strip_html(e.get("summary", ""))[:400]
            info = classify(title, summary, industry, ts)
            articles.append({
                "id": hashlib.md5((e.get("link") or title).encode()).hexdigest()[:12],
                "headline": title,
                "url": e.get("link", ""),
                "source": source or re.sub(r"^https?://(www\.)?([^/]+).*", r"\2", url),
                "published": datetime.fromtimestamp(ts, tz=timezone.utc).isoformat() if ts else None,
                "summary": summary,
                **info,
                # Kept for backward compatibility with the old ticker shape.
                "ai_analysis": {
                    "trade_signal_score": info["trade_signal_score"],
                    "importance_tag": info["importance_tag"],
                },
            })

    articles.sort(key=lambda a: (a["trade_signal_score"], a["recency"]), reverse=True)
    return articles[: settings.NEWS_MAX_ARTICLES]


async def get_news(industry: str) -> List[dict]:
    key = (industry or "default").lower()
    hit = _cache.get(key)
    now = time.time()
    if hit and hit[0] > now:
        return hit[1]
    articles = await run_in_threadpool(_build, industry)
    if articles or not hit:
        _cache[key] = (now + settings.NEWS_CACHE_SECONDS, articles)
        return articles
    # Feeds failed: serve stale data for a short while instead of nothing.
    _cache[key] = (now + 60, hit[1])
    return hit[1]
