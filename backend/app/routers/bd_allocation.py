import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import IP, IPPipeline
from app.schemas import (
    BDScoreResponse,
    IPPipelineCreate, IPPipelineUpdate, IPPipelineOut,
)
from app.services.bd_allocation_service import compute_bd_score, rank_candidates

router = APIRouter(prefix="/api/ip", tags=["bd-allocation"])

VALID_STAGES = {"candidate", "negotiating", "secured", "launched", "archived"}


# --- BD Ranking (must be before /{ip_id} routes) ---

@router.get("/bd-ranking", response_model=list[BDScoreResponse])
async def get_bd_ranking(
    geo: str = Query("TW"),
    timeframe: str = Query("12m"),
    db: AsyncSession = Depends(get_db),
):
    return await rank_candidates(db, geo, timeframe)


# --- Pipeline CRUD ---

@router.get("/{ip_id}/pipeline", response_model=IPPipelineOut)
async def get_pipeline(ip_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(IPPipeline).where(IPPipeline.ip_id == ip_id))
    pipeline = result.scalar_one_or_none()
    if not pipeline:
        raise HTTPException(404, "Pipeline not found for this IP")
    return pipeline


@router.post("/{ip_id}/pipeline", response_model=IPPipelineOut, status_code=201)
async def create_pipeline(ip_id: uuid.UUID, body: IPPipelineCreate, db: AsyncSession = Depends(get_db)):
    # Verify IP exists
    ip_result = await db.execute(select(IP).where(IP.id == ip_id))
    if not ip_result.scalar_one_or_none():
        raise HTTPException(404, "IP not found")

    # Check if pipeline already exists
    existing = await db.execute(select(IPPipeline).where(IPPipeline.ip_id == ip_id))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Pipeline already exists for this IP")

    if body.stage not in VALID_STAGES:
        raise HTTPException(400, f"Invalid stage. Must be one of: {', '.join(sorted(VALID_STAGES))}")

    pipeline = IPPipeline(
        ip_id=ip_id,
        stage=body.stage,
        target_launch_date=body.target_launch_date,
        mg_amount_usd=body.mg_amount_usd,
        notes=body.notes,
    )
    db.add(pipeline)
    await db.commit()
    await db.refresh(pipeline)
    return pipeline


@router.put("/{ip_id}/pipeline", response_model=IPPipelineOut)
async def update_pipeline(ip_id: uuid.UUID, body: IPPipelineUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(IPPipeline).where(IPPipeline.ip_id == ip_id))
    pipeline = result.scalar_one_or_none()
    if not pipeline:
        raise HTTPException(404, "Pipeline not found for this IP")

    updates = body.model_dump(exclude_unset=True)
    if "stage" in updates and updates["stage"] not in VALID_STAGES:
        raise HTTPException(400, f"Invalid stage. Must be one of: {', '.join(sorted(VALID_STAGES))}")

    for field, val in updates.items():
        setattr(pipeline, field, val)

    await db.commit()
    await db.refresh(pipeline)
    return pipeline


# --- BD Score ---

@router.get("/{ip_id}/bd-score", response_model=BDScoreResponse)
async def get_bd_score(
    ip_id: uuid.UUID,
    geo: str = Query("TW"),
    timeframe: str = Query("12m"),
    db: AsyncSession = Depends(get_db),
):
    # Verify IP exists
    ip_result = await db.execute(select(IP).where(IP.id == ip_id))
    if not ip_result.scalar_one_or_none():
        raise HTTPException(404, "IP not found")

    return await compute_bd_score(db, ip_id, geo, timeframe)
