from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.common import BaseSchema

CatalogStatus = Literal["active", "inactive"]
AppCategory = Literal["studio", "production", "governance", "data", "settings"]


class AppCatalogBase(BaseSchema):
    """Base schema for AppCatalog."""
    
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    logo_url: str | None = Field(None, max_length=500)
    category: AppCategory | None = Field(None, description="Application category")


class AppCatalogCreate(AppCatalogBase):
    """Schema for creating an app catalog entry."""
    
    id: str = Field(..., min_length=1, max_length=50, pattern=r'^[a-z][a-z0-9_]*$')
    status: CatalogStatus = Field(default="active")


class AppCatalogUpdate(BaseSchema):
    """Schema for updating an app catalog entry."""
    
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    logo_url: str | None = Field(None, max_length=500)
    category: AppCategory | None = None
    status: CatalogStatus | None = None


class AppCatalogRead(AppCatalogBase):
    """Schema for reading app catalog data."""
    
    id: str
    status: CatalogStatus
    category: AppCategory | None = None
    created_at: datetime
    updated_at: datetime
    
    # Computed
    tenant_count: int | None = None

    class Config:
        from_attributes = True


class AppCatalogList(BaseSchema):
    """Minimal schema for dropdown/list."""
    
    id: str
    name: str
    description: str | None = None
    logo_url: str | None = None
    category: AppCategory | None = None
    status: CatalogStatus

    class Config:
        from_attributes = True
