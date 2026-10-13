"""Lead data access + normalisation into one stable API shape."""
import re
import time
from typing import Dict, List, Optional

from bson import ObjectId

from core import db
from core.config import settings

# Projection keeps payloads small (the source collections carry many columns).
_FIELDS = [
    "Buyer_ID", "Exporter_ID", "Seller_ID", "Company_Name", "company_name", "Name",
    "Country", "Industry", "Revenue_Size_USD", "Team_Size", "Intent_Score", "Response_Probability",
    "Prompt_Response", "Preferred_Channel", "Good_Payment_History", "Funding_Event",
    "DecisionMaker_Change", "Tariff_News", "Engagement_Spike", "Hiring_Growth", "War_Event",
    "StockMarket_Shock", "SalesNav_ProfileVisits", "Certification", "rank",
    "Email", "Contact_Email", "Phone", "Contact_Phone", "LinkedIn", "Website", "Contact_Person",
    # Scraped real-company fields (backend/scraper)
    "Source", "Source_URL", "City", "Description", "LEI", "Verified_Entity", "Buyer_Signal", "Maker_Signal",
    "Reachable", "Legal_Name",
]
PROJECTION = {f: 1 for f in _FIELDS}


def _num(v, default: float = 0.0) -> float:
    try:
        f = float(v)
        return f if f == f else default  # NaN guard
    except (TypeError, ValueError):
        return default


def _flag(doc: dict, key: str) -> bool:
    return _num(doc.get(key)) >= 1


def base_score(doc: dict, role: str = "") -> float:
    """Static fit score in 0..1 from the offline ML `rank` or the raw signals."""
    rank = _num(doc.get("rank"), -1)
    if rank > 0:
        base = min(1.0, rank / 100.0 if rank > 1 else rank)
        # Scraped companies: exporters want buyers, importers want makers.
        if doc.get("Source"):
            if role == "exporter":
                base += 0.03 * min(3, _num(doc.get("Buyer_Signal")))
            elif role == "importer":
                base += 0.03 * min(3, _num(doc.get("Maker_Signal")))
        return round(min(1.0, base), 4)
    intent = _num(doc.get("Intent_Score"))
    resp = _num(doc.get("Response_Probability"))
    prompt = _num(doc.get("Prompt_Response"))
    pay = 1.0 if _flag(doc, "Good_Payment_History") else 0.0
    return round(0.4 * intent + 0.3 * resp + 0.15 * prompt + 0.15 * pay, 4)


def _signals(doc: dict) -> List[str]:
    out = []
    if _flag(doc, "Tariff_News"):
        out.append("Exposed to tariff changes - likely diversifying suppliers")
    if _flag(doc, "Funding_Event"):
        out.append("Recent funding event")
    if _flag(doc, "DecisionMaker_Change"):
        out.append("New decision-maker in place")
    if _flag(doc, "Engagement_Spike"):
        out.append("LinkedIn engagement spike")
    if _flag(doc, "Hiring_Growth"):
        out.append("Hiring / growing team")
    if _flag(doc, "War_Event"):
        out.append("Geo-political risk flagged")
    if _flag(doc, "StockMarket_Shock"):
        out.append("Stock market sensitivity")
    if _flag(doc, "Good_Payment_History"):
        out.append("Good payment history")
    if _flag(doc, "Verified_Entity"):
        out.append("Verified active legal entity (GLEIF LEI)")
    if _num(doc.get("Buyer_Signal")) >= 1:
        out.append("Website mentions importing / distribution")
    if _num(doc.get("Maker_Signal")) >= 2:
        out.append("Manufacturer / exporter")
    if doc.get("Email"):
        out.append("Public business email found")
    visits = int(_num(doc.get("SalesNav_ProfileVisits")))
    if visits > 5000:
        out.append(f"{visits:,} Sales Navigator profile visits")
    return out


def normalize(doc: dict, role: str = "") -> dict:
    lead_id = str(doc["_id"])
    name = next(
        (doc.get(k) for k in ("Company_Name", "company_name", "Name", "Buyer_ID", "Exporter_ID", "Seller_ID") if doc.get(k)),
        f"Lead {lead_id[-6:]}",
    )
    channel = str(doc.get("Preferred_Channel") or "Email").strip()
    return {
        "id": lead_id,
        "company_name": str(name),
        "industry": doc.get("Industry") or "",
        "country": doc.get("Country") or "",
        "revenue_usd": _num(doc.get("Revenue_Size_USD")),
        "team_size": int(_num(doc.get("Team_Size"))),
        "intent_score": round(_num(doc.get("Intent_Score")), 4),
        "response_probability": round(_num(doc.get("Response_Probability")), 4),
        "prompt_response": round(_num(doc.get("Prompt_Response")), 4),
        "preferred_channel": channel,
        "certification": doc.get("Certification") or "",
        "trust_verified": _flag(doc, "Good_Payment_History") or _flag(doc, "Verified_Entity"),
        "tariff_exposed": _flag(doc, "Tariff_News"),
        "war_risk": _flag(doc, "War_Event"),
        "market_shock": _flag(doc, "StockMarket_Shock"),
        "signals": _signals(doc),
        "contact": {
            "person": doc.get("Contact_Person") or "",
            "email": doc.get("Email") or doc.get("Contact_Email") or "",
            "phone": str(doc.get("Phone") or doc.get("Contact_Phone") or ""),
            "linkedin": doc.get("LinkedIn") or "",
            "website": doc.get("Website") or "",
        },
        "base_score": base_score(doc, role),
        # Provenance: real scraped companies carry their open-data source.
        "is_real": bool(doc.get("Source")),
        "data_source": doc.get("Source") or "",
        "source_url": doc.get("Source_URL") or "",
        "city": doc.get("City") or "",
        "description": doc.get("Description") or "",
    }


# ---------------------------------------------------------------------------
# Which collection holds a user's counterparties?
# ---------------------------------------------------------------------------
_exporters_has_data: Optional[tuple] = None  # (checked_at, bool)


def is_demo(user: dict) -> bool:
    return (user.get("email") or "").lower() in settings.DEMO_USER_EMAILS


async def source_collection(user: dict):
    """Demo accounts use the bundled dataset; everyone else gets scraped real companies."""
    global _exporters_has_data
    if not is_demo(user):
        return db.scraped_leads
    if user.get("category") == "importer":
        now = time.time()
        if not _exporters_has_data or now - _exporters_has_data[0] > 600:
            has = await db.exporters.estimated_document_count() > 0
            _exporters_has_data = (now, has)
        if _exporters_has_data[1]:
            return db.exporters
    return db.importers


def industry_filter(industry: str, scraped: bool = False) -> dict:
    if not industry:
        return {}
    if scraped:
        return {"industry_key": " ".join(industry.lower().split())}
    return {"Industry": {"$regex": f"^{re.escape(industry.strip())}$", "$options": "i"}}


async def decided_ids(user_email: str) -> Dict[str, str]:
    """lead_id -> latest decision for this user."""
    out: Dict[str, str] = {}
    async for d in db.decisions.find({"user_email": user_email}, {"lead_id": 1, "status": 1}):
        out[d["lead_id"]] = d.get("status", "approved")
    return out


async def candidates(user: dict, limit: int) -> List[dict]:
    coll = await source_collection(user)
    decided = await decided_ids(user["email"])
    final_ids = [ObjectId(i) for i, s in decided.items() if s in ("approved", "rejected") and ObjectId.is_valid(i)]
    query = industry_filter(user.get("industry", ""), scraped=coll is db.scraped_leads)
    if final_ids:
        query["_id"] = {"$nin": final_ids}
    cursor = coll.find(query, PROJECTION).sort([("rank", -1), ("Intent_Score", -1)]).limit(limit)
    leads = []
    async for doc in cursor:
        lead = normalize(doc, user.get("category", ""))
        lead["skipped"] = decided.get(lead["id"]) == "skipped"
        leads.append(lead)
    return leads


async def get_lead(user: dict, lead_id: str) -> Optional[dict]:
    if not ObjectId.is_valid(lead_id):
        return None
    coll = await source_collection(user)
    doc = await coll.find_one({"_id": ObjectId(lead_id)}, PROJECTION)
    if not doc and coll is not db.importers:
        doc = await db.importers.find_one({"_id": ObjectId(lead_id)}, PROJECTION)
    return normalize(doc, user.get("category", "")) if doc else None


async def industries() -> List[str]:
    """Suggestions for the industry picker (any free-text industry also works)."""
    try:
        values = await db.importers.distinct("Industry")
        values += await db.scrape_jobs.distinct("industry")
        return sorted({str(v).strip() for v in values if v}, key=str.lower)
    except Exception:
        return []


def candidate_pool_size() -> int:
    # Rank a wider pool than we return so news can lift lower-ranked leads.
    return max(settings.LEADS_MAX * 3, 300)
