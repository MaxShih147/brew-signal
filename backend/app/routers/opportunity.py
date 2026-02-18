import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.database import get_db
from app.models import OpportunityInput
from app.schemas import OpportunityResponse, OpportunityInputUpdate, OpportunityInputOut
from app.services.opportunity_service import get_opportunity_data, VALID_INPUT_KEYS

router = APIRouter(prefix="/api/ip", tags=["opportunity"])


@router.get("/{ip_id}/opportunity", response_model=OpportunityResponse)
async def get_opportunity(
    ip_id: uuid.UUID,
    geo: str = Query("TW"),
    timeframe: str = Query("12m"),
    db: AsyncSession = Depends(get_db),
):
    return await get_opportunity_data(db, ip_id, geo, timeframe)


@router.put("/{ip_id}/opportunity", response_model=list[OpportunityInputOut])
async def update_opportunity_inputs(
    ip_id: uuid.UUID,
    body: OpportunityInputUpdate,
    db: AsyncSession = Depends(get_db),
):
    results = []
    for key, value in body.inputs.items():
        if key not in VALID_INPUT_KEYS:
            raise HTTPException(status_code=400, detail=f"Invalid indicator key: {key}")
        if not (0.0 <= value <= 1.0):
            raise HTTPException(status_code=400, detail=f"Value for {key} must be between 0.0 and 1.0")

        stmt = pg_insert(OpportunityInput).values(
            ip_id=ip_id,
            indicator_key=key,
            value=value,
        ).on_conflict_do_update(
            constraint="uq_opportunity_input",
            set_={"value": value},
        ).returning(OpportunityInput)

        result = await db.execute(stmt)
        row = result.scalar_one()
        results.append(OpportunityInputOut(
            indicator_key=row.indicator_key,
            value=row.value,
            updated_at=row.updated_at,
        ))

    await db.commit()
    return results
