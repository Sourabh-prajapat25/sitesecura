"""Add verified badge foundation: security_badge_policies and security_verifications

Revision ID: 012_verified_badge_foundation
Revises: 011_add_scan_metadata
Create Date: 2026-09-29 20:30:00.000000

"""
import uuid
from datetime import datetime, timezone
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '012_verified_badge_foundation'
down_revision: Union[str, None] = '011_add_scan_metadata'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # 1. Create security_badge_policies table if not exists
    if not insp.has_table('security_badge_policies'):
        op.create_table(
            'security_badge_policies',
            sa.Column('id', sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
            sa.Column('name', sa.String(length=100), server_default='default', nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
            sa.Column('minimum_score', sa.Integer(), server_default='70', nullable=False),
            sa.Column('maximum_scan_age_days', sa.Integer(), server_default='30', nullable=False),
            sa.Column('verification_validity_days', sa.Integer(), server_default='30', nullable=False),
            sa.Column('disallow_critical_findings', sa.Boolean(), server_default=sa.text('true'), nullable=False),
            sa.Column('disallow_high_findings', sa.Boolean(), server_default=sa.text('false'), nullable=False),
            sa.Column('require_successful_scan', sa.Boolean(), server_default=sa.text('true'), nullable=False),
            sa.Column('require_authorized_website', sa.Boolean(), server_default=sa.text('true'), nullable=False),
            sa.Column('require_monitoring', sa.Boolean(), server_default=sa.text('false'), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        )

    # Indexes on security_badge_policies
    insp = sa.inspect(bind)
    if insp.has_table('security_badge_policies'):
        indexes = [ix['name'] for ix in insp.get_indexes('security_badge_policies')]
        if 'ix_security_badge_policies_is_active' not in indexes:
            op.create_index('ix_security_badge_policies_is_active', 'security_badge_policies', ['is_active'])

    # 2. Create security_verifications table if not exists
    insp = sa.inspect(bind)
    if not insp.has_table('security_verifications'):
        op.create_table(
            'security_verifications',
            sa.Column('id', sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
            sa.Column('website_id', sa.UUID(as_uuid=True), sa.ForeignKey('websites.id', ondelete='CASCADE'), nullable=False),
            sa.Column('scan_id', sa.UUID(as_uuid=True), sa.ForeignKey('scans.id', ondelete='CASCADE'), nullable=False),
            sa.Column('policy_id', sa.UUID(as_uuid=True), sa.ForeignKey('security_badge_policies.id', ondelete='SET NULL'), nullable=True),
            sa.Column('status', sa.String(length=50), server_default='eligible', nullable=False),
            sa.Column('public_token', sa.String(length=64), nullable=False),
            sa.Column('score', sa.Integer(), nullable=False),
            sa.Column('risk_level', sa.String(length=50), nullable=True),
            sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('eligibility_reason', sa.JSON(), nullable=True),
            sa.Column('monitoring_enabled', sa.Boolean(), server_default=sa.text('false'), nullable=False),
            sa.Column('badge_settings', sa.JSON(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        )

    # Indexes on security_verifications
    insp = sa.inspect(bind)
    if insp.has_table('security_verifications'):
        indexes = [ix['name'] for ix in insp.get_indexes('security_verifications')]
        if 'ix_security_verifications_website_id' not in indexes:
            op.create_index('ix_security_verifications_website_id', 'security_verifications', ['website_id'])
        if 'ix_security_verifications_scan_id' not in indexes:
            op.create_index('ix_security_verifications_scan_id', 'security_verifications', ['scan_id'])
        if 'ix_security_verifications_policy_id' not in indexes:
            op.create_index('ix_security_verifications_policy_id', 'security_verifications', ['policy_id'])
        if 'ix_security_verifications_public_token' not in indexes:
            op.create_index('ix_security_verifications_public_token', 'security_verifications', ['public_token'], unique=True)
        if 'ix_security_verifications_status' not in indexes:
            op.create_index('ix_security_verifications_status', 'security_verifications', ['status'])
        if 'ix_security_verifications_expires_at' not in indexes:
            op.create_index('ix_security_verifications_expires_at', 'security_verifications', ['expires_at'])
        if 'ix_verifications_website_status' not in indexes:
            op.create_index('ix_verifications_website_status', 'security_verifications', ['website_id', 'status'])

    # 3. Seed default badge policy idempotently
    policy_table = sa.table(
        'security_badge_policies',
        sa.column('id', sa.UUID(as_uuid=True)),
        sa.column('name', sa.String),
        sa.column('description', sa.Text),
        sa.column('is_active', sa.Boolean),
        sa.column('minimum_score', sa.Integer),
        sa.column('maximum_scan_age_days', sa.Integer),
        sa.column('verification_validity_days', sa.Integer),
        sa.column('disallow_critical_findings', sa.Boolean),
        sa.column('disallow_high_findings', sa.Boolean),
        sa.column('require_successful_scan', sa.Boolean),
        sa.column('require_authorized_website', sa.Boolean),
        sa.column('require_monitoring', sa.Boolean),
        sa.column('created_at', sa.DateTime(timezone=True)),
        sa.column('updated_at', sa.DateTime(timezone=True)),
    )

    policy_count = bind.execute(sa.select(sa.func.count()).select_from(policy_table)).scalar()
    if policy_count == 0:
        op.bulk_insert(
            policy_table,
            [
                {
                    'id': uuid.uuid4(),
                    'name': 'default',
                    'description': 'Default SiteSecura Verified Badge policy',
                    'is_active': True,
                    'minimum_score': 70,
                    'maximum_scan_age_days': 30,
                    'verification_validity_days': 30,
                    'disallow_critical_findings': True,
                    'disallow_high_findings': False,
                    'require_successful_scan': True,
                    'require_authorized_website': True,
                    'require_monitoring': False,
                    'created_at': datetime.now(timezone.utc),
                    'updated_at': datetime.now(timezone.utc),
                }
            ]
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if insp.has_table('security_verifications'):
        op.drop_table('security_verifications')

    if insp.has_table('security_badge_policies'):
        op.drop_table('security_badge_policies')
