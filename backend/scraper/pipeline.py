"""Scrape pipeline: discover -> store -> enrich (GLEIF + website) -> re-score.

Used by the standalone worker (scraper/worker.py) and on demand by the API when
a newly registered user's industry has no cached leads yet.
"""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from pymongo import UpdateOne
from starlette.concurrency import run_in_threadpool

from core import db
from core.config import log, settings

from .enrich import gleif, website
from .providers import wikidata
from .scoring import score

_running: Dict[str, asyncio.Task] = {}
_pool = ThreadPoolExecutor(max_workers=6)


def industry_key(industry: str) -> str:
    return " ".join((industry or "").lower().split())


async def job_status(industry: str) -> Optional[dict]:
    return await db.scrape_jobs.find_one({"industry_key": industry_key(industry)}, {"_id": 0})


async def _set_job(key: str, **fields) -> None:
    fields["updated_at"] = datetime.utcnow()
    await db.scrape_jobs.update_one({"industry_key": key}, {"$set": fields}, upsert=True)


def _to_doc(c: dict, industry: str, key: str) -> dict:
    doc = {
        "industry_key": key,
        "Industry": industry,
        "source_id": c["source_id"],
        "Source": c["source"],
        "Source_URL": c["source_url"],
        "Company_Name": c["name"],
        "Description": c["description"],
        "Country": c["country"],
        "City": c["city"],
        "Website": c["website"],
        "LinkedIn": c["linkedin"],
        "Team_Size": c["employees"],
        "Revenue_Size_USD": c["revenue_usd"],
        "LEI": c["lei"],
        "Preferred_Channel": "Email" if c["website"] else "LinkedIn",
    }
    return doc


async def discover(industry: str) -> int:
    """Find companies for an industry and upsert them. Returns how many were stored."""
    key = industry_key(industry)
    await _set_job(key, industry=industry, status="running", stage="discovering", started_at=datetime.utcnow(), error=None)
    try:
        qids = await run_in_threadpool(wikidata.resolve_industry, industry)
        companies = await run_in_threadpool(wikidata.fetch_companies, [q for q, _ in qids])
    except Exception as e:
        log.exception("Discovery failed for %s", industry)
        await _set_job(key, status="failed", error=str(e)[:300])
        return 0

    now = datetime.utcnow()
    ops = []
    for c in companies:
        doc = _to_doc(c, industry, key)
        # Keep enrichment results from earlier runs; refresh the open-data fields.
        ops.append(UpdateOne(
            {"industry_key": key, "source_id": doc["source_id"]},
            {"$set": {**doc, "discovered_at": now},
             "$setOnInsert": {**score(doc), "enriched_at": None}},
            upsert=True,
        ))
    if ops:
        for i in range(0, len(ops), 500):
            await db.scraped_leads.bulk_write(ops[i:i + 500], ordered=False)
    total = await db.scraped_leads.count_documents({"industry_key": key})
    await _set_job(key, status="enriching", stage="enriching", found=total,
                   industry_qids=[q for q, _ in qids], discovered_at=now)
    log.info("Discovered %d companies for %s (%s)", len(companies), industry, qids)
    return len(companies)


def _enrich_one(doc: dict) -> dict:
    update: dict = {"enriched_at": datetime.utcnow()}
    site = website.enrich(doc.get("Website", "")) if doc.get("Website") else {}
    if site:
        update["Reachable"] = bool(site.get("reachable"))
        if site.get("emails"):
            update["Email"] = site["emails"][0]
            update["Other_Emails"] = site["emails"][1:]
        if site.get("phone"):
            update["Phone"] = site["phone"]
        if site.get("site_description") and not doc.get("Description"):
            update["Description"] = site["site_description"]
        update["Buyer_Signal"] = site.get("buyer_hits", 0)
        update["Maker_Signal"] = site.get("maker_hits", 0)
    info = gleif.verify(doc.get("Company_Name", ""), doc.get("Country", ""), doc.get("LEI", ""))
    if info:
        update["LEI"] = info["lei"]
        update["Verified_Entity"] = 1 if gleif.is_verified(info) else 0
        update["Legal_Name"] = info["legal_name"]
        if info.get("city") and not doc.get("City"):
            update["City"] = info["city"]
    merged = {**doc, **update}
    if update.get("Email"):
        merged["Preferred_Channel"] = update["Preferred_Channel"] = "Email"
    update.update(score(merged))
    return update


async def enrich(industry: str, limit: int) -> int:
    """Enrich the least-recently enriched companies (never-enriched first)."""
    key = industry_key(industry)
    stale = datetime.utcnow() - timedelta(days=settings.SCRAPE_ENRICH_MAX_AGE_DAYS)
    cursor = db.scraped_leads.find(
        {"industry_key": key, "$or": [{"enriched_at": None}, {"enriched_at": {"$lt": stale}}]}
    ).sort([("enriched_at", 1), ("rank", -1)]).limit(limit)
    docs = [d async for d in cursor]
    loop = asyncio.get_running_loop()
    done = 0
    # Enrich in parallel across different sites; per-host rate limits live in common.get().
    for i in range(0, len(docs), 12):
        batch = docs[i:i + 12]
        results = await asyncio.gather(*(loop.run_in_executor(_pool, _enrich_one, d) for d in batch), return_exceptions=True)
        for d, res in zip(batch, results):
            if isinstance(res, Exception):
                log.warning("Enrichment failed for %s: %s", d.get("Company_Name"), res)
                res = {"enriched_at": datetime.utcnow()}
            await db.scraped_leads.update_one({"_id": d["_id"]}, {"$set": res})
            done += 1
        await _set_job(key, enriched=await db.scraped_leads.count_documents({"industry_key": key, "enriched_at": {"$ne": None}}))
    return done


async def run_industry(industry: str, enrich_limit: int) -> None:
    key = industry_key(industry)
    try:
        found = await discover(industry)
        if found or await db.scraped_leads.count_documents({"industry_key": key}, limit=1):
            await enrich(industry, enrich_limit)
            await _set_job(key, status="done", stage="done", finished_at=datetime.utcnow())
    except Exception as e:
        log.exception("Scrape failed for %s", industry)
        await _set_job(key, status="failed", error=str(e)[:300])


def is_stale(job: Optional[dict]) -> bool:
    if not job:
        return True
    if job.get("status") in ("running", "enriching"):
        # A crashed run shouldn't block forever.
        return (datetime.utcnow() - job.get("updated_at", datetime.utcnow())) > timedelta(hours=1)
    finished = job.get("finished_at") or job.get("updated_at")
    return not finished or (datetime.utcnow() - finished) > timedelta(hours=settings.SCRAPE_TTL_HOURS)


async def ensure_fresh(industry: str) -> Optional[dict]:
    """Called by the API: start a background scrape when this industry has nothing cached."""
    key = industry_key(industry)
    if not key or not settings.SCRAPE_ON_DEMAND:
        return await job_status(industry)
    job = await job_status(industry)
    task = _running.get(key)
    if (task is None or task.done()) and is_stale(job):
        await _set_job(key, industry=industry, status="queued", stage="queued")
        _running[key] = asyncio.create_task(run_industry(industry, settings.SCRAPE_ENRICH_ON_DEMAND))
        job = await job_status(industry)
    return job
