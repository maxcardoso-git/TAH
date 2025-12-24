import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.application import Application


class FeatureLifecycle(str, enum.Enum):
    ACTIVE = "active"
    DEPRECATED = "deprecated"
    REMOVED = "removed"


class AppFeature(Base):
    """
    App features discovered from each application via /api/v1/app-features/manifest.
    Replaces ExternalPermission with a richer feature-based model.

    Permission format: feature_id:action (e.g., "orchestrator.projects:read")
    """

    __tablename__ = "app_features"

    # Primary key is the feature ID in format: app.module.feature
    id: Mapped[str] = mapped_column(String, primary_key=True)

    application_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String)

    # Categorization
    module: Mapped[str] = mapped_column(String, nullable=False, index=True)
    module_name: Mapped[str | None] = mapped_column(String)
    subcategory: Mapped[str | None] = mapped_column(String)

    # Hierarchy support
    parent_id: Mapped[str | None] = mapped_column(
        String,
        ForeignKey("app_features.id", ondelete="CASCADE"),
    )

    # Navigation/UI
    path: Mapped[str] = mapped_column(String, nullable=False)
    icon: Mapped[str | None] = mapped_column(String)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Actions that can be performed on this feature
    actions: Mapped[list] = mapped_column(
        JSONB,
        nullable=False,
        default=["read"],
    )

    # Feature flags
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    requires_org: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Lifecycle tracking
    lifecycle: Mapped[str] = mapped_column(
        String,
        nullable=False,
        default=FeatureLifecycle.ACTIVE.value,
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

    # Additional metadata
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
        back_populates="app_features",
    )
    parent: Mapped["AppFeature | None"] = relationship(
        "AppFeature",
        remote_side="AppFeature.id",
        back_populates="children",
        foreign_keys=[parent_id],
    )
    children: Mapped[list["AppFeature"]] = relationship(
        "AppFeature",
        back_populates="parent",
        foreign_keys=[parent_id],
    )

    def __repr__(self) -> str:
        return f"<AppFeature(id={self.id}, name={self.name})>"

    def get_permission_keys(self) -> list[str]:
        """Generate all permission keys for this feature (feature_id:action)."""
        return [f"{self.id}:{action}" for action in self.actions]
