import enum
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.app_catalog import AppCatalog
    from app.models.app_feature import AppFeature
    from app.models.external_permission import ExternalPermission
    from app.models.tenant import Tenant


class AppStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    MAINTENANCE = "maintenance"
    DEPRECATED = "deprecated"


class Application(Base):
    """Application model - represents an integrated application in the platform."""

    __tablename__ = "applications"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    app_catalog_id: Mapped[str | None] = mapped_column(
        String,
        ForeignKey("app_catalog.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String)
    logo_url: Mapped[str | None] = mapped_column(String)
    icon: Mapped[str | None] = mapped_column(String)
    base_url: Mapped[str] = mapped_column(String, nullable=False)
    callback_url: Mapped[str | None] = mapped_column(String)
    launch_url: Mapped[str | None] = mapped_column(String)
    features_manifest_url: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
        comment="Custom URL for features manifest. If null, uses {base_url}/api/v1/app-features/manifest",
    )
    status: Mapped[AppStatus] = mapped_column(
        Enum(
            AppStatus,
            name="app_status",
            create_type=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=AppStatus.ACTIVE,
    )
    current_version: Mapped[str | None] = mapped_column(String)
    healthcheck_url: Mapped[str | None] = mapped_column(String)
    auth_mode: Mapped[str] = mapped_column(String, nullable=False, default="platform_jwt")
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
    catalog: Mapped["AppCatalog | None"] = relationship(
        "AppCatalog",
        back_populates="tenant_applications",
        foreign_keys=[app_catalog_id],
    )
    tenant_applications: Mapped[list["TenantApplication"]] = relationship(
        "TenantApplication",
        back_populates="application",
        cascade="all, delete-orphan",
    )
    external_permissions: Mapped[list["ExternalPermission"]] = relationship(
        "ExternalPermission",
        back_populates="application",
        cascade="all, delete-orphan",
    )
    app_features: Mapped[list["AppFeature"]] = relationship(
        "AppFeature",
        back_populates="application",
        cascade="all, delete-orphan",
    )

    @property
    def display_name(self) -> str:
        return self.name or (self.catalog.name if self.catalog else self.id)

    @property
    def display_description(self) -> str | None:
        return self.description or (self.catalog.description if self.catalog else None)

    @property
    def display_logo_url(self) -> str | None:
        return self.logo_url or (self.catalog.logo_url if self.catalog else None)

    def __repr__(self) -> str:
        return f"<Application(id={self.id}, name={self.name})>"


class TenantApplication(Base):
    """Tenant-Application enablement - which apps are enabled for each tenant."""

    __tablename__ = "tenant_applications"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        server_default=func.gen_random_uuid(),
    )
    tenant_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    application_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[AppStatus] = mapped_column(
        Enum(
            AppStatus,
            name="app_status",
            create_type=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        default=AppStatus.ACTIVE,
    )
    enabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    disabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    config: Mapped[dict] = mapped_column(
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
    tenant: Mapped["Tenant"] = relationship(
        "Tenant",
        back_populates="tenant_applications",
    )
    application: Mapped["Application"] = relationship(
        "Application",
        back_populates="tenant_applications",
    )

    def __repr__(self) -> str:
        return f"<TenantApplication(tenant_id={self.tenant_id}, app_id={self.application_id})>"
