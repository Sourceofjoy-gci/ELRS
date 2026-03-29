import pytest
import uuid
import sys
import os
from unittest.mock import MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# ─── Mock minio before importing app ──────────────────────────────────────────
sys.modules['minio'] = MagicMock()

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.models import User
from app.core.security import create_access_token, get_password_hash


# ─── Database Fixtures ────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def db_engine():
    """SQLite in-memory async engine for the test session."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    yield engine
    # Sync disposal after async engine
    engine.sync_engine.dispose()


@pytest.fixture(scope="session")
async def db_setup(db_engine):
    """Create tables in the async engine."""
    async with db_engine.begin() as conn:
        from app.core.database import Base
        await conn.run_sync(Base.metadata.create_all, tables=[
            Base.metadata.tables['users'],
            Base.metadata.tables['query_sessions'],
            Base.metadata.tables['query_messages'],
            Base.metadata.tables['access_log'],
            Base.metadata.tables['agent_config'],
            Base.metadata.tables['ingestion_jobs'],
        ])


@pytest.fixture
async def db_session(db_engine, db_setup) -> AsyncSession:
    """Per-test async session."""
    session = async_sessionmaker(bind=db_engine, expire_on_commit=False)()
    yield session
    await session.close()


# ─── Auth Fixtures ────────────────────────────────────────────────────────────

@pytest.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Create a test user in the DB. Uses unique email per test to avoid conflicts."""
    unique_id = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        email=f"testuser_{unique_id}@example.com",
        password_hash=get_password_hash("testpassword123"),
        full_name="Test User",
        role="researcher",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def admin_user(db_session: AsyncSession) -> User:
    """Create an admin user in the DB. Uses unique email per test."""
    unique_id = uuid.uuid4().hex[:8]
    user = User(
        id=uuid.uuid4(),
        email=f"admin_{unique_id}@example.com",
        password_hash=get_password_hash("adminpassword123"),
        full_name="Admin User",
        role="admin",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
def auth_token(test_user: User) -> str:
    """Return a valid JWT access token for test_user."""
    return create_access_token(str(test_user.id), test_user.role)


@pytest.fixture
def admin_token(admin_user: User) -> str:
    """Return a valid JWT access token for admin_user."""
    return create_access_token(str(admin_user.id), admin_user.role)


@pytest.fixture
def auth_headers(auth_token: str) -> dict:
    """Headers dict with Bearer token for API calls."""
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture
def admin_headers(admin_token: str) -> dict:
    """Headers dict with Bearer token for admin API calls."""
    return {"Authorization": f"Bearer {admin_token}"}


# ─── Mock Ollama Fixture ──────────────────────────────────────────────────────

@pytest.fixture
def mock_ollama(monkeypatch):
    """Stub all Ollama LLM calls in agent tests."""
    async def mock_chat(messages, model):
        return {
            "message": {
                "content": '{"agents": ["STATUTE"], "reasoning": "test", "confidence": 0.9, "query_type": "test"}'
            }
        }

    from app.llm import ollama_client
    monkeypatch.setattr(ollama_client, "get_ollama_client", lambda: MagicMock(chat=mock_chat))
    yield mock_chat


# ─── App Client Fixtures ─────────────────────────────────────────────────────

@pytest.fixture
def app(db_session):
    """Import and return the FastAPI app instance with overridden get_db."""
    from app.main import app as fastapi_app
    from app.core.database import get_db

    # Override get_db to use our async test session
    async def override_get_db():
        yield db_session

    fastapi_app.dependency_overrides[get_db] = override_get_db
    yield fastapi_app
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def client(app):
    """Synchronous test client for endpoint tests."""
    from fastapi.testclient import TestClient
    return TestClient(app)


@pytest.fixture
async def async_client(app):
    """Async client for testing streaming endpoints."""
    from httpx import AsyncClient, ASGITransport
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
