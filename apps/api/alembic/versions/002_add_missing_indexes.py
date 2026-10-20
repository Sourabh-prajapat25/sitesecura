"""Add missing indexes for alerts and usage_records

Revision ID: 002_add_missing_indexes
Revises: 001_initial_schema
Create Date: 2026-08-19 23:58:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '002_add_missing_indexes'
down_revision: Union[str, None] = '001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add missing index on alerts (organization_id, created_at)
    op.create_index('ix_alerts_org_created', 'alerts', ['organization_id', 'created_at'], unique=False)

    # Add missing unique index on usage_records (organization_id, period_month)
    op.create_index('ix_usage_org_period', 'usage_records', ['organization_id', 'period_month'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_usage_org_period', table_name='usage_records')
    op.drop_index('ix_alerts_org_created', table_name='alerts')
