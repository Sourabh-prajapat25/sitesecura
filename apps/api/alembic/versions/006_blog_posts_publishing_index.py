"""Add composite index on blog_posts for status and published_at

Revision ID: 006_blog_posts_publishing_index
Revises: 005_add_ai_generations
Create Date: 2026-09-22 23:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '006_blog_posts_publishing_index'
down_revision: Union[str, None] = '005_add_ai_generations'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if insp.has_table('blog_posts'):
        indexes = [ix['name'] for ix in insp.get_indexes('blog_posts')]
        if 'ix_blog_posts_status_published_at' not in indexes:
            op.create_index(
                'ix_blog_posts_status_published_at',
                'blog_posts',
                ['status', 'published_at'],
                unique=False,
            )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if insp.has_table('blog_posts'):
        indexes = [ix['name'] for ix in insp.get_indexes('blog_posts')]
        if 'ix_blog_posts_status_published_at' in indexes:
            op.drop_index('ix_blog_posts_status_published_at', table_name='blog_posts')
