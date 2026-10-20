"""Phase B organization ownership and direct tenant scoping

Revision ID: 003_phase_b_ownership_and_quotas
Revises: 002_add_missing_indexes
Create Date: 2026-09-19 23:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '003_phase_b_ownership_and_quotas'
down_revision: Union[str, None] = '002_add_missing_indexes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add organization_id column to scans table
    op.add_column(
        'scans',
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=True)
    )
    op.create_index('ix_scans_organization_id', 'scans', ['organization_id'], unique=False)

    # 2. Add organization_id column to reports table
    op.add_column(
        'reports',
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=True)
    )
    op.create_index('ix_reports_organization_id', 'reports', ['organization_id'], unique=False)

    # 3. Idempotent Data Backfill for existing scans
    # From associated website
    op.execute(
        """
        UPDATE scans
        SET organization_id = websites.organization_id
        FROM websites
        WHERE scans.website_id = websites.id
          AND scans.organization_id IS NULL;
        """
    )
    # From requesting user if website is not attached
    op.execute(
        """
        UPDATE scans
        SET organization_id = users.organization_id
        FROM users
        WHERE scans.requested_by_user_id = users.id
          AND scans.organization_id IS NULL
          AND users.organization_id IS NOT NULL;
        """
    )

    # 4. Idempotent Data Backfill for existing reports
    op.execute(
        """
        UPDATE reports
        SET organization_id = scans.organization_id
        FROM scans
        WHERE reports.scan_id = scans.id
          AND reports.organization_id IS NULL
          AND scans.organization_id IS NOT NULL;
        """
    )


def downgrade() -> None:
    op.drop_index('ix_reports_organization_id', table_name='reports')
    op.drop_column('reports', 'organization_id')
    op.drop_index('ix_scans_organization_id', table_name='scans')
    op.drop_column('scans', 'organization_id')
