
from app.services.local_ai import generate_local_response


async def generate_response(message: str, mode: str = "hybrid"):
    """
    A.E.G.I.S. AI orchestrator.

    Local mode: Uses Ollama.
    Hybrid mode: Currently uses Ollama as the local-first provider.
    Online mode: Reserved for future cloud AI integration.
    """

    if mode == "online":
        return {
            "assistant_response": (
                "Online AI is not configured yet. "
                "Please select Local or Hybrid mode."
            ),
            "provider": "not_configured",
            "mode": mode,
        }

    try:
        assistant_response = await generate_local_response(message)

        return {
            "assistant_response": assistant_response,
            "provider": "ollama",
            "model": "qwen2.5:3b",
            "mode": mode,
        }

    except RuntimeError as error:
        return {
            "assistant_response": (
                f"I couldn't access my local AI engine. {error}"
            ),
            "provider": "ollama_error",
            "mode": mode,
        }
