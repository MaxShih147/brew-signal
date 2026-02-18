import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import IP, IPAlias, IPEvent, DailyTrend, TrendPoint, CollectorRunLog
from app.schemas import (
    IPCreate, IPOut, IPUpdate, IPListItem, AliasCreate, AliasUpdate, AliasOut,
    DiscoverAliasesRequest, DiscoverAliasesResponse, DiscoveredAlias,
    IPEventCreate, IPEventOut, EVENT_TYPES,
)
from app.services.alias_discovery import discover_aliases
from app.services.trend_service import _compute_daily_aggregation

router = APIRouter(prefix="/api/ip", tags=["ip"])


@router.post("", response_model=IPOut, status_code=201)
async def create_ip(body: IPCreate, db: AsyncSession = Depends(get_db)):
    ip = IP(name=body.name)
    db.add(ip)
    for a in body.aliases:
        alias = IPAlias(ip_id=ip.id, alias=a.alias, locale=a.locale, weight=a.weight, enabled=a.enabled)
        alias.ip_id = ip.id
        ip.aliases.append(alias)
    await db.commit()
    await db.refresh(ip, ["aliases"])
    return ip


@router.get("", response_model=list[IPListItem])
async def list_ips(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(IP).options(selectinload(IP.aliases)).order_by(IP.created_at.desc()))
    ips = result.scalars().all()

    items = []
    for ip in ips:
        # Get latest daily trend for signal light
        dt_result = await db.execute(
            select(DailyTrend)
            .where(DailyTrend.ip_id == ip.id)
            .order_by(DailyTrend.date.desc())
            .limit(1)
        )
        dt = dt_result.scalar_one_or_none()
        items.append(IPListItem(
            id=ip.id,
            name=ip.name,
            created_at=ip.created_at,
            aliases=ip.aliases,
            last_updated=dt.date if dt else None,
            signal_light=dt.signal_light if dt else None,
        ))
    return items


@router.put("/{ip_id}", response_model=IPOut)
async def update_ip(ip_id: uuid.UUID, body: IPUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(IP).options(selectinload(IP.aliases)).where(IP.id == ip_id))
    ip = result.scalar_one_or_none()
    if not ip:
        raise HTTPException(404, "IP not found")
    if body.name is not None:
        ip.name = body.name
    await db.commit()
    await db.refresh(ip, ["aliases"])
    return ip


@router.get("/{ip_id}", response_model=IPOut)
async def get_ip(ip_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(IP).options(selectinload(IP.aliases)).where(IP.id == ip_id))
    ip = result.scalar_one_or_none()
    if not ip:
        raise HTTPException(404, "IP not found")
    return ip


@router.delete("/{ip_id}", status_code=204)
async def delete_ip(ip_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(IP).where(IP.id == ip_id))
    ip = result.scalar_one_or_none()
    if not ip:
        raise HTTPException(404, "IP not found")
    await db.delete(ip)
    await db.commit()


@router.post("/{ip_id}/aliases", response_model=AliasOut, status_code=201)
async def add_alias(ip_id: uuid.UUID, body: AliasCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(IP).where(IP.id == ip_id))
    if not result.scalar_one_or_none():
        raise HTTPException(404, "IP not found")
    alias = IPAlias(ip_id=ip_id, alias=body.alias, locale=body.locale, weight=body.weight, enabled=body.enabled)
    db.add(alias)
    await db.commit()
    await db.refresh(alias)
    return alias


@router.put("/alias/{alias_id}", response_model=AliasOut)
async def update_alias(alias_id: uuid.UUID, body: AliasUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(IPAlias).where(IPAlias.id == alias_id))
    alias = result.scalar_one_or_none()
    if not alias:
        raise HTTPException(404, "Alias not found")
    updates = body.model_dump(exclude_unset=True)
    needs_reaggregate = "enabled" in updates or "weight" in updates
    for field, val in updates.items():
        setattr(alias, field, val)
    await db.commit()
    await db.refresh(alias)

    # Re-aggregate composite when enabled or weight changes
    if needs_reaggregate:
        for geo in ["TW", "JP", "US", "WW"]:
            for tf in ["90d", "12m", "5y"]:
                await _compute_daily_aggregation(db, alias.ip_id, geo, tf)

    return alias


@router.post("/alias/{alias_id}/reset-weight", response_model=AliasOut)
async def reset_alias_weight(alias_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Reset alias weight to original discovery value."""
    result = await db.execute(select(IPAlias).where(IPAlias.id == alias_id))
    alias = result.scalar_one_or_none()
    if not alias:
        raise HTTPException(404, "Alias not found")
    if alias.original_weight is None:
        raise HTTPException(400, "No original weight stored for this alias")
    alias.weight = alias.original_weight
    await db.commit()
    await db.refresh(alias)

    # Re-aggregate composite
    for geo in ["TW", "JP", "US", "WW"]:
        for tf in ["90d", "12m", "5y"]:
            await _compute_daily_aggregation(db, alias.ip_id, geo, tf)

    return alias


@router.delete("/alias/{alias_id}", status_code=204)
async def delete_alias(alias_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(IPAlias).where(IPAlias.id == alias_id))
    alias = result.scalar_one_or_none()
    if not alias:
        raise HTTPException(404, "Alias not found")
    await db.delete(alias)
    await db.commit()


@router.post("/{ip_id}/discover-aliases", response_model=DiscoverAliasesResponse)
async def discover_ip_aliases(
    ip_id: uuid.UUID,
    body: DiscoverAliasesRequest = DiscoverAliasesRequest(),
    auto_add: bool = True,
    db: AsyncSession = Depends(get_db),
):
    """Use Claude AI to auto-discover aliases for an IP.

    - Discovers aliases across zh/jp/en/ko and more
    - If auto_add=true (default), adds new aliases that don't already exist
    - Skips duplicates (case-insensitive match against existing aliases)
    """
    result = await db.execute(select(IP).options(selectinload(IP.aliases)).where(IP.id == ip_id))
    ip = result.scalar_one_or_none()
    if not ip:
        raise HTTPException(404, "IP not found")

    search_name = body.ip_name or ip.name

    try:
        discovered_raw = await discover_aliases(search_name)
    except ValueError as e:
        raise HTTPException(400, str(e))

    discovered = [DiscoveredAlias(**d) for d in discovered_raw]

    # Auto-add new aliases (skip duplicates)
    applied = 0
    if auto_add:
        existing = {a.alias.lower() for a in ip.aliases}
        for d in discovered:
            if d.alias.lower() not in existing:
                new_alias = IPAlias(
                    ip_id=ip_id,
                    alias=d.alias,
                    locale=d.locale,
                    weight=d.weight,
                    original_weight=d.weight,
                    enabled=True,
                )
                db.add(new_alias)
                existing.add(d.alias.lower())
                applied += 1
        if applied > 0:
            await db.commit()

    return DiscoverAliasesResponse(ip_id=ip_id, discovered=discovered, applied=applied)


# --- Events ---

@router.get("/{ip_id}/events", response_model=list[IPEventOut])
async def list_events(ip_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(IPEvent).where(IPEvent.ip_id == ip_id).order_by(IPEvent.event_date)
    )
    return result.scalars().all()


@router.post("/{ip_id}/events", response_model=IPEventOut, status_code=201)
async def create_event(ip_id: uuid.UUID, body: IPEventCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(IP).where(IP.id == ip_id))
    if not result.scalar_one_or_none():
        raise HTTPException(404, "IP not found")
    if body.event_type not in EVENT_TYPES:
        raise HTTPException(400, f"Invalid event_type. Must be one of: {', '.join(sorted(EVENT_TYPES))}")
    event = IPEvent(
        ip_id=ip_id,
        event_type=body.event_type,
        title=body.title,
        event_date=body.event_date,
        source=body.source,
        source_url=body.source_url,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


@router.delete("/event/{event_id}", status_code=204)
async def delete_event(event_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(IPEvent).where(IPEvent.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(404, "Event not found")
    await db.delete(event)
    await db.commit()
