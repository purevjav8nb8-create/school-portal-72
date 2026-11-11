import asyncio
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import teachers, reports, files
from services.attendance_automation import ensure_today_attendance

logger = logging.getLogger(__name__)
school_timezone = ZoneInfo("Asia/Ulaanbaatar")


async def _attendance_scheduler():
    while True:
        try:
            await asyncio.to_thread(ensure_today_attendance)
        except Exception:
            logger.exception("Өнөөдрийн багшийн ирцийг автоматаар бүртгэж чадсангүй.")
            await asyncio.sleep(300)
            continue
        now = datetime.now(school_timezone)
        next_day = now.date() + timedelta(days=1)
        next_run = datetime.combine(next_day, time.min, tzinfo=school_timezone)
        await asyncio.sleep(max(1, (next_run - now).total_seconds()))


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(_attendance_scheduler())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

app = FastAPI(title="School Portal 72 - Backend API", lifespan=lifespan)
frontend_origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"]
)

# Рутерүүдээ бүртгэж байна
app.include_router(teachers.router)
app.include_router(reports.router)
app.include_router(files.router)

@app.get("/")
def root():
    return {"message": "School Portal 72 API is running!"}