
import httpx

OLLAMA_URL = "http://127.0.0.1:11434/api/chat"
MODEL_NAME = "qwen2.5:3b"


async def generate_local_response(message: str) -> str:
    """Send a message to the local Ollama AI model."""

    payload = {
        "model": MODEL_NAME,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are A.E.G.I.S., a helpful, intelligent "
                    "personal AI assistant. Be friendly, clear, "
                    "and useful. Answer in a natural conversational style."
                ),
            },
            {
                "role": "user",
                "content": message,
            },
        ],
        "stream": False,
        "options": {
            "temperature": 0.7,
        },
    }

    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(180.0, connect=10.0)
        ) as client:
            response = await client.post(
                OLLAMA_URL,
                json=payload,
            )

            response.raise_for_status()
            result = response.json()

    except httpx.ConnectError as exc:
        raise RuntimeError(
            "Cannot connect to Ollama. Please make sure Ollama is running."
        ) from exc

    except httpx.TimeoutException as exc:
        raise RuntimeError(
            "The local AI took too long to respond. Please try again."
        ) from exc

    except httpx.HTTPStatusError as exc:
        raise RuntimeError(
            f"Ollama returned an error: {exc.response.text[:300]}"
        ) from exc

    assistant_message = result.get("message", {}).get("content", "")

    if not assistant_message.strip():
        raise RuntimeError("Ollama returned an empty response.")

    return assistant_message.strip()
