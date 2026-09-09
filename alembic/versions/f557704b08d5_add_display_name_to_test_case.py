"""add display_name to test_case

Revision ID: f557704b08d5
Revises: 77189536fe55
Create Date: 2026-09-09 16:01:23.684562

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f557704b08d5"
down_revision: str | Sequence[str] | None = "77189536fe55"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("test_case", sa.Column("display_name", sa.String(length=500), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("test_case", "display_name")
