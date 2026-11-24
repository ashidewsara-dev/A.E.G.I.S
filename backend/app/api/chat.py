
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(
    prefix="/api/chat",
    tags=["Chat"]
)


class ChatRequest(BaseModel):
    message: str


@router.post("/")
async def chat(request: ChatRequest):
    return {
        "user_message": request.message,
        "assistant_response": (
            f"Hello! I received your message: {request.message}"
        ),
        "provider": "demo"
    }
