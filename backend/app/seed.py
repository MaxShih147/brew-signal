"""Seed script: creates a demo IP (Chiikawa) with aliases if the DB is empty.

Run with: python -m app.seed
"""
import asyncio
import logging

from sqlalchemy import select

from app.database import async_session
from app.models import IP, IPAlias

logger = logging.getLogger(__name__)

DEMO_IP_NAME = "Chiikawa"
DEMO_ALIASES = [
    {"alias": "Chiikawa", "locale": "en", "weight": 1.0},
    {"alias": "ちいかわ", "locale": "jp", "weight": 1.2},
    {"alias": "吉伊卡哇", "locale": "zh", "weight": 0.8},
]


async def seed():
    async with async_session() as db:
        result = await db.execute(select(IP).limit(1))
        if result.scalar_one_or_none():
            logger.info("DB already has data, skipping seed.")
            return

        ip = IP(name=DEMO_IP_NAME)
        db.add(ip)
        await db.flush()

        for a in DEMO_ALIASES:
            alias = IPAlias(ip_id=ip.id, alias=a["alias"], locale=a["locale"], weight=a["weight"], enabled=True)
            db.add(alias)

        await db.commit()
        logger.info(f"Seeded demo IP: {DEMO_IP_NAME} (id={ip.id}) with {len(DEMO_ALIASES)} aliases")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed())
