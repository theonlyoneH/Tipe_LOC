"""Provider-agnostic LLM access with round-robin key rotation and failover.

Groq is used when GROQ_API_KEYS is set, otherwise Gemini (GEMINI_API_KEYS).
Every caller must handle `None` (no provider / all keys failed) by falling back
to deterministic output, so the product keeps working without an LLM.
"""
import itertools
import json
import re
import threading
from typing import Dict, List, Optional

import requests
from starlette.concurrency import run_in_threadpool

from core.config import log, settings

def _classify_keys():
    """Sort keys by their real provider using the key prefix, so a Groq key
    placed in GEMINI_API_KEYS (or vice versa) still works."""
    groq, gemini = [], []
    for k in settings.GROQ_API_KEYS + settings.GEMINI_API_KEYS:
        if k.startswith("gsk_"):
            groq.append(k)
        elif k.startswith("AIza"):
            gemini.append(k)
        elif k in settings.GROQ_API_KEYS:
            groq.append(k)
        else:
            gemini.append(k)
    return list(dict.fromkeys(groq)), list(dict.fromkeys(gemini))


GROQ_KEYS, GEMINI_KEYS = _classify_keys()
_lock = threading.Lock()
_groq_cycle = itertools.cycle(GROQ_KEYS) if GROQ_KEYS else None
_gemini_cycle = itertools.cycle(GEMINI_KEYS) if GEMINI_KEYS else None
_session = requests.Session()


def provider() -> Optional[str]:
    if GROQ_KEYS:
        return "groq"
    if GEMINI_KEYS:
        return "gemini"
    return None


def _next_key(cycle) -> str:
    with _lock:
        return next(cycle)


def _groq(messages: List[Dict[str, str]], max_tokens: int, temperature: float, json_mode: bool) -> str:
    body = {
        "model": settings.GROQ_MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    r = _session.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {_next_key(_groq_cycle)}"},
        json=body,
        timeout=settings.LLM_TIMEOUT_SECONDS,
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"].strip()


def _gemini(messages: List[Dict[str, str]], max_tokens: int, temperature: float, json_mode: bool) -> str:
    system = "\n".join(m["content"] for m in messages if m["role"] == "system")
    contents = [
        {"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]}
        for m in messages
        if m["role"] != "system"
    ]
    body = {
        "contents": contents,
        "generationConfig": {"maxOutputTokens": max_tokens, "temperature": temperature},
    }
    if system:
        body["systemInstruction"] = {"parts": [{"text": system}]}
    if json_mode:
        body["generationConfig"]["responseMimeType"] = "application/json"
    r = _session.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent",
        params={"key": _next_key(_gemini_cycle)},
        json=body,
        timeout=settings.LLM_TIMEOUT_SECONDS,
    )
    r.raise_for_status()
    parts = r.json()["candidates"][0]["content"]["parts"]
    return "".join(p.get("text", "") for p in parts).strip()


def complete_sync(
    messages: List[Dict[str, str]],
    max_tokens: int = 800,
    temperature: float = 0.5,
    json_mode: bool = False,
) -> Optional[str]:
    p = provider()
    if not p:
        return None
    call = _groq if p == "groq" else _gemini
    keys = GROQ_KEYS if p == "groq" else GEMINI_KEYS
    # Try each key once so a rate-limited key fails over to the next one.
    for attempt in range(len(keys)):
        try:
            return call(messages, max_tokens, temperature, json_mode)
        except Exception as e:
            log.warning("LLM %s attempt %d failed: %s", p, attempt + 1, e)
    return None


async def complete(
    messages: List[Dict[str, str]],
    max_tokens: int = 800,
    temperature: float = 0.5,
    json_mode: bool = False,
) -> Optional[str]:
    return await run_in_threadpool(complete_sync, messages, max_tokens, temperature, json_mode)


async def complete_json(messages: List[Dict[str, str]], max_tokens: int = 600) -> Optional[dict]:
    raw = await complete(messages, max_tokens=max_tokens, temperature=0.2, json_mode=True)
    if not raw:
        return None
    match = re.search(r"\{.*\}", raw, re.S)
    try:
        return json.loads(match.group(0) if match else raw)
    except Exception:
        log.warning("LLM returned non-JSON output")
        return None
