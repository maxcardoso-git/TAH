from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.models.audit_log import AuditAction
from app.schemas.common import BaseSchema


class AuditLogBase(BaseSchema):
    """Base audit log schema."""

    action: AuditAction
    entity_type: str
    entity_id: str | None = None
    entity_ref: dict = Field(default_factory=dict)
    changes: dict = Field(default_factory=dict)
    reason: str | None = None


class AuditLogCreate(AuditLogBase):
    """Schema for creating an audit log entry (internal use)."""

    tenant_id: UUID | None = None
    actor_user_id: UUID | None = None


class AuditLogRead(AuditLogBase):
    """Schema for reading audit log data."""

    id: UUID
    tenant_id: UUID | None = None
    actor_user_id: UUID | None = None
    created_at: datetime

    # Computed fields for UI
    actor_name: str | None = None
    entity_name: str | None = None


class AuditLogFilter(BaseSchema):
    """Filter parameters for audit log queries."""

    action: AuditAction | None = None
    entity_type: str | None = None
    entity_id: str | None = None
    actor_user_id: UUID | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None


class AuditLogExport(BaseSchema):
    """Request for exporting audit logs."""

    format: str = Field(default="json", pattern=r"^(json|csv)$")
    filters: AuditLogFilter | None = None
