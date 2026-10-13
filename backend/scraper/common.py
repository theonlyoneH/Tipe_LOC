"""Shared scraper utilities: a polite HTTP client and country normalisation."""
import threading
import time
from typing import Dict, Optional
from urllib.parse import urlparse

import requests

from core.config import settings

USER_AGENT = f"TIPE-LeadResearch/1.0 (+{settings.SCRAPER_CONTACT})"

_session = requests.Session()
_session.headers["User-Agent"] = USER_AGENT
_last_hit: Dict[str, float] = {}
_lock = threading.Lock()


def get(url: str, *, min_interval: float = 1.0, timeout: float = 15, **kwargs) -> requests.Response:
    """GET with a per-host minimum interval so we never hammer a server."""
    host = urlparse(url).netloc
    with _lock:
        wait = _last_hit.get(host, 0) + min_interval - time.time()
        _last_hit[host] = max(time.time(), _last_hit.get(host, 0) + min_interval)
    if wait > 0:
        time.sleep(wait)
    return _session.get(url, timeout=timeout, **kwargs)


# Wikidata / registry country labels -> the names used across the app.
COUNTRY_CANON = {
    "United States": "USA", "United States of America": "USA", "United Kingdom": "UK",
    "People's Republic of China": "China", "Republic of China": "Taiwan", "Republic of Korea": "South Korea",
    "Korea, Republic of": "South Korea", "Russian Federation": "Russia", "Kingdom of the Netherlands": "Netherlands",
    "United Arab Emirates": "UAE", "Czechia": "Czech Republic", "Türkiye": "Turkey", "Viet Nam": "Vietnam",
}
SKIP_COUNTRIES = {"worldwide", "", "European Union"}

ISO2 = {
    "USA": "US", "UK": "GB", "China": "CN", "India": "IN", "Germany": "DE", "France": "FR", "Italy": "IT", "Spain": "ES",
    "Netherlands": "NL", "Belgium": "BE", "Japan": "JP", "South Korea": "KR", "Taiwan": "TW", "Canada": "CA", "Mexico": "MX",
    "Brazil": "BR", "Argentina": "AR", "Chile": "CL", "Colombia": "CO", "Peru": "PE", "Australia": "AU", "New Zealand": "NZ",
    "Switzerland": "CH", "Austria": "AT", "Sweden": "SE", "Norway": "NO", "Denmark": "DK", "Finland": "FI", "Poland": "PL",
    "Czech Republic": "CZ", "Slovakia": "SK", "Hungary": "HU", "Romania": "RO", "Bulgaria": "BG", "Greece": "GR",
    "Portugal": "PT", "Ireland": "IE", "Turkey": "TR", "Israel": "IL", "Egypt": "EG", "Morocco": "MA", "Tunisia": "TN",
    "South Africa": "ZA", "Nigeria": "NG", "Kenya": "KE", "Ethiopia": "ET", "Saudi Arabia": "SA", "UAE": "AE", "Qatar": "QA",
    "Iran": "IR", "Pakistan": "PK", "Bangladesh": "BD", "Sri Lanka": "LK", "Vietnam": "VN", "Thailand": "TH", "Malaysia": "MY",
    "Singapore": "SG", "Indonesia": "ID", "Philippines": "PH", "Hong Kong": "HK", "Russia": "RU", "Ukraine": "UA",
    "Belarus": "BY", "Estonia": "EE", "Latvia": "LV", "Lithuania": "LT", "Uzbekistan": "UZ", "Ecuador": "EC",
}


def canon_country(label: str) -> Optional[str]:
    label = (label or "").strip()
    if label in SKIP_COUNTRIES or (label.startswith("Q") and label[1:].isdigit()):
        return None
    return COUNTRY_CANON.get(label, label)


def domain_of(url: str) -> str:
    host = urlparse(url if "://" in url else f"http://{url}").netloc.lower()
    return host[4:] if host.startswith("www.") else host
