"""Company discovery from Wikidata (CC0 open data, all countries).

1. Resolve the user's free-text industry to Wikidata industry items, keeping only
   items companies actually use as their industry (P452).
2. Pull active companies in those industries (incl. sub-industries) that have a
   website or LinkedIn page, with size, revenue (USD), LEI and HQ city.
"""
from typing import Dict, List, Tuple

from core.config import log, settings

from ..common import canon_country, get

SPARQL = "https://query.wikidata.org/sparql"
API = "https://www.wikidata.org/w/api.php"

# Extra search phrases per industry family (matched by substring of the user's industry).
SEARCH_HINTS: Dict[str, List[str]] = {
    "textile": ["textile industry", "clothing industry"],
    "apparel": ["clothing industry", "textile industry"],
    "garment": ["clothing industry"],
    "pharma": ["pharmaceutical industry"],
    "medical": ["medical device", "medical technology"],
    "auto": ["automotive industry", "automotive parts"],
    "electronic": ["electronics industry", "semiconductor industry"],
    "semiconductor": ["semiconductor industry"],
    "chemical": ["chemical industry"],
    "machine": ["machine industry", "mechanical engineering"],
    "engineering": ["mechanical engineering", "machine industry"],
    "solar": ["photovoltaics", "solar power"],
    "renewable": ["renewable energy", "photovoltaics"],
    "software": ["software industry", "information technology"],
    "it ": ["information technology", "software industry"],
    "steel": ["iron and steel industry", "steel"],
    "metal": ["metal industry", "iron and steel industry"],
    "food": ["food industry", "food processing"],
    "agri": ["agriculture", "agribusiness"],
    "furniture": ["furniture industry"],
    "plastic": ["plastics industry"],
    "paper": ["pulp and paper industry"],
    "leather": ["leather industry"],
}


def _sparql(query: str) -> List[dict]:
    r = get(SPARQL, params={"query": query}, headers={"Accept": "application/sparql-results+json"},
            min_interval=1.0, timeout=80)
    r.raise_for_status()
    return r.json()["results"]["bindings"]


def _search(term: str) -> List[str]:
    r = get(API, params={"action": "wbsearchentities", "search": term, "language": "en", "type": "item",
                         "limit": 6, "format": "json"}, min_interval=0.3)
    r.raise_for_status()
    return [x["id"] for x in r.json().get("search", [])]


def resolve_industry(industry: str) -> List[Tuple[str, int]]:
    """Wikidata industry QIDs (with company counts) for a free-text industry."""
    ind = industry.lower().strip()
    phrases = [f"{ind} industry", ind]
    for key, hints in SEARCH_HINTS.items():
        if key in f"{ind} ":
            phrases.extend(hints)
    candidates: List[str] = []
    for p in dict.fromkeys(phrases):
        try:
            candidates.extend(_search(p))
        except Exception as e:
            log.warning("Wikidata search failed for %r: %s", p, e)
    candidates = list(dict.fromkeys(candidates))[:24]
    if not candidates:
        return []
    values = " ".join(f"wd:{c}" for c in candidates)
    rows = _sparql(
        f"SELECT ?ind (COUNT(DISTINCT ?c) AS ?n) WHERE {{ VALUES ?ind {{ {values} }} ?c wdt:P452 ?ind . }} "
        "GROUP BY ?ind ORDER BY DESC(?n)"
    )
    used = [(r["ind"]["value"].rsplit("/", 1)[-1], int(r["n"]["value"])) for r in rows]
    return [(q, n) for q, n in used if n >= 10][:4]


_QUERY = """
SELECT ?c ?cLabel ?cDescription ?countryLabel ?employees ?website ?linkedin ?lei {rev_sel} WHERE {{
  ?c wdt:P452/wdt:P279* wd:{qid} ; wdt:P17 ?country .
  FILTER NOT EXISTS {{ ?c wdt:P576 [] }}
  FILTER NOT EXISTS {{ ?country wdt:P576 [] }}
  {{ ?c wdt:P856 ?website }} UNION {{ ?c wdt:P4264 ?linkedin }}
  OPTIONAL {{ ?c wdt:P1128 ?employees }}
  OPTIONAL {{ ?c wdt:P1278 ?lei }}
  {rev}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "{langs}". }}
}} LIMIT {limit}"""
_REVENUE = "OPTIONAL { ?c p:P2139/psv:P2139 [ wikibase:quantityAmount ?revenue; wikibase:quantityUnit wd:Q4917 ] }"


def _rows_for(qid: str) -> List[dict]:
    """One industry per query keeps Wikidata well under its 60s limit; on a
    timeout retry once with a lighter query (no revenue, fewer label languages)."""
    limit = settings.SCRAPE_MAX_COMPANIES * 3
    try:
        return _sparql(_QUERY.format(qid=qid, rev=_REVENUE, rev_sel="?revenue", langs="en,mul,de,fr,es", limit=limit))
    except Exception as e:
        log.warning("Wikidata query for %s failed (%s), retrying light", qid, e)
        return _sparql(_QUERY.format(qid=qid, rev="", rev_sel="", langs="en,mul", limit=limit))


def fetch_companies(qids: List[str]) -> List[dict]:
    rows: List[dict] = []
    for qid in qids:
        try:
            rows.extend(_rows_for(qid))
        except Exception as e:
            log.warning("Skipping industry %s: %s", qid, e)
    if not rows and qids:
        raise RuntimeError("Wikidata did not return any companies (service busy?)")

    companies: Dict[str, dict] = {}
    for r in rows:
        qid = r["c"]["value"].rsplit("/", 1)[-1]
        name = r.get("cLabel", {}).get("value", "")
        country = canon_country(r.get("countryLabel", {}).get("value", ""))
        if not name or name == qid or not country:
            continue
        c = companies.setdefault(qid, {
            "source": "Wikidata",
            "source_id": f"wikidata:{qid}",
            "source_url": f"https://www.wikidata.org/wiki/{qid}",
            "name": name,
            "description": r.get("cDescription", {}).get("value", ""),
            "country": country,
            "city": "",
            "website": "",
            "linkedin": "",
            "employees": 0,
            "revenue_usd": 0.0,
            "lei": "",
        })
        v = lambda k: r.get(k, {}).get("value", "")
        if not c["website"] and v("website"):
            c["website"] = v("website")
        if not c["linkedin"] and v("linkedin"):
            c["linkedin"] = f"https://www.linkedin.com/company/{v('linkedin')}"
        if not c["lei"] and v("lei"):
            c["lei"] = v("lei")
        try:
            c["employees"] = max(c["employees"], int(float(v("employees") or 0)))
            c["revenue_usd"] = max(c["revenue_usd"], float(v("revenue") or 0))
        except ValueError:
            pass
    out = list(companies.values())
    # Most contactable first, then largest.
    out.sort(key=lambda c: (bool(c["website"]), bool(c["linkedin"]), c["employees"]), reverse=True)
    return out[: settings.SCRAPE_MAX_COMPANIES]
