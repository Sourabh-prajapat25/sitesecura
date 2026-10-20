"""Add media_assets table and blog_posts.featured_media_id

Revision ID: 007_add_media_assets
Revises: 006_blog_posts_publishing_index
Create Date: 2026-09-23 19:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '007_add_media_assets'
down_revision: Union[str, None] = '006_blog_posts_publishing_index'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # 1. Create media_assets table if it does not exist
    if not insp.has_table('media_assets'):
        op.create_table(
            'media_assets',
            sa.Column('id', sa.UUID(as_uuid=True), primary_key=True),
            sa.Column('filename', sa.String(length=255), nullable=False),
            sa.Column('original_filename', sa.String(length=255), nullable=False),
            sa.Column('storage_key', sa.String(length=500), nullable=False),
            sa.Column('public_url', sa.String(length=500), nullable=False),
            sa.Column('mime_type', sa.String(length=100), nullable=False),
            sa.Column('file_size', sa.Integer(), nullable=False),
            sa.Column('width', sa.Integer(), nullable=False),
            sa.Column('height', sa.Integer(), nullable=False),
            sa.Column('alt_text', sa.String(length=500), nullable=True),
            sa.Column('caption', sa.Text(), nullable=True),
            sa.Column('checksum', sa.String(length=64), nullable=True),
            sa.Column('created_by', sa.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    # 2. Create indexes if not exist
    if insp.has_table('media_assets'):
        indexes = [ix['name'] for ix in insp.get_indexes('media_assets')]
        if 'ix_media_assets_storage_key' not in indexes:
            op.create_index('ix_media_assets_storage_key', 'media_assets', ['storage_key'], unique=True)
        if 'ix_media_assets_checksum' not in indexes:
            op.create_index('ix_media_assets_checksum', 'media_assets', ['checksum'], unique=False)

    # 3. Add featured_media_id column to blog_posts if not exists
    if insp.has_table('blog_posts'):
        cols = [c['name'] for c in insp.get_columns('blog_posts')]
        if 'featured_media_id' not in cols:
            op.add_column(
                'blog_posts',
                sa.Column('featured_media_id', sa.UUID(as_uuid=True), sa.ForeignKey('media_assets.id', ondelete='SET NULL'), nullable=True),
            )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if insp.has_table('blog_posts'):
        cols = [c['name'] for c in insp.get_columns('blog_posts')]
        if 'featured_media_id' in cols:
            op.drop_column('blog_posts', 'featured_media_id')
    if insp.has_table('media_assets'):
        indexes = [ix['name'] for ix in insp.get_indexes('media_assets')]
        if 'ix_media_assets_checksum' in indexes:
            op.drop_index('ix_media_assets_checksum', table_name='media_assets')
        if 'ix_media_assets_storage_key' in indexes:
            op.drop_index('ix_media_assets_storage_key', table_name='media_assets')
        op.drop_table('media_assets')
