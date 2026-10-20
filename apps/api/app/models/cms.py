"""
Scanly API - Blog CMS, Support & Contact Models
"""
import uuid
from typing import List, Optional
from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime, Text, Index, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin


class MediaAsset(Base, TimestampMixin):
    __tablename__ = "media_assets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(500), unique=True, index=True, nullable=False)
    public_url: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    alt_text: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    caption: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    checksum: Mapped[Optional[str]] = mapped_column(String(64), index=True, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    @property
    def checksum_sha256(self) -> Optional[str]:
        return self.checksum


class BlogCategory(Base, TimestampMixin):
    __tablename__ = "blog_categories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationships
    posts: Mapped[List["BlogPost"]] = relationship("BlogPost", back_populates="category")


class BlogAuthor(Base, TimestampMixin):
    __tablename__ = "blog_authors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    posts: Mapped[List["BlogPost"]] = relationship("BlogPost", back_populates="author")


class BlogTag(Base, TimestampMixin):
    __tablename__ = "blog_tags"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    posts: Mapped[List["BlogPost"]] = relationship(
        "BlogPost",
        secondary="blog_post_tags",
        back_populates="tags",
    )


class BlogPostTag(Base):
    __tablename__ = "blog_post_tags"

    blog_post_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("blog_posts.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    tag_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("blog_tags.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )

    __table_args__ = (
        Index("ix_blog_post_tags_post_id", "blog_post_id"),
        Index("ix_blog_post_tags_tag_id", "tag_id"),
    )


class BlogPost(Base, TimestampMixin):
    __tablename__ = "blog_posts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    excerpt: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    category_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("blog_categories.id", ondelete="SET NULL"), nullable=True)
    author_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("blog_authors.id", ondelete="SET NULL"), nullable=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    featured_image: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    featured_media_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True)
    seo_title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    meta_description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    canonical_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    og_image: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="draft", nullable=False)  # draft, published
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    category: Mapped[Optional["BlogCategory"]] = relationship("BlogCategory", back_populates="posts")
    author: Mapped[Optional["BlogAuthor"]] = relationship("BlogAuthor", back_populates="posts")
    tags: Mapped[List["BlogTag"]] = relationship(
        "BlogTag",
        secondary="blog_post_tags",
        back_populates="posts",
        order_by="BlogTag.name.asc()",
    )
    featured_media: Mapped[Optional["MediaAsset"]] = relationship("MediaAsset", foreign_keys=[featured_media_id])
    faqs: Mapped[List["BlogPostFAQ"]] = relationship(
        "BlogPostFAQ",
        back_populates="post",
        cascade="all, delete-orphan",
        order_by="BlogPostFAQ.display_order.asc()",
    )

    __table_args__ = (
        Index("ix_blog_posts_status_published_at", "status", "published_at"),
        Index("ix_blog_posts_is_featured", "is_featured"),
        Index("ix_blog_posts_author_id", "author_id"),
    )


class BlogPostFAQ(Base, TimestampMixin):
    __tablename__ = "blog_post_faqs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    blog_post_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("blog_posts.id", ondelete="CASCADE"), nullable=False)
    question: Mapped[str] = mapped_column(String(500), nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    post: Mapped["BlogPost"] = relationship("BlogPost", back_populates="faqs")


class BlogRedirect(Base, TimestampMixin):
    __tablename__ = "blog_redirects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    blog_post_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("blog_posts.id", ondelete="CASCADE"), nullable=False)
    old_slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    target_slug: Mapped[str] = mapped_column(String(255), nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, default=301, nullable=False)

    post: Mapped["BlogPost"] = relationship("BlogPost")


class SupportTicket(Base, TimestampMixin):
    __tablename__ = "support_tickets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    organization_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="open", nullable=False)  # open, pending, closed
    priority: Mapped[str] = mapped_column(String(50), default="normal", nullable=False)  # low, normal, high, urgent


class ContactMessage(Base, TimestampMixin):
    __tablename__ = "contact_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="new", nullable=False)  # new, reviewed, resolved


class Resource(Base, TimestampMixin):
    __tablename__ = "resources"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)  # guide, checklist, template, tool, ebook, pdf
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    featured_image: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    featured_media_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("media_assets.id", ondelete="SET NULL"), nullable=True)
    file_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    external_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="draft", nullable=False)  # draft, published
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    featured_media: Mapped[Optional["MediaAsset"]] = relationship("MediaAsset", foreign_keys=[featured_media_id])

    __table_args__ = (
        Index("ix_resources_status_published_at", "status", "published_at"),
        Index("ix_resources_resource_type", "resource_type"),
    )


class NewsletterSubscriber(Base, TimestampMixin):
    __tablename__ = "newsletter_subscribers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="subscribed", nullable=False)  # subscribed, unsubscribed
    source: Mapped[str] = mapped_column(String(100), default="blog", nullable=False)
    subscribed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    unsubscribed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_newsletter_subscribers_status", "status"),
    )


class ContentAnalyticsEvent(Base):
    __tablename__ = "content_analytics_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_name: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    content_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # blog_post, resource, scanner, newsletter
    content_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    referrer: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    source: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    campaign: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, index=True, nullable=False)

    __table_args__ = (
        Index("ix_content_analytics_events_name_created", "event_name", "created_at"),
    )
