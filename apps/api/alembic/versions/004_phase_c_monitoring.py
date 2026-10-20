"""Phase C website monitoring enhancements, alert deduplication and tenant scoping

Revision ID: 004_phase_c_monitoring
Revises: 003_phase_b_ownership_and_quotas
Create Date: 2026-09-20 21:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '004_phase_c_monitoring'
down_revision: Union[str, None] = '003_phase_b_ownership_and_quotas'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add Phase C columns to monitoring table
    op.add_column(
        'monitoring',
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=True)
    )
    op.add_column(
        'monitoring',
        sa.Column('status', sa.String(50), server_default='active', nullable=False)
    )
    op.add_column(
        'monitoring',
        sa.Column('last_scan_id', postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.add_column(
        'monitoring',
        sa.Column('last_success_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        'monitoring',
        sa.Column('last_failure_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        'monitoring',
        sa.Column('last_error', sa.Text(), nullable=True)
    )
    op.create_index('ix_monitoring_organization_id', 'monitoring', ['organization_id'], unique=False)

    # 2. Idempotent Backfill: propagate organization_id from websites to monitoring
    op.execute(
        """
        UPDATE monitoring
        SET organization_id = websites.organization_id
        FROM websites
        WHERE monitoring.website_id = websites.id
          AND monitoring.organization_id IS NULL;
        """
    )

    # 3. Add fingerprint column to alerts table for atomic deduplication
    op.add_column(
        'alerts',
        sa.Column('fingerprint', sa.String(255), nullable=True)
    )
    op.create_index('ix_alerts_fingerprint', 'alerts', ['fingerprint'], unique=False)
    op.create_index('ix_alerts_org_fingerprint_status', 'alerts', ['organization_id', 'fingerprint', 'status'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_alerts_org_fingerprint_status', table_name='alerts')
    op.drop_index('ix_alerts_fingerprint', table_name='alerts')
    op.drop_column('alerts', 'fingerprint')

    op.drop_index('ix_monitoring_organization_id', table_name='monitoring')
    op.drop_column('monitoring', 'last_error')
    op.drop_column('monitoring', 'last_failure_at')
    op.drop_column('monitoring', 'last_success_at')
    op.drop_column('monitoring', 'last_scan_id')
    op.drop_column('monitoring', 'status')
    op.drop_column('monitoring', 'organization_id')
