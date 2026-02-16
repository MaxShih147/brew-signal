from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import CollectRunRequest, CollectRunResponse
from app.services.trend_service import run_collection

router = APIRouter(prefix="/api/collect", tags=["collect"])


@router.post("/run", response_model=CollectRunResponse)
async def manual_collect(body: CollectRunRequest, db: AsyncSession = Depends(get_db)):
    result = await run_collection(db, body.ip_id, body.geo, body.timeframe)
    return result
