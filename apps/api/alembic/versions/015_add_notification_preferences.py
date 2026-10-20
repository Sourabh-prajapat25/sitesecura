"""Add notification_preferences to users

Revision ID: 015_add_notification_preferences
Revises: 014_add_payment_provider_abstraction
Create Date: 2026-10-18 23:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '015_add_notification_preferences'
down_revision: Union[str, None] = '014_add_payment_provider_abstraction'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    context = op.get_context()
    if getattr(context, "as_sql", False):
        op.add_column('users', sa.Column('notification_preferences', postgresql.JSON(astext_type=sa.Text()), nullable=True))
        return

    bind = op.get_bind()
    insp = sa.inspect(bind)
    user_columns = [c['name'] for c in insp.get_columns('users')]

    if 'notification_preferences' not in user_columns:
        if bind.dialect.name == 'postgresql':
            op.add_column('users', sa.Column('notification_preferences', postgresql.JSON(astext_type=sa.Text()), nullable=True))
        else:
            op.add_column('users', sa.Column('notification_preferences', sa.JSON(), nullable=True))


def downgrade() -> None:
    context = op.get_context()
    if getattr(context, "as_sql", False):
        op.drop_column('users', 'notification_preferences')
        return

    bind = op.get_bind()
    insp = sa.inspect(bind)
    user_columns = [c['name'] for c in insp.get_columns('users')]

    if 'notification_preferences' in user_columns:
        op.drop_column('users', 'notification_preferences')
