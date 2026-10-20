"""Add blog taxonomy: tags, authors, blog_post_tags, and blog_posts author_id/is_featured

Revision ID: 009_add_blog_taxonomy_e5
Revises: 008_add_blog_faqs_and_redirects
Create Date: 2026-09-23 22:30:00.000000

"""
import uuid
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '009_add_blog_taxonomy_e5'
down_revision: Union[str, None] = '008_add_blog_faqs_and_redirects'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # 1. Create blog_authors table if not exists
    if not insp.has_table('blog_authors'):
        op.create_table(
            'blog_authors',
            sa.Column('id', sa.UUID(as_uuid=True), primary_key=True),
            sa.Column('name', sa.String(length=100), nullable=False),
            sa.Column('slug', sa.String(length=100), nullable=False),
            sa.Column('bio', sa.Text(), nullable=True),
            sa.Column('avatar_url', sa.String(length=500), nullable=True),
            sa.Column('user_id', sa.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if insp.has_table('blog_authors'):
        indexes = [ix['name'] for ix in insp.get_indexes('blog_authors')]
        if 'ix_blog_authors_slug' not in indexes:
            op.create_index('ix_blog_authors_slug', 'blog_authors', ['slug'], unique=True)

    # 2. Create blog_tags table if not exists
    if not insp.has_table('blog_tags'):
        op.create_table(
            'blog_tags',
            sa.Column('id', sa.UUID(as_uuid=True), primary_key=True),
            sa.Column('name', sa.String(length=100), nullable=False),
            sa.Column('slug', sa.String(length=100), nullable=False),
            sa.Column('description', sa.String(length=255), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if insp.has_table('blog_tags'):
        indexes = [ix['name'] for ix in insp.get_indexes('blog_tags')]
        if 'ix_blog_tags_slug' not in indexes:
            op.create_index('ix_blog_tags_slug', 'blog_tags', ['slug'], unique=True)
        if 'ix_blog_tags_name' not in indexes and 'blog_tags_name_key' not in indexes:
            op.create_index('ix_blog_tags_name', 'blog_tags', ['name'], unique=True)

    # 3. Create blog_post_tags many-to-many association table if not exists
    if not insp.has_table('blog_post_tags'):
        op.create_table(
            'blog_post_tags',
            sa.Column('blog_post_id', sa.UUID(as_uuid=True), sa.ForeignKey('blog_posts.id', ondelete='CASCADE'), primary_key=True, nullable=False),
            sa.Column('tag_id', sa.UUID(as_uuid=True), sa.ForeignKey('blog_tags.id', ondelete='CASCADE'), primary_key=True, nullable=False),
        )

    if insp.has_table('blog_post_tags'):
        indexes = [ix['name'] for ix in insp.get_indexes('blog_post_tags')]
        if 'ix_blog_post_tags_post_id' not in indexes:
            op.create_index('ix_blog_post_tags_post_id', 'blog_post_tags', ['blog_post_id'])
        if 'ix_blog_post_tags_tag_id' not in indexes:
            op.create_index('ix_blog_post_tags_tag_id', 'blog_post_tags', ['tag_id'])

    # 4. Add author_id and is_featured columns to blog_posts if not exists
    if insp.has_table('blog_posts'):
        cols = [c['name'] for c in insp.get_columns('blog_posts')]
        if 'author_id' not in cols:
            op.add_column('blog_posts', sa.Column('author_id', sa.UUID(as_uuid=True), sa.ForeignKey('blog_authors.id', ondelete='SET NULL'), nullable=True))
        if 'is_featured' not in cols:
            op.add_column('blog_posts', sa.Column('is_featured', sa.Boolean(), server_default='false', nullable=False))

        indexes = [ix['name'] for ix in insp.get_indexes('blog_posts')]
        if 'ix_blog_posts_author_id' not in indexes:
            op.create_index('ix_blog_posts_author_id', 'blog_posts', ['author_id'])
        if 'ix_blog_posts_is_featured' not in indexes:
            op.create_index('ix_blog_posts_is_featured', 'blog_posts', ['is_featured'])

    # 5. Seed default author and backfill existing posts
    author_row = bind.execute(sa.text("SELECT id FROM blog_authors WHERE slug = 'sitesecura-team'")).fetchone()
    if author_row is not None:
        default_author_id = author_row[0]
    else:
        default_author_id = uuid.uuid4()
        blog_authors = sa.table(
            'blog_authors',
            sa.column('id', sa.UUID(as_uuid=True)),
            sa.column('name', sa.String),
            sa.column('slug', sa.String),
            sa.column('bio', sa.Text),
        )
        op.bulk_insert(blog_authors, [
            {
                'id': default_author_id,
                'name': 'SiteSecura Team',
                'slug': 'sitesecura-team',
                'bio': 'Security researchers and engineering team at SiteSecura specializing in defensive web infrastructure.',
            }
        ])

    blog_posts = sa.table(
        'blog_posts',
        sa.column('author_id', sa.UUID(as_uuid=True)),
    )
    op.execute(
        blog_posts.update().where(blog_posts.c.author_id.is_(None)).values(author_id=default_author_id)
    )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if insp.has_table('blog_posts'):
        indexes = [ix['name'] for ix in insp.get_indexes('blog_posts')]
        if 'ix_blog_posts_is_featured' in indexes:
            op.drop_index('ix_blog_posts_is_featured', table_name='blog_posts')
        if 'ix_blog_posts_author_id' in indexes:
            op.drop_index('ix_blog_posts_author_id', table_name='blog_posts')
        cols = [c['name'] for c in insp.get_columns('blog_posts')]
        if 'is_featured' in cols:
            op.drop_column('blog_posts', 'is_featured')
        if 'author_id' in cols:
            op.drop_column('blog_posts', 'author_id')
    if insp.has_table('blog_post_tags'):
        indexes = [ix['name'] for ix in insp.get_indexes('blog_post_tags')]
        if 'ix_blog_post_tags_tag_id' in indexes:
            op.drop_index('ix_blog_post_tags_tag_id', table_name='blog_post_tags')
        if 'ix_blog_post_tags_post_id' in indexes:
            op.drop_index('ix_blog_post_tags_post_id', table_name='blog_post_tags')
        op.drop_table('blog_post_tags')
    if insp.has_table('blog_tags'):
        indexes = [ix['name'] for ix in insp.get_indexes('blog_tags')]
        if 'ix_blog_tags_name' in indexes:
            op.drop_index('ix_blog_tags_name', table_name='blog_tags')
        if 'ix_blog_tags_slug' in indexes:
            op.drop_index('ix_blog_tags_slug', table_name='blog_tags')
        op.drop_table('blog_tags')
    if insp.has_table('blog_authors'):
        indexes = [ix['name'] for ix in insp.get_indexes('blog_authors')]
        if 'ix_blog_authors_slug' in indexes:
            op.drop_index('ix_blog_authors_slug', table_name='blog_authors')
        op.drop_table('blog_authors')
