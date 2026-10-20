"""Add blog ecosystem: resources, newsletter_subscribers, content_analytics_events

Revision ID: 010_add_blog_ecosystem_e7
Revises: 009_add_blog_taxonomy_e5
Create Date: 2026-09-23 23:30:00.000000

"""
import uuid
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '010_add_blog_ecosystem_e7'
down_revision: Union[str, None] = '009_add_blog_taxonomy_e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # 1. Create resources table if not exists
    if not insp.has_table('resources'):
        op.create_table(
            'resources',
            sa.Column('id', sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
            sa.Column('title', sa.String(length=255), nullable=False),
            sa.Column('slug', sa.String(length=255), nullable=False),
            sa.Column('description', sa.Text(), nullable=False),
            sa.Column('resource_type', sa.String(length=50), nullable=False),
            sa.Column('category', sa.String(length=100), nullable=True),
            sa.Column('featured_image', sa.String(length=500), nullable=True),
            sa.Column('featured_media_id', sa.UUID(as_uuid=True), sa.ForeignKey('media_assets.id', ondelete='SET NULL'), nullable=True),
            sa.Column('file_url', sa.String(length=500), nullable=True),
            sa.Column('external_url', sa.String(length=500), nullable=True),
            sa.Column('content', sa.Text(), nullable=True),
            sa.Column('status', sa.String(length=50), server_default='draft', nullable=False),
            sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_by', sa.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        )

    if insp.has_table('resources'):
        indexes = [ix['name'] for ix in insp.get_indexes('resources')]
        if 'ix_resources_slug' not in indexes:
            op.create_index('ix_resources_slug', 'resources', ['slug'], unique=True)
        if 'ix_resources_status_published_at' not in indexes:
            op.create_index('ix_resources_status_published_at', 'resources', ['status', 'published_at'])
        if 'ix_resources_resource_type' not in indexes:
            op.create_index('ix_resources_resource_type', 'resources', ['resource_type'])

    # 2. Create newsletter_subscribers table if not exists
    if not insp.has_table('newsletter_subscribers'):
        op.create_table(
            'newsletter_subscribers',
            sa.Column('id', sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
            sa.Column('email', sa.String(length=255), nullable=False),
            sa.Column('status', sa.String(length=50), server_default='subscribed', nullable=False),
            sa.Column('source', sa.String(length=100), server_default='blog', nullable=False),
            sa.Column('subscribed_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('unsubscribed_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        )

    if insp.has_table('newsletter_subscribers'):
        indexes = [ix['name'] for ix in insp.get_indexes('newsletter_subscribers')]
        if 'ix_newsletter_subscribers_email' not in indexes:
            op.create_index('ix_newsletter_subscribers_email', 'newsletter_subscribers', ['email'], unique=True)
        if 'ix_newsletter_subscribers_status' not in indexes:
            op.create_index('ix_newsletter_subscribers_status', 'newsletter_subscribers', ['status'])

    # 3. Create content_analytics_events table if not exists
    if not insp.has_table('content_analytics_events'):
        op.create_table(
            'content_analytics_events',
            sa.Column('id', sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
            sa.Column('event_name', sa.String(length=100), nullable=False),
            sa.Column('content_type', sa.String(length=50), nullable=True),
            sa.Column('content_id', sa.String(length=255), nullable=True),
            sa.Column('path', sa.String(length=500), nullable=True),
            sa.Column('referrer', sa.String(length=500), nullable=True),
            sa.Column('source', sa.String(length=100), nullable=True),
            sa.Column('campaign', sa.String(length=100), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if insp.has_table('content_analytics_events'):
        indexes = [ix['name'] for ix in insp.get_indexes('content_analytics_events')]
        if 'ix_content_analytics_events_event_name' not in indexes:
            op.create_index('ix_content_analytics_events_event_name', 'content_analytics_events', ['event_name'])
        if 'ix_content_analytics_events_created_at' not in indexes:
            op.create_index('ix_content_analytics_events_created_at', 'content_analytics_events', ['created_at'])
        if 'ix_content_analytics_events_name_created' not in indexes:
            op.create_index('ix_content_analytics_events_name_created', 'content_analytics_events', ['event_name', 'created_at'])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if insp.has_table('content_analytics_events'):
        op.drop_table('content_analytics_events')
    if insp.has_table('newsletter_subscribers'):
        op.drop_table('newsletter_subscribers')
    if insp.has_table('resources'):
        op.drop_table('resources')
