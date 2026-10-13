from datetime import datetime
from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient

from .config import log, settings

client = AsyncIOMotorClient(settings.MONGO_DETAILS, serverSelectionTimeoutMS=8000)
db = client[settings.MONGO_DB]

users = db.get_collection("users")
importers = db.get_collection("importers")
exporters = db.get_collection("exporters")
# Legacy name kept for backward compatibility: it now stores every swipe
# decision (approved / rejected / skipped), keyed by user_email + lead_id.
decisions = db.get_collection("approved_leads")
conversations = db.get_collection("conversations")
messages = db.get_collection("messages")
meetings = db.get_collection("meetings")
content_posts = db.get_collection("content_posts")
# Real companies gathered by the scraper (see backend/scraper/), one doc per company+industry.
scraped_leads = db.get_collection("scraped_leads")
scrape_jobs = db.get_collection("scrape_jobs")


async def ensure_indexes() -> None:
    specs = [
        (users, "email", {"unique": True}),
        (decisions, [("user_email", 1), ("lead_id", 1)], {}),
        (decisions, [("user_email", 1), ("status", 1)], {}),
        (conversations, [("user_email", 1), ("updated_at", -1)], {}),
        (conversations, [("user_email", 1), ("lead_id", 1)], {}),
        (messages, [("conversation_id", 1), ("created_at", 1)], {}),
        (meetings, [("user_email", 1), ("date", 1)], {}),
        (content_posts, [("user_email", 1), ("created_at", -1)], {}),
        (importers, "Industry", {}),
        (scraped_leads, [("industry_key", 1), ("source_id", 1)], {"unique": True}),
        (scraped_leads, [("industry_key", 1), ("rank", -1)], {}),
        (scrape_jobs, "industry_key", {"unique": True}),
    ]
    # Independently, so one failing index (e.g. legacy duplicates) doesn't skip the rest.
    for coll, keys, opts in specs:
        try:
            await coll.create_index(keys, **opts)
        except Exception as e:
            log.warning("Index on %s skipped: %s", coll.name, e)


def oid(value: str) -> ObjectId:
    from .errors import not_found

    try:
        return ObjectId(value)
    except Exception:
        raise not_found("item", "INVALID_ID")


def serialize(doc: Any) -> Any:
    """Recursively convert Mongo types into JSON-friendly values."""
    if isinstance(doc, list):
        return [serialize(d) for d in doc]
    if isinstance(doc, dict):
        out = {}
        for k, v in doc.items():
            key = "id" if k == "_id" else k
            out[key] = serialize(v)
        return out
    if isinstance(doc, ObjectId):
        return str(doc)
    if isinstance(doc, datetime):
        return doc.isoformat() + "Z"
    return doc
