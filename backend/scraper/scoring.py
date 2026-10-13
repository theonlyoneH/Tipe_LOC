"""Estimated lead scores for scraped companies.

Open data has no "intent" field, so these are transparent estimates from what we
can observe: contactability, legal verification, size, and how the company
describes itself. The ranking engine (and the user's swipes) refine them.
"""
import math


def score(doc: dict) -> dict:
    has_site = bool(doc.get("Website"))
    has_email = bool(doc.get("Email"))
    has_li = bool(doc.get("LinkedIn"))
    has_phone = bool(doc.get("Phone"))
    verified = bool(doc.get("Verified_Entity"))
    emp = doc.get("Team_Size") or 0
    buyer = min(1.0, (doc.get("Buyer_Signal") or 0) / 3)
    maker = min(1.0, (doc.get("Maker_Signal") or 0) / 3)
    size = min(1.0, math.log10(emp + 1) / 4) if emp else 0.3

    intent = 0.3 + 0.3 * max(buyer, maker * 0.6) + 0.15 * verified + 0.15 * size + (0.1 if doc.get("Reachable") else 0)
    response = 0.12 + 0.35 * has_email + 0.2 * has_li + 0.13 * has_phone + 0.1 * has_site + 0.1 * verified
    completeness = (0.25 * has_site + 0.25 * has_email + 0.15 * has_li + 0.1 * has_phone
                    + 0.1 * verified + 0.15 * bool(emp))
    rank = 100 * (0.4 * intent + 0.35 * response + 0.25 * completeness)
    return {
        "Intent_Score": round(min(1.0, intent), 3),
        "Response_Probability": round(min(1.0, response), 3),
        "Prompt_Response": round(completeness, 3),
        "rank": round(min(99.0, rank), 1),
    }
