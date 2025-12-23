import asyncio
from collections.abc import AsyncGenerator
from typing import Any
from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.database import Base, get_db
from app.main import app

# Test database URL
TEST_DATABASE_URL = settings.database_url.replace("/iam_db", "/iam_test_db")

# Create test engine
test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
test_session_maker = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Create a fresh database session for each test."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with test_session_maker() as session:
        yield session
        await session.rollback()

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create a test client with database override."""

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers() -> dict[str, str]:
    """Create authorization headers with a test token."""
    from app.core.security import create_access_token

    token = create_access_token(
        subject=str(uuid4()),
        tenant_id=str(uuid4()),
        roles=["admin"],
        permissions=["*"],
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def sample_tenant_data() -> dict[str, Any]:
    """Sample tenant data for testing."""
    return {
        "name": "Test Tenant",
        "slug": f"test-tenant-{uuid4().hex[:8]}",
        "metadata": {"plan": "enterprise"},
    }


@pytest.fixture
def sample_application_data() -> dict[str, Any]:
    """Sample application data for testing."""
    return {
        "id": f"test_app_{uuid4().hex[:8]}",
        "name": "Test Application",
        "description": "A test application",
        "base_url": "https://api.test-app.example.com",
        "metadata": {},
    }


@pytest.fixture
def sample_role_data() -> dict[str, Any]:
    """Sample role data for testing."""
    return {
        "name": f"Test Role {uuid4().hex[:8]}",
        "description": "A test role",
        "metadata": {},
    }
