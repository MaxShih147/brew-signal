import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import CollectRunRequest, CollectRunResponse, MALSyncResult, YouTubeSyncResult
from app.services.trend_service import run_collection
from app.services.mal_sync_service import sync_ip_from_mal, sync_all_ips
from app.services.youtube_sync_service import (
    sync_ip_from_youtube,
    sync_all_ips as youtube_sync_all_ips,
)

router = APIRouter(prefix="/api/collect", tags=["collect"])


@router.post("/run", response_model=CollectRunResponse)
async def manual_collect(body: CollectRunRequest, db: AsyncSession = Depends(get_db)):
    result = await run_collection(db, body.ip_id, body.geo, body.timeframe)
    return result


@router.post("/mal-sync/{ip_id}", response_model=MALSyncResult)
async def mal_sync_single(ip_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Sync a single IP from MyAnimeList via Jikan API."""
    result = await sync_ip_from_mal(db, ip_id)
    if result["errors"] and not result["matched"]:
        raise HTTPException(status_code=404, detail=result["errors"][0])
    return result


@router.post("/mal-sync-all", response_model=list[MALSyncResult])
async def mal_sync_all(db: AsyncSession = Depends(get_db)):
    """Sync all IPs from MyAnimeList via Jikan API."""
    results = await sync_all_ips(db)
    return results


@router.post("/youtube-sync/{ip_id}", response_model=YouTubeSyncResult)
async def youtube_sync_single(ip_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Sync a single IP's video metrics from YouTube Data API."""
    result = await sync_ip_from_youtube(db, ip_id)
    if result["errors"] and result["videos_added"] == 0:
        raise HTTPException(status_code=400, detail=result["errors"][0])
    return result


@router.post("/youtube-sync-all", response_model=list[YouTubeSyncResult])
async def youtube_sync_all(db: AsyncSession = Depends(get_db)):
    """Sync all IPs' video metrics from YouTube Data API."""
    results = await youtube_sync_all_ips(db)
    return results
