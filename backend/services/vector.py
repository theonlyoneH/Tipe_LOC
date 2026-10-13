"""Pinecone access (integrated-embedding index). Optional: degrades to no hits."""
from typing import Dict, List, Optional

from starlette.concurrency import run_in_threadpool

from core.config import log, settings

_index = None
_init_failed = False

# namespace -> human label
NAMESPACE_LABELS: Dict[str, str] = {
    "exporters": "Exporter",
    "importers": "Importer",
    "globalnews": "News",
}

_KEYWORDS = {
    "exporters": ["exporter", "export", "supplier", "manufacturer", "seller", "vendor"],
    "importers": ["importer", "import", "buyer", "procurement", "purchaser", "distributor"],
    "globalnews": ["news", "trade", "market", "tariff", "policy", "sanction", "price", "demand"],
}


def _get_index():
    global _index, _init_failed
    if _index is not None or _init_failed:
        return _index
    if not (settings.PINECONE_API_KEY and settings.PINECONE_INDEX):
        _init_failed = True
        return None
    try:
        from pinecone import Pinecone

        _index = Pinecone(api_key=settings.PINECONE_API_KEY).Index(settings.PINECONE_INDEX)
    except Exception as e:
        log.warning("Pinecone unavailable: %s", e)
        _init_failed = True
    return _index


def detect_namespaces(query: str) -> List[str]:
    q = query.lower()
    matched = [ns for ns, kws in _KEYWORDS.items() if ns in settings.PINECONE_NAMESPACES and any(k in q for k in kws)]
    return matched or list(settings.PINECONE_NAMESPACES)


def _search_sync(query: str, namespaces: List[str], top_k: int) -> List[dict]:
    index = _get_index()
    if index is None or not query.strip():
        return []
    hits: List[dict] = []
    for ns in namespaces:
        try:
            res = index.search(namespace=ns, query={"inputs": {"text": query}, "top_k": top_k})
            for h in res.get("result", {}).get("hits", []):
                h = dict(h)
                h["_namespace"] = ns
                h["_record_type"] = NAMESPACE_LABELS.get(ns, ns)
                hits.append(h)
        except Exception as e:
            log.warning("Pinecone search failed in %s: %s", ns, e)
    hits.sort(key=lambda h: h.get("_score", 0), reverse=True)
    return hits


async def search(query: str, namespaces: Optional[List[str]] = None, top_k: Optional[int] = None) -> List[dict]:
    return await run_in_threadpool(
        _search_sync, query, namespaces or detect_namespaces(query), top_k or settings.PINECONE_TOP_K
    )
