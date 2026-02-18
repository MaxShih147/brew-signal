import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import ip, trend, collect, opportunity, admin, bd_allocation

logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}',
)

app = FastAPI(
    title="Brew Signal",
    description="IP Timing Dashboard for 5min Coffee BD decisions",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bd_allocation.router)
app.include_router(ip.router)
app.include_router(trend.router)
app.include_router(collect.router)
app.include_router(opportunity.router)
app.include_router(admin.router)


@app.get("/api/health")
async def healthcheck():
    return {"status": "ok"}
