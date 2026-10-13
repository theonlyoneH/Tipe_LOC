"""Legal-entity verification via the GLEIF LEI registry (free, no key)."""
from typing import Optional

from core.config import log

from ..common import ISO2, get

API = "https://api.gleif.org/api/v1/lei-records"


def _parse(record: dict) -> dict:
    a = record.get("attributes", {})
    entity = a.get("entity", {})
    addr = entity.get("legalAddress", {})
    return {
        "lei": a.get("lei") or record.get("id", ""),
        "legal_name": entity.get("legalName", {}).get("name", ""),
        "entity_status": entity.get("status", ""),                 # ACTIVE / INACTIVE
        "registration_status": a.get("registration", {}).get("status", ""),  # ISSUED / LAPSED ...
        "city": addr.get("city", ""),
    }


def verify(name: str, country: str, lei: str = "") -> Optional[dict]:
    """Look up by LEI when known, otherwise by exact legal name within the country."""
    try:
        if lei:
            r = get(f"{API}/{lei}", min_interval=1.1)
            if r.status_code == 200:
                return _parse(r.json()["data"])
            return None
        cc = ISO2.get(country)
        if not cc or not name:
            return None
        r = get(API, params={"filter[entity.legalName]": name, "filter[entity.legalAddress.country]": cc,
                             "page[size]": 1}, min_interval=1.1)
        if r.status_code == 200 and r.json().get("data"):
            return _parse(r.json()["data"][0])
    except Exception as e:
        log.warning("GLEIF lookup failed for %s: %s", name, e)
    return None


def is_verified(info: Optional[dict]) -> bool:
    return bool(info and info.get("entity_status") == "ACTIVE" and info.get("registration_status") in ("ISSUED", "PENDING_TRANSFER", "PENDING_ARCHIVAL"))
