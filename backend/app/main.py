from fastapi import FastAPI
from app.api.chat import router as chat_router

app = FastAPI(
    title="A.E.G.I.S.",
    description="Artificially Enhanced Guidance and Intelligent Support",
    version="0.1.0"
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
        "status": "healthy"
    }