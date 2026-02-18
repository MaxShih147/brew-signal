import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import IP
from app.schemas import LaunchPlanResponse
from app.services.launch_timing_service import compute_launch_plan

router = APIRouter(prefix="/api/ip", tags=["launch-timing"])


@router.get("/{ip_id}/launch-plan", response_model=LaunchPlanResponse)
async def get_launch_plan(
    ip_id: uuid.UUID,
    geo: str = Query("TW"),
    timeframe: str = Query("12m"),
    db: AsyncSession = Depends(get_db),
):
    # Verify IP exists
    ip_result = await db.execute(select(IP).where(IP.id == ip_id))
    if not ip_result.scalar_one_or_none():
        raise HTTPException(404, "IP not found")

    return await compute_launch_plan(db, ip_id, geo, timeframe)
