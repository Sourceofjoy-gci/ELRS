import json
import time
import logging
from app.agents.state import LegalResearchState
from app.llm.ollama_client import get_ollama_client
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def load_prompt(prompt_name: str) -> str:
    """Load agent prompt from prompts/agents/ directory."""
    import os
    for base in ["prompts/agents", "backend/prompts/agents"]:
        path = os.path.join(base, f"{prompt_name}.md")
        if os.path.exists(path):
            with open(path) as f:
                return f.read()
    logger.warning(f"Prompt file not found: {prompt_name}")
    return ""


async def router_node(state: LegalResearchState, db) -> LegalResearchState:
    """Route query to appropriate specialist agents."""
    start_time = time.time()
    ollama = get_ollama_client()

    router_prompt = load_prompt("router")
    messages = [
        {"role": "system", "content": router_prompt},
        {"role": "user", "content": state["query"]},
    ]

    try:
        response = await ollama.chat(messages, model=settings.ollama_router_model)
        content = response.get("message", {}).get("content", "")

        try:
            routing = json.loads(content.strip())
        except json.JSONDecodeError:
            content_clean = content.strip().strip("```json").strip("```").strip()
            routing = json.loads(content_clean)

        state["routing_decision"] = {
            "agents": routing.get("agents", ["STATUTE"]),
            "reasoning": routing.get("reasoning", ""),
            "confidence": routing.get("confidence", 0.5),
            "query_type": routing.get("query_type", "general"),
        }

    except Exception as e:
        logger.error(f"Router error: {e}")
        state["routing_decision"] = {
            "agents": ["STATUTE"],
            "reasoning": "Default routing due to error",
            "confidence": 0.3,
            "query_type": "general",
        }

    latency_ms = int((time.time() - start_time) * 1000)
    state["agent_trace"].append({
        "agent": "router",
        "action": "routing_decision",
        "latency_ms": latency_ms,
        "model_used": settings.ollama_router_model,
    })

    return state
