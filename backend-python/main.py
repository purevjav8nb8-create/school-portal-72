import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import teachers, reports, files

app = FastAPI(title="School Portal 72 - Backend API")
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