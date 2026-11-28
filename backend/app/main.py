
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.chat import router as chat_router

app = FastAPI(
    title="A.E.G.I.S.",
    description="Artificially Enhanced Guidance and Intelligent Support",
    version="1.0.0"
)

# Allow the React frontend to communicate with the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)


@app.get("/")
async def root():
    return {
        "name": "A.E.G.I.S.",
        "message": "A.E.G.I.S. backend is online.",
        "status": "ready"
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "system": "A.E.G.I.S."
    }
