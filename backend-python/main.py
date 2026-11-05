from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, teachers, reports

app = FastAPI(title="School Portal 72 - Backend API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"]
)

# Рутерүүдээ бүртгэж байна
app.include_router(auth.router)
app.include_router(teachers.router)
app.include_router(reports.router)

@app.get("/")
def root():
    return {"message": "School Portal 72 API is running!"}