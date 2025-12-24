"""Add app_features table

Revision ID: 001_add_app_features
Revises:
Create Date: 2025-12-24

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "001_add_app_features"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create app_features table
    op.create_table(
        "app_features",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("application_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("module", sa.String(), nullable=False),
        sa.Column("module_name", sa.String(), nullable=True),
        sa.Column("subcategory", sa.String(), nullable=True),
        sa.Column("parent_id", sa.String(), nullable=True),
        sa.Column("path", sa.String(), nullable=False),
        sa.Column("icon", sa.String(), nullable=True),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "actions",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default='["read"]',
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("requires_org", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "lifecycle", sa.String(), nullable=False, server_default="active"
        ),
        sa.Column("first_seen_version", sa.String(), nullable=True),
        sa.Column("last_seen_version", sa.String(), nullable=True),
        sa.Column(
            "discovered_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["application_id"],
            ["applications.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["parent_id"],
            ["app_features.id"],
            ondelete="CASCADE",
        ),
    )

    # Create indexes
    op.create_index(
        "ix_app_features_application_id",
        "app_features",
        ["application_id"],
    )
    op.create_index(
        "ix_app_features_module",
        "app_features",
        ["module"],
    )


def downgrade() -> None:
    op.drop_index("ix_app_features_module")
    op.drop_index("ix_app_features_application_id")
    op.drop_table("app_features")
