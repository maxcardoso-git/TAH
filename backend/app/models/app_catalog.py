from datetime import datetime
from typing import TYPE_CHECKING
import enum

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.application import Application


class CatalogStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class AppCategory(str, enum.Enum):
    """Application category for organizing in the catalog."""
    STUDIO = "studio"
    PRODUCTION = "production"
    GOVERNANCE = "governance"
    DATA = "data"
    SETTINGS = "settings"


class AppCatalog(Base):
    """
    AppCatalog model - Global dictionary of applications.
    
    This is the master data for applications. Contains only global 
    information like name, description, and logo.
    
    Tenant-specific configurations are stored in the Application model.
    """

    __tablename__ = "app_catalog"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String)
    logo_url: Mapped[str | None] = mapped_column(String)
    category: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
        default=None,
    )
    status: Mapped[str] = mapped_column(
        String,
        nullable=False,
        default="active",
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
    tenant_applications: Mapped[list["Application"]] = relationship(
        "Application",
        back_populates="catalog",
        foreign_keys="Application.app_catalog_id",
    )

    def __repr__(self) -> str:
        return f"<AppCatalog {self.id}: {self.name}>"
