"""Standalone scraper worker.

    python -m scraper.worker --once                 # refresh every stale industry, then exit (cron)
    python -m scraper.worker --loop --interval 3600 # keep running (background worker)
    python -m scraper.worker --industry "Textiles"  # one industry now

Industries come from registered users' profiles plus SCRAPE_INDUSTRIES.
"""
import argparse
import asyncio
import logging

from core import db
from core.config import log, settings

from . import pipeline


async def industries_to_refresh(force: bool = False) -> list:
    names = {i.strip() for i in settings.SCRAPE_INDUSTRIES if i.strip()}
    demo = set(settings.DEMO_USER_EMAILS)
    async for u in db.users.find({}, {"industry": 1, "email": 1}):
        if u.get("industry") and u.get("email", "").lower() not in demo:
            names.add(u["industry"].strip())
    by_key = {pipeline.industry_key(n): n for n in names}
    out = []
    for key, name in sorted(by_key.items()):
        job = await db.scrape_jobs.find_one({"industry_key": key})
        if force or pipeline.is_stale(job):
            out.append(name)
    return out


async def run_once(force: bool = False, only: str = "") -> None:
    await db.ensure_indexes()
    targets = [only] if only else await industries_to_refresh(force)
    log.info("Scraping %d industries: %s", len(targets), targets)
    for name in targets:
        await pipeline.run_industry(name, settings.SCRAPE_ENRICH_PER_RUN)
    # Use spare time to keep enriching the backlog of fresh industries too.
    if not only:
        async for job in db.scrape_jobs.find({"status": "done"}):
            await pipeline.enrich(job.get("industry", job["industry_key"]), settings.SCRAPE_ENRICH_PER_RUN // 2)


async def run_loop(interval: int) -> None:
    while True:
        try:
            await run_once()
        except Exception:
            log.exception("Scraper cycle failed")
        await asyncio.sleep(interval)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    p = argparse.ArgumentParser(description="TIPE lead scraper")
    p.add_argument("--once", action="store_true", help="refresh stale industries and exit")
    p.add_argument("--loop", action="store_true", help="run forever")
    p.add_argument("--interval", type=int, default=3600, help="seconds between cycles in --loop mode")
    p.add_argument("--industry", default="", help="scrape a single industry now")
    p.add_argument("--force", action="store_true", help="ignore freshness and re-scrape everything")
    a = p.parse_args()
    if a.loop:
        asyncio.run(run_loop(a.interval))
    else:
        asyncio.run(run_once(force=a.force or bool(a.industry), only=a.industry))


if __name__ == "__main__":
    main()
