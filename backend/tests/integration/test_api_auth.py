import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch, MagicMock
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))


@pytest.fixture
def mock_db_session():
    session = AsyncMock()
    return session


@pytest.fixture
def mock_user():
    from backend.app.core.models import User
    user = MagicMock(spec=User)
    user.id = "test-uuid-123"
    user.email = "test@example.com"
    user.password_hash = "$2b$12$hashed_password"
    user.full_name = "Test User"
    user.role = "researcher"
    user.organisation = "Test Org"
    return user


def test_token_creation():
    from backend.app.core.security import create_access_token, verify_token

    token = create_access_token("user-123", "researcher")

    assert token is not None
    assert isinstance(token, str)
    assert len(token) > 0

    payload = verify_token(token)

    assert payload["user_id"] == "user-123"
    assert payload["role"] == "researcher"


def test_verify_invalid_token():
    from backend.app.core.security import verify_token
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        verify_token("invalid.token.here")

    assert exc_info.value.status_code == 401


def test_password_hashing():
    from backend.app.core.security import get_password_hash, verify_password

    password = "test_password_123"
    hashed = get_password_hash(password)

    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("wrong_password", hashed) is False


def test_role_hierarchy():
    from backend.app.core.security import ROLE_HIERARCHY

    assert ROLE_HIERARCHY["public"] < ROLE_HIERARCHY["researcher"]
    assert ROLE_HIERARCHY["researcher"] < ROLE_HIERARCHY["admin"]


def test_registration_request_model():
    from backend.app.api.routes.auth import UserRegister
    from pydantic import ValidationError

    valid_data = {
        "email": "test@example.com",
        "password": "securepassword123",
        "full_name": "Test User",
        "organisation": "Test Org",
    }

    user = UserRegister(**valid_data)
    assert user.email == "test@example.com"
    assert user.role == "researcher"


def test_login_request_model():
    from backend.app.api.routes.auth import UserLogin

    valid_data = {
        "email": "test@example.com",
        "password": "securepassword123",
    }

    login = UserLogin(**valid_data)
    assert login.email == "test@example.com"
