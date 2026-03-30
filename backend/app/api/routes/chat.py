import asyncio
import json
import uuid
import time
from typing import Optional, AsyncIterator
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.models import QuerySession, QueryMessage
from app.agents.graph import run_legal_research_graph
from app.core.observability import trace_query

router = APIRouter()


class ChatRequest(BaseModel):
    query: str
    filters: Optional[dict] = None


class ChatResponse(BaseModel):
    session_id: str
    final_answer: str
    sources: list
    confidence: str
    disclaimer: str
    agent_trace: list


@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    session_id = str(uuid.uuid4())

    session = QuerySession(
        id=uuid.UUID(session_id),
        user_id=uuid.UUID(current_user["user_id"]),
        session_title=request.query[:100],
    )
    db.add(session)
    await db.commit()

    trace = trace_query(session_id, request.query)

    async def event_generator() -> AsyncIterator[str]:
        yield json.dumps({
            "type": "agent_start",
            "agent": "router",
            "message": "Routing your query..."
        }) + "\n"

        try:
            result = await run_legal_research_graph(
                query=request.query,
                user_id=current_user["user_id"],
                filters=request.filters or {},
                db=db,
            )

            yield json.dumps({
                "type": "routing",
                "agents": result["routing_decision"].get("agents", []),
                "reasoning": result["routing_decision"].get("reasoning", ""),
                "confidence": result["routing_decision"].get("confidence", 0.5),
            }) + "\n"

            for trace_entry in result.get("agent_trace", []):
                if trace_entry.get("action") != "routing_decision":
                    yield json.dumps({
                        "type": "agent_start",
                        "agent": trace_entry.get("agent", ""),
                        "message": f"{trace_entry.get('agent', '').title()} agent processing..."
                    }) + "\n"

                    if "chunks_found" in trace_entry:
                        yield json.dumps({
                            "type": "retrieval",
                            "agent": trace_entry.get("agent", ""),
                            "chunks_found": trace_entry.get("chunks_found", 0),
                            "top_score": trace_entry.get("top_score", 0),
                        }) + "\n"

            for token in result.get("final_answer", "").split():
                yield json.dumps({
                    "type": "token",
                    "content": token + " ",
                }) + "\n"
                await asyncio.sleep(0.01)

            sources = result.get("sources", [])
            if sources:
                yield json.dumps({
                    "type": "sources",
                    "sources": sources,
                }) + "\n"

            message = QueryMessage(
                session_id=uuid.UUID(session_id),
                role="assistant",
                content=result.get("final_answer", ""),
                agent_trace=result.get("agent_trace", []),
                sources={"sources": sources},
                confidence=result.get("confidence", "MEDIUM"),
            )
            db.add(message)
            await db.commit()

            yield json.dumps({"type": "done"}) + "\n"

        except Exception as e:
            yield json.dumps({
                "type": "error",
                "error": str(e),
            }) + "\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


@router.post("/sync", response_model=ChatResponse)
async def chat_sync(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    session_id = str(uuid.uuid4())

    session = QuerySession(
        id=uuid.UUID(session_id),
        user_id=uuid.UUID(current_user["user_id"]),
        session_title=request.query[:100],
    )
    db.add(session)
    await db.commit()

    trace = trace_query(session_id, request.query)

    result = await run_legal_research_graph(
        query=request.query,
        user_id=current_user["user_id"],
        filters=request.filters or {},
        db=db,
    )

    message = QueryMessage(
        session_id=uuid.UUID(session_id),
        role="assistant",
        content=result.get("final_answer", ""),
        agent_trace=result.get("agent_trace", []),
        sources={"sources": result.get("sources", [])},
    )
    db.add(message)
    await db.commit()

    return ChatResponse(
        session_id=session_id,
        final_answer=result.get("final_answer", ""),
        sources=result.get("sources", []),
        confidence=result.get("confidence", "MEDIUM"),
        disclaimer=result.get("disclaimer", ""),
        agent_trace=result.get("agent_trace", []),
    )


@router.get("/sessions")
async def list_sessions(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(QuerySession)
        .where(QuerySession.user_id == uuid.UUID(current_user["user_id"]))
        .order_by(QuerySession.created_at.desc())
    )
    result = await db.execute(query)
    sessions = result.scalars().all()

    return [
        {
            "id": str(s.id),
            "session_title": s.session_title,
            "created_at": s.created_at.isoformat(),
        }
        for s in sessions
    ]


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(QuerySession).where(
        QuerySession.id == uuid.UUID(session_id),
        QuerySession.user_id == uuid.UUID(current_user["user_id"]),
    )
    result = await db.execute(query)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages_query = (
        select(QueryMessage)
        .where(QueryMessage.session_id == uuid.UUID(session_id))
        .order_by(QueryMessage.created_at)
    )
    messages_result = await db.execute(messages_query)
    messages = messages_result.scalars().all()

    return {
        "id": str(session.id),
        "session_title": session.session_title,
        "created_at": session.created_at.isoformat(),
        "messages": [
            {
                "id": str(m.id),
                "role": m.role,
                "content": m.content,
                "agent_trace": m.agent_trace,
                "sources": m.sources,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
    }
