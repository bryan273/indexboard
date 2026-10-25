"""GET/POST /api/v1/model-data: normalized, cached real model data for IndexBoard."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.model_data import load_dataset, select_models

router = APIRouter(prefix="/api/v1/model-data", tags=["model-data"])

MAX_NAMES = 12


class ModelDataRequest(BaseModel):
    models: List[str] = Field(default_factory=list)
    top: Optional[int] = Field(default=None, ge=1, le=20)


def _clean(names: List[str]) -> List[str]:
    out = []
    for n in names:
        s = str(n).strip()[:80]
        if s and s.lower() not in (x.lower() for x in out):
            out.append(s)
    return out[:MAX_NAMES]


async def _run(names: List[str], top: Optional[int], db: AsyncSession):
    names = _clean(names)
    if not names and not top:
        raise HTTPException(status_code=400, detail="Give model names or top N.")
    dataset = await load_dataset(db)
    return select_models(dataset, names, top)


@router.post("")
async def model_data_post(data: ModelDataRequest, db: AsyncSession = Depends(get_db)):
    return await _run(data.models, data.top, db)


@router.get("")
async def model_data_get(
    models: str = Query(default="", description="Comma-separated model names"),
    top: Optional[int] = Query(default=None, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    return await _run(models.split(","), top, db)
