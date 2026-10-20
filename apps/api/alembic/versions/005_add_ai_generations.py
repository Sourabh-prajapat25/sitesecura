"""Phase 3 AI Security Advisor generations, tokens and quota tracking

Revision ID: 005_add_ai_generations
Revises: 004_phase_c_monitoring
Create Date: 2026-09-22 19:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '005_add_ai_generations'
down_revision: Union[str, None] = '004_phase_c_monitoring'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    # 1. Add ai_requests_count to usage_records table if not present
    if 'usage_records' in tables:
        usage_cols = {col['name'] for col in inspector.get_columns('usage_records')}
        if 'ai_requests_count' not in usage_cols:
            op.add_column(
                'usage_records',
                sa.Column('ai_requests_count', sa.Integer(), server_default='0', nullable=False)
            )

    # 2. Create ai_generations table if it doesn't already exist
    if 'ai_generations' not in tables:
        op.create_table(
            'ai_generations',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
            sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('website_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('websites.id', ondelete='CASCADE'), nullable=False),
            sa.Column('scan_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('scans.id', ondelete='CASCADE'), nullable=False),
            sa.Column('finding_id', postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column('feature_type', sa.String(64), nullable=False),
            sa.Column('provider', sa.String(32), nullable=False),
            sa.Column('model', sa.String(64), nullable=False),
            sa.Column('prompt_version', sa.String(32), server_default='v1', nullable=False),
            sa.Column('request_status', sa.String(32), server_default='success', nullable=False),
            sa.Column('response_content', sa.Text(), nullable=False),
            sa.Column('structured_response', postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column('tokens_input', sa.Integer(), nullable=True),
            sa.Column('tokens_output', sa.Integer(), nullable=True),
            sa.Column('latency_ms', sa.Integer(), server_default='0', nullable=False),
            sa.Column('fallback_used', sa.Boolean(), server_default=sa.text('false'), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        )
    else:
        # If table already exists, ensure server defaults are present for target columns
        if bind.dialect.name == 'postgresql':
            op.alter_column('ai_generations', 'prompt_version', server_default='v1')
            op.alter_column('ai_generations', 'request_status', server_default='success')
            op.alter_column('ai_generations', 'latency_ms', server_default='0')
            op.alter_column('ai_generations', 'fallback_used', server_default=sa.text('false'))

    # 3. Create indices for querying, reporting, and caching if not present
    existing_indexes = {idx['name'] for idx in inspector.get_indexes('ai_generations')} if 'ai_generations' in tables else set()
    indexes_to_ensure = [
        ('ix_ai_generations_organization_id', ['organization_id']),
        ('ix_ai_generations_user_id', ['user_id']),
        ('ix_ai_generations_website_id', ['website_id']),
        ('ix_ai_generations_scan_id', ['scan_id']),
        ('ix_ai_generations_finding_id', ['finding_id']),
        ('ix_ai_generations_feature_type', ['feature_type']),
        ('ix_ai_gen_org_created', ['organization_id', 'created_at']),
        ('ix_ai_gen_scan_feature', ['scan_id', 'feature_type']),
        ('ix_ai_gen_cache_lookup', ['organization_id', 'scan_id', 'finding_id', 'feature_type', 'prompt_version']),
    ]
    for idx_name, cols in indexes_to_ensure:
        if idx_name not in existing_indexes:
            op.create_index(idx_name, 'ai_generations', cols)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    if 'ai_generations' in tables:
        existing_indexes = {idx['name'] for idx in inspector.get_indexes('ai_generations')}
        for idx_name in [
            'ix_ai_gen_cache_lookup',
            'ix_ai_gen_scan_feature',
            'ix_ai_gen_org_created',
            'ix_ai_generations_feature_type',
            'ix_ai_generations_finding_id',
            'ix_ai_generations_scan_id',
            'ix_ai_generations_website_id',
            'ix_ai_generations_user_id',
            'ix_ai_generations_organization_id',
        ]:
            if idx_name in existing_indexes:
                op.drop_index(idx_name, table_name='ai_generations')
        op.drop_table('ai_generations')

    if 'usage_records' in tables:
        existing_cols = {col['name'] for col in inspector.get_columns('usage_records')}
        if 'ai_requests_count' in existing_cols:
            op.drop_column('usage_records', 'ai_requests_count')
