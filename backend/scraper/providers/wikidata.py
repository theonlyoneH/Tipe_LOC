"""Company discovery from Wikidata (CC0 open data, all countries).

1. Resolve the user's free-text industry to Wikidata industry items, keeping only
   items companies actually use as their industry (P452).
2. Pull active companies in those industries (incl. sub-industries) that have a
   website or LinkedIn page, with size, revenue (USD), LEI and HQ city.
3. Pull likely buyers for exporters: distributors of the industry's products and
   companies in the downstream industries that consume them.
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

# Who buys from an industry: downstream industries that consume its output
# (Wikidata industry QID, label). Exporters are matched with these instead of
# with their own industry's producers, who are competitors, not customers.
_RETAIL = ("Q126793", "retail")
_RETAIL_CHAIN = ("Q507619", "retail chain")
_AUTOMOTIVE = ("Q190117", "automotive industry")
_CONSTRUCTION = ("Q385378", "construction")
_MANUFACTURING = ("Q187939", "industrial manufacturing")
_FOOD = ("Q540912", "food industry")
_HEALTH = ("Q31207", "health care")
_HEALTH_INDUSTRY = ("Q15067276", "health care industry")
_ENERGY = ("Q2151621", "energy industry")
BUYER_INDUSTRIES: Dict[str, List[Tuple[str, str]]] = {
    "textile": [("Q11828862", "clothing industry"), ("Q12684", "fashion"), _RETAIL],
    "apparel": [_RETAIL, _RETAIL_CHAIN],
    "garment": [_RETAIL, _RETAIL_CHAIN],
    "clothing": [_RETAIL, _RETAIL_CHAIN],
    "pharma": [_HEALTH, _HEALTH_INDUSTRY, ("Q614304", "pharmacy"), ("Q16917", "hospital")],
    "medical": [_HEALTH, _HEALTH_INDUSTRY, ("Q16917", "hospital")],
    "auto": [_AUTOMOTIVE, ("Q786803", "car dealership")],
    "electronic": [_AUTOMOTIVE, ("Q73768396", "consumer electronics industry"),
                   ("Q2401742", "telecommunications industry"), _RETAIL],
    "semiconductor": [_AUTOMOTIVE, ("Q73768396", "consumer electronics industry"),
                      ("Q2401742", "telecommunications industry")],
    "chemical": [("Q7202108", "plastics industry"), ("Q12752882", "cosmetics industry"),
                 ("Q507443", "pharmaceutical industry"), ("Q607081", "textile industry"),
                 ("Q11451", "agriculture"), ("Q174219", "paint")],
    "machine": [_MANUFACTURING, _CONSTRUCTION, _FOOD, ("Q44497", "mining"), _AUTOMOTIVE],
    "engineering": [_MANUFACTURING, _CONSTRUCTION, _ENERGY, ("Q44497", "mining"),
                    ("Q862571", "petroleum industry"), _AUTOMOTIVE],
    "solar": [("Q1326624", "electricity supply company"), ("Q2316331", "electric power industry"),
              _ENERGY, _CONSTRUCTION],
    "renewable": [("Q1326624", "electricity supply company"), ("Q2316331", "electric power industry"), _ENERGY],
    "software": [("Q837171", "financial services"), ("Q2401742", "telecommunications industry"),
                 ("Q43183", "insurance"), _RETAIL, _HEALTH],
    "it ": [("Q837171", "financial services"), ("Q2401742", "telecommunications industry"),
            ("Q43183", "insurance"), _RETAIL, _HEALTH],
    "steel": [_CONSTRUCTION, _AUTOMOTIVE, ("Q474200", "shipbuilding"), _MANUFACTURING,
              ("Q3565868", "rail transport")],
    "metal": [_CONSTRUCTION, _AUTOMOTIVE, ("Q474200", "shipbuilding"), _MANUFACTURING],
    "food": [_RETAIL, _RETAIL_CHAIN],
    "agri": [_FOOD, _RETAIL],
    "furniture": [_RETAIL, _CONSTRUCTION],
    "plastic": [_AUTOMOTIVE, _FOOD, ("Q12752882", "cosmetics industry")],
    "paper": [_FOOD, _RETAIL],
    "leather": [("Q11828862", "clothing industry"), ("Q12684", "fashion"), _AUTOMOTIVE],
}
# Businesses whose job is buying goods to resell (wholesale, distribution).
RESELLER_QIDS = ["Q220695", "Q106580690", "Q60614978", "Q867147"]


def buyer_industries(industry: str) -> List[Tuple[str, str]]:
    """Downstream (buyer) industries for a free-text industry; retail when unknown."""
    ind = f"{industry.lower().strip()} "
    out: Dict[str, str] = {}
    for key, items in BUYER_INDUSTRIES.items():
        if key in ind:
            out.update(dict(items))
    return list(out.items()) or [_RETAIL]


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


def _rows_for(qid: str, limit: int = 0) -> List[dict]:
    """One industry per query keeps Wikidata well under its 60s limit; on a
    timeout retry once with a lighter query (no revenue, fewer label languages)."""
    limit = limit or settings.SCRAPE_MAX_COMPANIES * 3
    try:
        return _sparql(_QUERY.format(qid=qid, rev=_REVENUE, rev_sel="?revenue", langs="en,mul,de,fr,es", limit=limit))
    except Exception as e:
        log.warning("Wikidata query for %s failed (%s), retrying light", qid, e)
        return _sparql(_QUERY.format(qid=qid, rev="", rev_sel="", langs="en,mul", limit=limit))


_RESELLER_QUERY = """
SELECT ?c ?cLabel ?cDescription ?countryLabel ?employees ?website ?linkedin ?lei WHERE {{
  VALUES ?r {{ {resellers} }}
  {{ ?c wdt:P452 ?r }} UNION {{ ?c wdt:P31 ?r }}
  ?c wdt:P17 ?country ; schema:description ?d .
  FILTER(LANG(?d) = "en" && CONTAINS(LCASE(?d), "{term}"))
  FILTER NOT EXISTS {{ ?c wdt:P576 [] }}
  {{ ?c wdt:P856 ?website }} UNION {{ ?c wdt:P4264 ?linkedin }}
  OPTIONAL {{ ?c wdt:P1128 ?employees }}
  OPTIONAL {{ ?c wdt:P1278 ?lei }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en,mul". }}
}} LIMIT 500"""


def fetch_buyers(industry: str) -> List[dict]:
    """Companies likely to buy from this industry: distributors/wholesalers of its
    products plus companies in its downstream industries, balanced per industry."""
    term = industry.lower().split()[0].rstrip("s") if industry.strip() else ""
    out: Dict[str, dict] = {}
    if len(term) >= 3:
        try:
            resellers = _sparql(_RESELLER_QUERY.format(resellers=" ".join(f"wd:{q}" for q in RESELLER_QIDS), term=term))
            for c in _merge(resellers):
                out.setdefault(c["source_id"], {**c, "buyer_type": "distributor"})
        except Exception as e:
            log.warning("Wikidata reseller query for %r failed: %s", term, e)
    targets = buyer_industries(industry)
    per = max(50, settings.SCRAPE_MAX_COMPANIES // len(targets))
    for qid, label in targets:
        try:
            rows = _rows_for(qid, limit=per * 3)
        except Exception as e:
            log.warning("Skipping buyer industry %s: %s", qid, e)
            continue
        for c in _merge(rows)[:per]:
            out.setdefault(c["source_id"], {**c, "buyer_type": label})
    return list(out.values())


def fetch_companies(qids: List[str]) -> List[dict]:
    rows: List[dict] = []
    for qid in qids:
        try:
            rows.extend(_rows_for(qid))
        except Exception as e:
            log.warning("Skipping industry %s: %s", qid, e)
    if not rows and qids:
        raise RuntimeError("Wikidata did not return any companies (service busy?)")
    return _merge(rows)[: settings.SCRAPE_MAX_COMPANIES]


def _merge(rows: List[dict]) -> List[dict]:
    """Collapse SPARQL rows (one per website/LEI/... combination) into companies."""
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
    return out
