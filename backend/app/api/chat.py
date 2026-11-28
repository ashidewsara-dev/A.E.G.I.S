
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.orchestrator import generate_response

router = APIRouter(
    prefix="/api/chat",
    tags=["Chat"]
)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    mode: Literal["local", "online", "hybrid"] = "hybrid"


@router.post("/")
async def chat(request: ChatRequest):

    result = await generate_response(
        message=request.message,
        mode=request.mode
    )

    return {
        "user_message": request.message,
        **result
    }
