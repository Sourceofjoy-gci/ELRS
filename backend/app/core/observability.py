import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
import asyncio

logger = logging.getLogger(__name__)

_langfuse_client = None


def get_langfuse_client():
    global _langfuse_client
    if _langfuse_client is None:
        try:
            from langfuse import Langfuse
            from app.core.config import get_settings
            settings = get_settings()
            _langfuse_client = Langfuse(
                host=settings.langfuse_host,
                public_key=settings.langfuse_public_key,
                secret_key=settings.langfuse_secret_key,
            )
        except ImportError:
            logger.warning("Langfuse not installed, observability disabled")
            return None
        except Exception as e:
            logger.warning(f"Failed to initialize Langfuse: {e}")
            return None
    return _langfuse_client


async def trace_llm_request(model: str, messages: List[Dict], status_code: int) -> None:
    asyncio.create_task(_trace_llm_request_async(model, messages, status_code))


async def _trace_llm_request_async(model: str, messages: List[Dict], status_code: int) -> None:
    try:
        client = get_langfuse_client()
        if client is None:
            return

        langfuse_trace = client.trace(
            name="llm_request",
            metadata={
                "model": model,
                "message_count": len(messages),
                "status_code": status_code,
            }
        )

        langfuse_trace.span(
            name="llm_generation",
            metadata={
                "model": model,
            }
        )
    except Exception as e:
        logger.debug(f"Tracing error (non-blocking): {e}")


def trace_query(session_id: str, query: str) -> Any:
    try:
        client = get_langfuse_client()
        if client is None:
            return None

        trace = client.trace(
            name="legal_research_query",
            metadata={
                "session_id": session_id,
                "query": query,
                "timestamp": datetime.utcnow().isoformat(),
            }
        )
        return trace
    except Exception as e:
        logger.debug(f"Tracing error (non-blocking): {e}")
        return None


def trace_agent(
    trace: Any,
    agent_name: str,
    model: str,
    prompt: str,
    response: str,
    latency_ms: int,
    tokens: int,
) -> None:
    try:
        if trace is None:
            return

        trace.span(
            name=f"agent_{agent_name}",
            metadata={
                "agent": agent_name,
                "model": model,
                "prompt_length": len(prompt),
                "response_length": len(response),
                "latency_ms": latency_ms,
                "tokens_used": tokens,
            }
        )
    except Exception as e:
        logger.debug(f"Tracing error (non-blocking): {e}")


def trace_retrieval(
    trace: Any,
    query: str,
    chunks_found: int,
    top_score: float,
    retrieval_mode: str,
) -> None:
    try:
        if trace is None:
            return

        trace.span(
            name="retrieval",
            metadata={
                "query": query,
                "chunks_found": chunks_found,
                "top_score": top_score,
                "mode": retrieval_mode,
            }
        )
    except Exception as e:
        logger.debug(f"Tracing error (non-blocking): {e}")


async def trace_agent_async(
    agent_name: str,
    model: str,
    prompt: str,
    response: str,
    latency_ms: int,
    tokens: int,
) -> None:
    asyncio.create_task(_trace_agent_async(agent_name, model, prompt, response, latency_ms, tokens))


async def _trace_agent_async(
    agent_name: str,
    model: str,
    prompt: str,
    response: str,
    latency_ms: int,
    tokens: int,
) -> None:
    try:
        client = get_langfuse_client()
        if client is None:
            return

        client.span(
            name=f"agent_{agent_name}",
            metadata={
                "agent": agent_name,
                "model": model,
                "prompt_length": len(prompt),
                "response_length": len(response),
                "latency_ms": latency_ms,
                "tokens_used": tokens,
            }
        )
    except Exception as e:
        logger.debug(f"Tracing error (non-blocking): {e}")
