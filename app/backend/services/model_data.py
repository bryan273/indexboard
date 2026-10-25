"""Real model data for IndexBoard.

Source A: Artificial Analysis free API (only when the AA_API_KEY secret exists).
Source B: OpenRouter public model list (no key, prices and context length only).
Both upstream responses are normalized and cached in the database for 6 hours,
so the browser never calls them and the AA daily quota is protected.
"""

import json
import logging
import math
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.telemetry import observe_external_http
from models.model_data_cache import Model_data_cache

logger = logging.getLogger(__name__)

AA = "artificial_analysis"
OR = "openrouter"
AA_URL = "https://artificialanalysis.ai/api/v2/data/llms/models"
OR_URL = "https://openrouter.ai/api/v1/models"
CACHE_TTL = timedelta(hours=6)
HTTP_TIMEOUT = 25.0

SOURCE_INFO = {
    AA: {
        "label": "Artificial Analysis",
        "url": "https://artificialanalysis.ai/",
        "metrics": ["intelligence", "coding", "math", "price", "speed", "ttft"],
    },
    OR: {
        "label": "OpenRouter",
        "url": "https://openrouter.ai/",
        "metrics": ["price", "context"],
    },
}

# Family keyword -> (creator keywords, required name keyword)
FAMILIES: Dict[str, Any] = {
    "gpt": (["openai"], "gpt"),
    "chatgpt": (["openai"], "gpt"),
    "openai": (["openai"], None),
    "claude": (["anthropic"], None),
    "anthropic": (["anthropic"], None),
    "deepseek": (["deepseek"], None),
    "gemini": (["google"], "gemini"),
    "google": (["google"], "gemini"),
    "llama": (["meta"], "llama"),
    "meta": (["meta"], "llama"),
    "qwen": ([], "qwen"),
    "alibaba": ([], "qwen"),
    "mistral": (["mistral"], None),
    "grok": (["xai"], None),
    "xai": (["xai"], None),
    "kimi": ([], "kimi"),
    "moonshot": ([], "kimi"),
    "glm": ([], "glm"),
    "zhipu": ([], "glm"),
}
VARIANT_WORDS = (
    "mini", "nano", "lite", "oss", "audio", "image", "search", "realtime", "embed",
    "distill", "tts", "transcribe", "guard", "vision", "free", "batch",
)
# Smaller tiers are skipped for family keywords ("Claude", "DeepSeek") when a flagship exists.
SMALL_TIER_WORDS = ("haiku", "flash", "small", "tiny", "instant", "air", "turbo", "8b", "7b", "3b", "1b")
MAJOR_CREATORS = ("openai", "anthropic", "google", "deepseek", "meta", "qwen", "mistral", "xai", "moonshot")


def norm(text: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", str(text or "").lower())


def _num(v: Any) -> Optional[float]:
    if isinstance(v, bool) or v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if math.isfinite(f) else None


def _round(v: Optional[float], digits: int = 4) -> Optional[float]:
    return None if v is None else round(v, digits)


def _empty_row() -> Dict[str, Any]:
    return {
        "intelligence": None, "coding": None, "math": None, "price_blended": None,
        "price_input": None, "price_output": None, "speed": None, "ttft": None, "context_length": None,
    }


def normalize_aa(data: Any) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    items = data.get("data") if isinstance(data, dict) else None
    for m in items or []:
        if not isinstance(m, dict):
            continue
        ev = m.get("evaluations") or {}
        pr = m.get("pricing") or {}
        creator = (m.get("model_creator") or {}).get("name") or ""
        name = str(m.get("name") or m.get("slug") or "").strip()
        if not name:
            continue
        row = _empty_row()
        row.update({
            "key": str(m.get("slug") or m.get("id") or name),
            "name": name,
            "creator": str(creator),
            "released": str(m.get("release_date") or ""),
            "intelligence": _round(_num(ev.get("artificial_analysis_intelligence_index")), 2),
            "coding": _round(_num(ev.get("artificial_analysis_coding_index")), 2),
            "math": _round(_num(ev.get("artificial_analysis_math_index")), 2),
            "price_blended": _round(_num(pr.get("price_1m_blended_3_to_1"))),
            "price_input": _round(_num(pr.get("price_1m_input_tokens"))),
            "price_output": _round(_num(pr.get("price_1m_output_tokens"))),
            "speed": _round(_num(m.get("median_output_tokens_per_second")), 2),
            "ttft": _round(_num(m.get("median_time_to_first_token_seconds")), 3),
        })
        rows.append(row)
    return rows


def normalize_or(data: Any) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    items = data.get("data") if isinstance(data, dict) else None
    for m in items or []:
        if not isinstance(m, dict):
            continue
        mid = str(m.get("id") or "")
        if not mid or ":" in mid or mid.startswith(("openrouter/", "~")):
            continue
        pricing = m.get("pricing") or {}
        pin = _num(pricing.get("prompt"))
        pout = _num(pricing.get("completion"))
        if pin is None or pout is None or pin < 0 or pout < 0:
            continue
        pin *= 1_000_000
        pout *= 1_000_000
        raw_name = str(m.get("name") or mid)
        creator_label, short = (raw_name.split(": ", 1) + [""])[:2] if ": " in raw_name else ("", raw_name)
        created = _num(m.get("created"))
        released = datetime.fromtimestamp(created, tz=timezone.utc).date().isoformat() if created else ""
        row = _empty_row()
        row.update({
            "key": mid,
            "name": short or raw_name,
            "creator": creator_label or mid.split("/")[0],
            "released": released,
            "price_blended": _round((3 * pin + pout) / 4),
            "price_input": _round(pin),
            "price_output": _round(pout),
            "context_length": _num(m.get("context_length")),
        })
        rows.append(row)
    return rows


async def _fetch_upstream(source: str, api_key: str) -> List[Dict[str, Any]]:
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as http:
        if source == AA:
            resp = await observe_external_http(http.get(AA_URL, headers={"x-api-key": api_key}))
        else:
            resp = await observe_external_http(http.get(OR_URL))
    resp.raise_for_status()
    rows = normalize_aa(resp.json()) if source == AA else normalize_or(resp.json())
    if not rows:
        raise ValueError(f"{source} returned no usable models")
    return rows


async def _read_cache(db: AsyncSession, source: str) -> Optional[Model_data_cache]:
    result = await db.execute(
        select(Model_data_cache).where(Model_data_cache.source == source).order_by(Model_data_cache.id.desc()).limit(1)
    )
    return result.scalars().first()


def _is_fresh(fetched_at: str) -> bool:
    try:
        ts = datetime.fromisoformat(fetched_at)
    except (TypeError, ValueError):
        return False
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - ts < CACHE_TTL


async def load_dataset(db: AsyncSession) -> Dict[str, Any]:
    """Return {source, rows, fetched_at, stale, from_cache}, preferring Artificial Analysis."""
    api_key = (os.environ.get("AA_API_KEY") or "").strip()
    sources = [AA, OR] if api_key else [OR]

    cached: Dict[str, Dict[str, Any]] = {}
    for source in sources:
        row = await _read_cache(db, source)
        if row is not None:
            try:
                cached[source] = {"rows": json.loads(row.payload_json), "fetched_at": row.fetched_at}
            except ValueError:
                pass
    await db.commit()

    for source in sources:
        hit = cached.get(source)
        if hit and _is_fresh(hit["fetched_at"]):
            return {"source": source, **hit, "stale": False, "from_cache": True}
        try:
            rows = await _fetch_upstream(source, api_key)
        except Exception as exc:  # noqa: BLE001 - any upstream failure falls back
            logger.warning("model data fetch failed for %s: %s", source, exc)
            if hit:
                return {"source": source, **hit, "stale": True, "from_cache": True}
            continue
        fetched_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        existing = await _read_cache(db, source)
        payload = json.dumps(rows, ensure_ascii=False)
        if existing is None:
            db.add(Model_data_cache(source=source, payload_json=payload, fetched_at=fetched_at))
        else:
            existing.payload_json = payload
            existing.fetched_at = fetched_at
        await db.commit()
        return {"source": source, "rows": rows, "fetched_at": fetched_at, "stale": False, "from_cache": False}

    raise HTTPException(status_code=503, detail="Model data sources are unavailable right now.")


def _is_variant(row: Dict[str, Any]) -> bool:
    n = norm(row.get("name")) + norm(row.get("key"))
    return any(w in n for w in VARIANT_WORDS)


def _pick(candidates: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not candidates:
        return None
    scored = [c for c in candidates if c.get("intelligence") is not None]
    if scored:
        return max(scored, key=lambda c: (c["intelligence"], c.get("released") or ""))
    return max(candidates, key=lambda c: (c.get("released") or "", c.get("name") or ""))


def match_one(query: str, rows: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    nq = norm(query)
    if not nq:
        return None
    family = FAMILIES.get(nq)
    if family:
        creators, name_kw = family
        fam = [
            r for r in rows
            if (not creators or any(c in norm(r.get("creator")) or c in norm(r.get("key")) for c in creators))
            and (name_kw is None or name_kw in norm(r.get("name")))
        ]
        main = [r for r in fam if not _is_variant(r)] or fam
        flagship = [r for r in main if not any(w in norm(r.get("name")) for w in SMALL_TIER_WORDS)]
        return _pick(flagship or main)

    exact = [r for r in rows if norm(r.get("name")) == nq or norm(r.get("key")) == nq or norm(r.get("key")).endswith(nq) and "/" in str(r.get("key")) and norm(str(r.get("key")).split("/", 1)[1]) == nq]
    if exact:
        return _pick(exact)
    contains = [r for r in rows if nq in norm(r.get("name")) or nq in norm(r.get("key"))]
    if contains:
        return _pick(contains)
    tokens = [norm(t) for t in re.split(r"[^A-Za-z0-9.]+", query) if norm(t)]
    if tokens:
        loose = [r for r in rows if all(t in norm(r.get("name")) + norm(r.get("key")) + norm(r.get("creator")) for t in tokens)]
        return _pick(loose)
    return None


def select_models(dataset: Dict[str, Any], names: List[str], top: Optional[int]) -> Dict[str, Any]:
    rows: List[Dict[str, Any]] = dataset["rows"]
    source = dataset["source"]
    chosen: List[Dict[str, Any]] = []
    matches: List[Dict[str, Any]] = []
    seen = set()
    selection = "names"

    if names:
        for q in names:
            hit = match_one(q, rows)
            matches.append({
                "query": q,
                "key": hit["key"] if hit else None,
                "name": hit["name"] if hit else None,
                "creator": hit["creator"] if hit else None,
            })
            if hit and hit["key"] not in seen:
                seen.add(hit["key"])
                chosen.append(hit)
    else:
        n = max(1, min(int(top or 5), 20))
        if source == AA:
            selection = "top_intelligence"
            pool = sorted((r for r in rows if r.get("intelligence") is not None), key=lambda r: r["intelligence"], reverse=True)
        else:
            selection = "top_newest"
            pool = sorted(
                (
                    r for r in rows
                    if not _is_variant(r)
                    and not any(w in norm(r.get("name")) for w in SMALL_TIER_WORDS)
                    and any(c in norm(r.get("creator")) + norm(r.get("key")) for c in MAJOR_CREATORS)
                ),
                key=lambda r: r.get("released") or "",
                reverse=True,
            )
        for r in pool:
            if r["key"] in seen:
                continue
            seen.add(r["key"])
            chosen.append(r)
            if len(chosen) >= n:
                break

    info = SOURCE_INFO[source]
    return {
        "source": source,
        "source_label": info["label"],
        "source_url": info["url"],
        "fetched_at": dataset["fetched_at"],
        "stale": dataset["stale"],
        "from_cache": dataset["from_cache"],
        "metrics_available": info["metrics"],
        "selection": selection,
        "matches": matches,
        "rows": chosen,
    }
