import enum
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.application import Application
    from app.models.user import User


class PermissionLifecycle(str, enum.Enum):
    ACTIVE = "active"
    DEPRECATED = "deprecated"
    REMOVED = "removed"


class ExternalPermission(Base):
    """External permissions discovered from each application via /api/meta/access."""

    __tablename__ = "external_permissions"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    application_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    module_key: Mapped[str] = mapped_column(String, nullable=False, index=True)
    module_name: Mapped[str | None] = mapped_column(String)
    permission_key: Mapped[str] = mapped_column(String, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String)
    lifecycle: Mapped[PermissionLifecycle] = mapped_column(
        Enum(PermissionLifecycle, name="permission_lifecycle", create_type=False),
        nullable=False,
        default=PermissionLifecycle.ACTIVE,
    )
    first_seen_version: Mapped[str | None] = mapped_column(String)
    last_seen_version: Mapped[str | None] = mapped_column(String)
    discovered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    metadata_: Mapped[dict] = mapped_column(
        "metadata",
        JSONB,
        nullable=False,
        default=dict,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    application: Mapped["Application"] = relationship(
        "Application",
        back_populates="external_permissions",
    )

    def __repr__(self) -> str:
        return f"<ExternalPermission(app={self.application_id}, key={self.permission_key})>"


class PermissionSyncRun(Base):
    """Permission sync runs for observability and governance."""

    __tablename__ = "permission_sync_runs"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    application_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    run_type: Mapped[str] = mapped_column(String, nullable=False, default="pull")
    requested_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    app_version: Mapped[str | None] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, nullable=False, default="success")
    summary: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
    )
    error_message: Mapped[str | None] = mapped_column(String)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    def __repr__(self) -> str:
        return f"<PermissionSyncRun(app={self.application_id}, status={self.status})>"
