"""Add onboarding_status column to organizations

Revision ID: 013_add_onboarding_status
Revises: 012_verified_badge_foundation
Create Date: 2026-10-03 14:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '013_add_onboarding_status'
down_revision: Union[str, None] = '012_verified_badge_foundation'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    columns = [c['name'] for c in insp.get_columns('organizations')]
    if 'onboarding_status' not in columns:
        op.add_column(
            'organizations',
            sa.Column(
                'onboarding_status',
                sa.String(length=50),
                server_default='completed',
                nullable=False,
            ),
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    columns = [c['name'] for c in insp.get_columns('organizations')]
    if 'onboarding_status' in columns:
        op.drop_column('organizations', 'onboarding_status')
