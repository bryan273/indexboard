"""IndexBoard API: anonymous boards with a public slug and a private edit key."""

import hashlib
import json
import logging
import secrets
import string
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.boards import Boards

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/indexboard", tags=["indexboard"])

MAX_PAYLOAD_CHARS = 600_000
MAX_ITEMS = 300
MAX_METRICS = 40
SLUG_ALPHABET = string.ascii_lowercase + string.digits


class BoardWrite(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=8000)
    payload: Dict[str, Any]


class BoardUpdate(BoardWrite):
    edit_key: str = Field(min_length=8, max_length=200)


class KeyCheck(BaseModel):
    edit_key: str = Field(min_length=1, max_length=200)


def _hash_key(key: str) -> str:
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def _payload_text(payload: Dict[str, Any]) -> str:
    metrics = payload.get("metrics")
    items = payload.get("items")
    if not isinstance(metrics, list) or not metrics:
        raise HTTPException(status_code=400, detail="A board needs at least one metric.")
    if not isinstance(items, list) or not items:
        raise HTTPException(status_code=400, detail="A board needs at least one item.")
    if len(metrics) > MAX_METRICS or len(items) > MAX_ITEMS:
        raise HTTPException(status_code=400, detail="Too many metrics or items for one board.")
    text = json.dumps(payload, ensure_ascii=False)
    if len(text) > MAX_PAYLOAD_CHARS:
        raise HTTPException(status_code=413, detail="Board data is too large.")
    return text


def _serialize(board: Boards) -> Dict[str, Any]:
    return {
        "slug": board.slug,
        "title": board.title,
        "description": board.description or "",
        "payload": json.loads(board.payload_json),
        "created_at": board.created_at.isoformat() if board.created_at else None,
        "updated_at": board.updated_at.isoformat() if board.updated_at else None,
    }


async def _find(db: AsyncSession, slug: str) -> Boards:
    result = await db.execute(select(Boards).where(Boards.slug == slug))
    board = result.scalars().first()
    if board is None:
        raise HTTPException(status_code=404, detail="Board not found.")
    return board


def _key_matches(board: Boards, key: str) -> bool:
    return secrets.compare_digest(board.edit_key_hash, _hash_key(key.strip()))


@router.post("/boards")
async def create_board(data: BoardWrite, db: AsyncSession = Depends(get_db)):
    text = _payload_text(data.payload)
    slug = ""
    for _ in range(6):
        candidate = "".join(secrets.choice(SLUG_ALPHABET) for _ in range(10))
        exists = await db.execute(select(Boards.id).where(Boards.slug == candidate))
        if exists.first() is None:
            slug = candidate
            break
    if not slug:
        raise HTTPException(status_code=500, detail="Could not allocate a share link, please retry.")
    edit_key = secrets.token_urlsafe(18)
    board = Boards(
        slug=slug,
        title=data.title.strip(),
        description=data.description.strip(),
        payload_json=text,
        edit_key_hash=_hash_key(edit_key),
    )
    db.add(board)
    await db.commit()
    return {"slug": slug, "edit_key": edit_key, "board": _serialize(board)}


def _num(v: Any):
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    return None


def _summary(board: Boards) -> Dict[str, Any]:
    """Small card summary: counts plus the top 3 items on the headline metric."""
    try:
        payload = json.loads(board.payload_json)
    except (TypeError, ValueError):
        payload = {}
    metrics = [m for m in payload.get("metrics") or [] if isinstance(m, dict)]
    items = [i for i in payload.get("items") or [] if isinstance(i, dict)]
    pid = payload.get("primary_metric_id")
    primary = next((m for m in metrics if m.get("id") == pid), None)
    if primary is None:
        primary = next((m for m in metrics if m.get("direction") != "lower"), metrics[0] if metrics else None)
    top = []
    if primary is not None:
        rows = []
        for it in items:
            score = (it.get("scores") or {}).get(primary.get("id"))
            value = _num(score.get("value")) if isinstance(score, dict) else None
            if value is not None:
                rows.append({"name": str(it.get("name", "")), "value": value})
        rows.sort(key=lambda r: r["value"], reverse=primary.get("direction") != "lower")
        top = rows[:3]
    description = board.description or ""
    live = payload.get("live") if isinstance(payload.get("live"), dict) else {}
    return {
        "data_source": live.get("source"),
        "slug": board.slug,
        "title": board.title,
        "description": description[:280],
        "item_count": len(items),
        "metric_count": len(metrics),
        "primary_metric": {"name": str(primary.get("name", "")), "unit": str(primary.get("unit", ""))} if primary else None,
        "top": top,
        "created_at": board.created_at.isoformat() if board.created_at else None,
    }


@router.get("/boards")
async def list_recent_boards(limit: int = Query(9, ge=1, le=24), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Boards).order_by(Boards.created_at.desc(), Boards.id.desc()).limit(limit))
    return {"items": [_summary(b) for b in result.scalars().all()]}


@router.get("/boards/{slug}")
async def get_board(slug: str, db: AsyncSession = Depends(get_db)):
    board = await _find(db, slug)
    return _serialize(board)


@router.put("/boards/{slug}")
async def update_board(slug: str, data: BoardUpdate, db: AsyncSession = Depends(get_db)):
    board = await _find(db, slug)
    if not _key_matches(board, data.edit_key):
        raise HTTPException(status_code=403, detail="The edit key does not match this board.")
    board.title = data.title.strip()
    board.description = data.description.strip()
    board.payload_json = _payload_text(data.payload)
    await db.commit()
    return _serialize(board)


@router.post("/boards/{slug}/verify")
async def verify_key(slug: str, data: KeyCheck, db: AsyncSession = Depends(get_db)):
    board = await _find(db, slug)
    return {"valid": _key_matches(board, data.edit_key)}
