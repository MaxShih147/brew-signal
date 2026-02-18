import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import SourceRegistry
from app.schemas import (
    SourceHealthOut, SourceRunOut, CoverageMatrixRow, SourceRegistryOut, ConfidenceOut,
)
from app.services.confidence_service import (
    get_source_health_list, get_coverage_matrix, get_recent_runs,
    get_ip_confidence, compute_ip_confidence,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/data-health/sources", response_model=list[SourceHealthOut])
async def admin_source_health(db: AsyncSession = Depends(get_db)):
    return await get_source_health_list(db)


@router.get("/data-health/matrix", response_model=list[CoverageMatrixRow])
async def admin_coverage_matrix(
    limit: int = Query(50),
    only_issues: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    return await get_coverage_matrix(db, limit=limit, only_issues=only_issues)


@router.get("/data-health/runs", response_model=list[SourceRunOut])
async def admin_recent_runs(
    source_key: Optional[str] = Query(None),
    limit: int = Query(50),
    db: AsyncSession = Depends(get_db),
):
    return await get_recent_runs(db, source_key=source_key, limit=limit)


@router.get("/data-health/registry", response_model=list[SourceRegistryOut])
async def admin_source_registry(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SourceRegistry))
    return result.scalars().all()


@router.get("/confidence/{ip_id}", response_model=ConfidenceOut)
async def admin_ip_confidence(ip_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await get_ip_confidence(db, ip_id)


@router.post("/confidence/{ip_id}/recalculate", response_model=ConfidenceOut)
async def admin_recalculate_confidence(ip_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await compute_ip_confidence(db, ip_id)
