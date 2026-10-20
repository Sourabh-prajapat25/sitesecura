"""Initial database schema for Scanly

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-08-19 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Organizations
    op.create_table(
        'organizations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('type', sa.String(50), nullable=False, server_default='personal'),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('logo_url', sa.String(500), nullable=True),
        sa.Column('brand_name', sa.String(255), nullable=True),
        sa.Column('primary_color', sa.String(50), server_default='#0ea5e9', nullable=True),
        sa.Column('footer_text', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # Users
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('firebase_uid', sa.String(128), unique=True, index=True, nullable=False),
        sa.Column('email', sa.String(255), unique=True, index=True, nullable=False),
        sa.Column('name', sa.String(255), nullable=True),
        sa.Column('role', sa.String(50), nullable=False, server_default='free'),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='SET NULL'), nullable=True),
        sa.Column('avatar_url', sa.String(500), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # Organization Members
    op.create_table(
        'organization_members',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(50), server_default='member', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_org_member_org_user', 'organization_members', ['organization_id', 'user_id'], unique=True)

    # Websites
    op.create_table(
        'websites',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('domain', sa.String(255), nullable=False),
        sa.Column('normalized_domain', sa.String(255), nullable=False, index=True),
        sa.Column('status', sa.String(50), server_default='active', nullable=False),
        sa.Column('last_scan_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('monitoring_enabled', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('monitoring_frequency', sa.String(50), server_default='weekly', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_websites_org_domain', 'websites', ['organization_id', 'normalized_domain'], unique=True)

    # Scans
    op.create_table(
        'scans',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('website_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('websites.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('requested_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('domain', sa.String(255), nullable=False),
        sa.Column('normalized_domain', sa.String(255), nullable=False, index=True),
        sa.Column('target_ip', sa.String(100), nullable=True),
        sa.Column('status', sa.String(50), server_default='queued', nullable=False, index=True),
        sa.Column('scan_type', sa.String(50), server_default='public', nullable=False),
        sa.Column('score', sa.Integer(), nullable=True),
        sa.Column('risk_level', sa.String(50), nullable=True),
        sa.Column('score_breakdown', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('passed_checks_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('total_checks_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('scan_duration_ms', sa.Integer(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_scans_domain_created', 'scans', ['normalized_domain', 'created_at'])
    op.create_index('ix_scans_status_created', 'scans', ['status', 'created_at'])

    # Scan Checks
    op.create_table(
        'scan_checks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('scan_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('scans.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('check_type', sa.String(100), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('status', sa.String(50), nullable=False),
        sa.Column('severity', sa.String(50), server_default='info', nullable=False),
        sa.Column('score_impact', sa.Integer(), server_default='0', nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('summary', sa.Text(), nullable=False),
        sa.Column('why_it_matters', sa.Text(), nullable=True),
        sa.Column('how_to_fix', sa.Text(), nullable=True),
        sa.Column('estimated_fix_minutes', sa.Integer(), server_default='5', nullable=False),
        sa.Column('documentation_url', sa.String(500), nullable=True),
        sa.Column('technical_details', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('evidence', sa.Text(), nullable=True),
        sa.Column('confidence', sa.Float(), server_default='1.0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # Recommendations
    op.create_table(
        'recommendations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('check_type', sa.String(100), unique=True, index=True, nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('why_it_matters', sa.Text(), nullable=False),
        sa.Column('how_to_fix', sa.Text(), nullable=False),
        sa.Column('estimated_fix_minutes', sa.Integer(), server_default='5', nullable=False),
        sa.Column('documentation_url', sa.String(500), nullable=False),
        sa.Column('severity', sa.String(50), server_default='info', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # Reports
    op.create_table(
        'reports',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('scan_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('scans.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('website_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('websites.id', ondelete='CASCADE'), nullable=True, index=True),
        sa.Column('report_number', sa.String(100), unique=True, nullable=False),
        sa.Column('pdf_path', sa.String(500), nullable=False),
        sa.Column('file_size_bytes', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # Monitoring
    op.create_table(
        'monitoring',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('website_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('websites.id', ondelete='CASCADE'), unique=True, nullable=False),
        sa.Column('enabled', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('frequency', sa.String(50), server_default='weekly', nullable=False),
        sa.Column('last_run_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('next_run_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # Alerts
    op.create_table(
        'alerts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('website_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('websites.id', ondelete='CASCADE'), nullable=True, index=True),
        sa.Column('scan_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('scans.id', ondelete='SET NULL'), nullable=True),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('severity', sa.String(50), server_default='warning', nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('status', sa.String(50), server_default='unread', nullable=False),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # Subscriptions
    op.create_table(
        'subscriptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), unique=True, nullable=False, index=True),
        sa.Column('stripe_customer_id', sa.String(100), unique=True, index=True, nullable=False),
        sa.Column('stripe_subscription_id', sa.String(100), unique=True, index=True, nullable=True),
        sa.Column('plan', sa.String(50), server_default='free', nullable=False),
        sa.Column('status', sa.String(50), server_default='active', nullable=False),
        sa.Column('current_period_start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('current_period_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancel_at_period_end', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # Usage Records
    op.create_table(
        'usage_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('period_month', sa.String(7), nullable=False),
        sa.Column('scans_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('monitored_sites_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('pdf_reports_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # Audit Logs
    op.create_table(
        'audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('entity_type', sa.String(100), nullable=False),
        sa.Column('entity_id', sa.String(100), nullable=True),
        sa.Column('metadata_json', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('ip_address', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # Blog Categories
    op.create_table(
        'blog_categories',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(100), unique=True, nullable=False),
        sa.Column('slug', sa.String(100), unique=True, index=True, nullable=False),
        sa.Column('description', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # Blog Posts
    op.create_table(
        'blog_posts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(255), unique=True, index=True, nullable=False),
        sa.Column('excerpt', sa.Text(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('category_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('blog_categories.id', ondelete='SET NULL'), nullable=True),
        sa.Column('featured_image', sa.String(500), nullable=True),
        sa.Column('seo_title', sa.String(255), nullable=True),
        sa.Column('meta_description', sa.String(500), nullable=True),
        sa.Column('canonical_url', sa.String(500), nullable=True),
        sa.Column('og_image', sa.String(500), nullable=True),
        sa.Column('status', sa.String(50), server_default='draft', nullable=False),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # Support Tickets
    op.create_table(
        'support_tickets',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='SET NULL'), nullable=True),
        sa.Column('subject', sa.String(255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('status', sa.String(50), server_default='open', nullable=False),
        sa.Column('priority', sa.String(50), server_default='normal', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # Contact Messages
    op.create_table(
        'contact_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('subject', sa.String(255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('status', sa.String(50), server_default='new', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('contact_messages')
    op.drop_table('support_tickets')
    op.drop_table('blog_posts')
    op.drop_table('blog_categories')
    op.drop_table('audit_logs')
    op.drop_table('usage_records')
    op.drop_table('subscriptions')
    op.drop_table('alerts')
    op.drop_table('monitoring')
    op.drop_table('reports')
    op.drop_table('recommendations')
    op.drop_table('scan_checks')
    op.drop_table('scans')
    op.drop_table('websites')
    op.drop_table('organization_members')
    op.drop_table('users')
    op.drop_table('organizations')
