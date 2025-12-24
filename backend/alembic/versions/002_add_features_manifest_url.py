"""Add features_manifest_url to applications

Revision ID: 002_add_features_manifest_url
Revises: 001_add_app_features
Create Date: 2025-12-24

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "002_add_features_manifest_url"
down_revision = "001_add_app_features"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add features_manifest_url column to applications table
    op.add_column(
        "applications",
        sa.Column(
            "features_manifest_url",
            sa.String(),
            nullable=True,
            comment="Custom URL for features manifest. If null, uses {base_url}/api/v1/app-features/manifest",
        ),
    )


def downgrade() -> None:
    op.drop_column("applications", "features_manifest_url")
