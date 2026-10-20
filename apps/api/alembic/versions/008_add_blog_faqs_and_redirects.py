"""Add blog_post_faqs and blog_redirects tables

Revision ID: 008_add_blog_faqs_and_redirects
Revises: 007_add_media_assets
Create Date: 2026-09-23 20:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '008_add_blog_faqs_and_redirects'
down_revision: Union[str, None] = '007_add_media_assets'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # 1. Create blog_post_faqs table if not exists
    if not insp.has_table('blog_post_faqs'):
        op.create_table(
            'blog_post_faqs',
            sa.Column('id', sa.UUID(as_uuid=True), primary_key=True),
            sa.Column('blog_post_id', sa.UUID(as_uuid=True), sa.ForeignKey('blog_posts.id', ondelete='CASCADE'), nullable=False),
            sa.Column('question', sa.String(length=500), nullable=False),
            sa.Column('answer', sa.Text(), nullable=False),
            sa.Column('display_order', sa.Integer(), server_default='0', nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if insp.has_table('blog_post_faqs'):
        indexes = [ix['name'] for ix in insp.get_indexes('blog_post_faqs')]
        if 'ix_blog_post_faqs_post_order' not in indexes:
            op.create_index(
                'ix_blog_post_faqs_post_order',
                'blog_post_faqs',
                ['blog_post_id', 'display_order'],
                unique=False,
            )

    # 2. Create blog_redirects table if not exists
    if not insp.has_table('blog_redirects'):
        op.create_table(
            'blog_redirects',
            sa.Column('id', sa.UUID(as_uuid=True), primary_key=True),
            sa.Column('blog_post_id', sa.UUID(as_uuid=True), sa.ForeignKey('blog_posts.id', ondelete='CASCADE'), nullable=False),
            sa.Column('old_slug', sa.String(length=255), nullable=False),
            sa.Column('target_slug', sa.String(length=255), nullable=False),
            sa.Column('status_code', sa.Integer(), server_default='301', nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if insp.has_table('blog_redirects'):
        indexes = [ix['name'] for ix in insp.get_indexes('blog_redirects')]
        if 'ix_blog_redirects_old_slug' not in indexes:
            op.create_index('ix_blog_redirects_old_slug', 'blog_redirects', ['old_slug'], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if insp.has_table('blog_redirects'):
        indexes = [ix['name'] for ix in insp.get_indexes('blog_redirects')]
        if 'ix_blog_redirects_old_slug' in indexes:
            op.drop_index('ix_blog_redirects_old_slug', table_name='blog_redirects')
        op.drop_table('blog_redirects')
    if insp.has_table('blog_post_faqs'):
        indexes = [ix['name'] for ix in insp.get_indexes('blog_post_faqs')]
        if 'ix_blog_post_faqs_post_order' in indexes:
            op.drop_index('ix_blog_post_faqs_post_order', table_name='blog_post_faqs')
        op.drop_table('blog_post_faqs')
