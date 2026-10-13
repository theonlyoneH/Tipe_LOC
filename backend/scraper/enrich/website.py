"""Polite company-website enrichment.

Reads at most the homepage plus one contact page, only where robots.txt allows,
and keeps only generic role-based business emails (info@, sales@, export@ ...),
never personal addresses. Also detects whether the company describes itself as a
buyer (importer / distributor / wholesaler) or a maker (manufacturer / exporter).
"""
import re
from typing import Dict, List, Optional
from urllib import robotparser
from urllib.parse import urljoin, urlparse

from core.config import log

from ..common import USER_AGENT, domain_of, get

MAX_BYTES = 1_500_000
ROLE_PREFIXES = (
    "info", "sales", "contact", "export", "import", "purchasing", "procurement", "sourcing", "enquiries",
    "enquiry", "inquiries", "inquiry", "hello", "office", "trade", "business", "marketing", "orders", "mail",
    "international", "commercial", "service", "customerservice",
)
BUYER_TERMS = ("importer", "import ", "imports", "distributor", "distribution", "wholesale", "wholesaler",
               "retailer", "retail", "sourcing", "procurement", "purchasing", "buying office", "trading company")
MAKER_TERMS = ("manufacturer", "manufacturing", "factory", "mill", "production capacity", "producer",
               "exporter", "export", "oem", "plant")

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
TEL_RE = re.compile(r'href=["\']tel:([+\d][\d\s().-]{6,})["\']', re.I)
META_RE = re.compile(r'<meta[^>]+(?:name|property)=["\'](?:og:)?description["\'][^>]+content=["\']([^"\']{20,400})', re.I)
LINK_RE = re.compile(r'href=["\']([^"\'#]+)["\']', re.I)
TAG_RE = re.compile(r"<(script|style)[^>]*>.*?</\1>|<[^>]+>", re.S | re.I)

_robots: Dict[str, Optional[robotparser.RobotFileParser]] = {}


def _allowed(url: str) -> bool:
    parsed = urlparse(url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    if base not in _robots:
        rp = robotparser.RobotFileParser()
        try:
            r = get(f"{base}/robots.txt", timeout=8)
            rp.parse(r.text.splitlines() if r.status_code == 200 else [])
            _robots[base] = rp
        except Exception:
            _robots[base] = None  # unreachable robots.txt: treat as allowed (standard behaviour)
    rp = _robots[base]
    return True if rp is None else rp.can_fetch(USER_AGENT, url)


def _fetch(url: str) -> str:
    if not _allowed(url):
        return ""
    r = get(url, timeout=10, stream=True, allow_redirects=True)
    if r.status_code != 200 or "html" not in r.headers.get("Content-Type", "html"):
        return ""
    chunks, size = [], 0
    for chunk in r.iter_content(65536, decode_unicode=False):
        chunks.append(chunk)
        size += len(chunk)
        if size > MAX_BYTES:
            break
    r.close()
    return b"".join(chunks).decode(r.encoding or "utf-8", errors="ignore")


def _role_emails(html: str, domain: str) -> List[str]:
    out = []
    for e in EMAIL_RE.findall(html.replace("[at]", "@").replace("(at)", "@")):
        e = e.lower().strip(".")
        local, _, host = e.partition("@")
        if host.endswith((".png", ".jpg", ".svg", ".webp", ".gif")):
            continue
        if not (host == domain or host.endswith("." + domain)):
            continue
        if local.split(".")[0].split("-")[0] in ROLE_PREFIXES:
            out.append(e)
    return list(dict.fromkeys(out))


def _count(text: str, terms) -> int:
    return sum(1 for t in terms if t in text)


def enrich(url: str) -> dict:
    """Returns {} when the site is unreachable or disallows crawling."""
    if not url:
        return {}
    if "://" not in url:
        url = f"https://{url}"
    domain = domain_of(url)
    try:
        home = _fetch(url)
    except Exception as e:
        log.info("Website unreachable %s: %s", url, e)
        return {"reachable": False}
    if not home:
        return {"reachable": False}

    pages = [home]
    contact = next((urljoin(url, h) for h in LINK_RE.findall(home)
                    if re.search(r"contact|kontakt|contacto|contatti|impressum", h, re.I)
                    and domain_of(urljoin(url, h)) == domain), None)
    if contact and contact.rstrip("/") != url.rstrip("/"):
        try:
            pages.append(_fetch(contact))
        except Exception:
            pass

    html = "\n".join(pages)
    text = TAG_RE.sub(" ", html).lower()
    meta = META_RE.search(home)
    phones = [re.sub(r"\s+", " ", p).strip() for p in TEL_RE.findall(html)]
    return {
        "reachable": True,
        "emails": _role_emails(html, domain)[:3],
        "phone": phones[0] if phones else "",
        "site_description": meta.group(1).strip() if meta else "",
        "buyer_hits": _count(text, BUYER_TERMS),
        "maker_hits": _count(text, MAKER_TERMS),
    }
