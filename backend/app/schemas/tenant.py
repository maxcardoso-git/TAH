from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.models.tenant import TenantStatus
from app.schemas.common import BaseSchema


class TenantBase(BaseSchema):
    """Base tenant schema with common fields."""

    name: str = Field(..., min_length=1, max_length=255, description="Tenant name")
    slug: str | None = Field(
        None,
        min_length=1,
        max_length=100,
        pattern=r"^[a-z0-9-]+$",
        description="URL-friendly unique identifier",
    )
    metadata_: dict = Field(default_factory=dict, alias="metadata")


class TenantCreate(TenantBase):
    """Schema for creating a new tenant."""

    pass


class TenantUpdate(BaseSchema):
    """Schema for updating an existing tenant."""

    name: str | None = Field(None, min_length=1, max_length=255)
    slug: str | None = Field(None, min_length=1, max_length=100, pattern=r"^[a-z0-9-]+$")
    status: TenantStatus | None = None
    metadata_: dict | None = Field(None, alias="metadata")


class TenantRead(TenantBase):
    """Schema for reading tenant data."""

    id: UUID
    status: TenantStatus
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    # Computed fields for UI
    applications_count: int | None = None
    users_count: int | None = None
    roles_count: int | None = None


class TenantSummary(BaseSchema):
    """Minimal tenant info for references."""

    id: UUID
    name: str
    slug: str | None
    status: TenantStatus
