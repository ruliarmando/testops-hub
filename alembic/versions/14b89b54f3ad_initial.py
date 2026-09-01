"""initial

Revision ID: 14b89b54f3ad
Revises: 
Create Date: 2026-09-01 09:07:49.561991

"""
from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = '14b89b54f3ad'
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""


def downgrade() -> None:
    """Downgrade schema."""
