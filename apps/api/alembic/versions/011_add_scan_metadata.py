"""Add scan_metadata JSON column to scans table

Revision ID: 011_add_scan_metadata
Revises: 010_add_blog_ecosystem_e7
Create Date: 2026-09-24 23:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '011_add_scan_metadata'
down_revision: Union[str, None] = '010_add_blog_ecosystem_e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    columns = [col['name'] for col in insp.get_columns('scans')]
    if 'scan_metadata' not in columns:
        op.add_column(
            'scans',
            sa.Column('scan_metadata', sa.JSON(), nullable=True)
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    columns = [col['name'] for col in insp.get_columns('scans')]
    if 'scan_metadata' in columns:
        op.drop_column('scans', 'scan_metadata')
