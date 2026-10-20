"""
Scanly API - Blog CMS, Support Tickets & Contact Messages Endpoints
Phase E1: Secure Public Publishing, Draft Protection, Slug Collision Handling, Category Management
"""
import uuid
import os
import math
from typing import Dict, Any, List, Optional, Union
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query, Request
from fastapi.responses import FileResponse
from sqlalchemy import select, desc, or_, func, case
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.db.session import get_db
from app.core.security import get_current_user_token
from app.core.authorization import AuthContext, require_admin
from app.core.rate_limit import check_rate_limit
from app.services.email_service import send_email
from app.models.cms import (
    BlogPost,
    BlogCategory,
    BlogAuthor,
    BlogTag,
    BlogPostTag,
    SupportTicket,
    ContactMessage,
    MediaAsset,
    BlogPostFAQ,
    BlogRedirect,
    Resource,
    NewsletterSubscriber,
    ContentAnalyticsEvent,
)
from app.utils.slug import normalize_slug, is_valid_slug
from app.schemas.shared import (
    BlogCategoryCreateRequest,
    BlogCategoryUpdateRequest,
    BlogCategoryResponse,
    BlogAuthorCreateRequest,
    BlogAuthorUpdateRequest,
    BlogAuthorResponse,
    BlogTagCreateRequest,
    BlogTagUpdateRequest,
    BlogTagResponse,
    BlogPostSummaryResponse,
    BlogPostCreateRequest,
    BlogPostUpdateRequest,
    BlogPostResponse,
    BlogPostListResponse,
    BlogPostFAQCreateRequest,
    BlogPostFAQResponse,
    BlogRedirectResponse,
    BlogPostSitemapItem,
    MediaAssetResponse,
    MediaAssetUpdateRequest,
    MediaAssetListResponse,
    SupportTicketCreate,
    SupportTicketResponse,
    ContactMessageCreate,
    ResourceResponse,
    ResourceCreateRequest,
    ResourceUpdateRequest,
    ResourceListResponse,
    ResourceSitemapItem,
    NewsletterSubscribeRequest,
    NewsletterUnsubscribeRequest,
    NewsletterSubscriberResponse,
    NewsletterSubscriberListResponse,
    ContentAnalyticsEventCreate,
    ContentAnalyticsSummaryResponse,
    TopContentMetric,
    DocFeedbackCreateRequest,
    DocFeedbackResponse,
)
from app.services.auth_service import get_or_create_user
from app.services.audit_service import record_audit_event
from app.services.media_storage import media_storage
from app.services.image_processing import process_and_validate_image

router = APIRouter(tags=["CMS & Support"])


# ==========================================
# Blog Endpoints (Public)
# ==========================================
async def _get_related_posts(
    db: AsyncSession,
    current_post: BlogPost,
    limit: int = 3,
) -> List[BlogPostSummaryResponse]:
    """
    Deterministic related article selection:
    1. Only published articles with published_at <= now
    2. Exclude current_post.id
    3. Score: +3 for same category, +2 for each shared tag, +1 for same author
    4. Order by relevance DESC, published_at DESC, id DESC
    5. Return up to limit summaries
    """
    now_utc = datetime.now(timezone.utc)
    current_tag_ids = [t.id for t in current_post.tags] if current_post.tags else []

    stmt = (
        select(BlogPost)
        .options(
            selectinload(BlogPost.category),
            selectinload(BlogPost.featured_media),
            selectinload(BlogPost.author),
            selectinload(BlogPost.tags),
        )
        .where(
            BlogPost.id != current_post.id,
            BlogPost.status == "published",
            BlogPost.published_at.is_not(None),
            BlogPost.published_at <= now_utc,
        )
    )
    result = await db.execute(stmt)
    candidates = result.scalars().all()

    scored = []
    for c in candidates:
        score = 0
        if current_post.category_id and c.category_id == current_post.category_id:
            score += 3
        if current_tag_ids and c.tags:
            shared_tags_count = sum(1 for t in c.tags if t.id in current_tag_ids)
            score += shared_tags_count * 2
        if current_post.author_id and c.author_id == current_post.author_id:
            score += 1
        pub_dt = c.published_at
        if pub_dt and pub_dt.tzinfo is None:
            pub_dt = pub_dt.replace(tzinfo=timezone.utc)
        scored.append((score, pub_dt or datetime.min.replace(tzinfo=timezone.utc), c.id, c))

    scored.sort(key=lambda x: (x[0], x[1], str(x[2])), reverse=True)
    top_posts = [item[3] for item in scored[:limit]]
    return [BlogPostSummaryResponse.model_validate(p) for p in top_posts]


@router.get("/blog/posts", response_model=Union[BlogPostListResponse, List[BlogPostResponse]])
async def list_blog_posts(
    q: Optional[str] = Query(None, description="Search term for title, excerpt, and content"),
    category: Optional[str] = Query(None, description="Filter by category slug"),
    tag: Optional[str] = Query(None, description="Filter by tag slug"),
    author: Optional[str] = Query(None, description="Filter by author slug"),
    featured: Optional[bool] = Query(None, description="Filter by featured status"),
    page: Optional[int] = Query(None, description="Page number (1-indexed)"),
    page_size: Optional[int] = Query(None, description="Items per page (max 50)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Lists publicly available blog posts with support for search, taxonomy filters, and pagination.
    Strictly excludes drafts, scheduled future posts, and archived posts.
    Returns BlogPostListResponse when page or page_size is specified,
    or List[BlogPostResponse] for unpaginated queries to preserve full backward compatibility.
    """
    now_utc = datetime.now(timezone.utc)
    base_conditions = [
        BlogPost.status == "published",
        BlogPost.published_at.is_not(None),
        BlogPost.published_at <= now_utc,
    ]

    # Clean and sanitize search query
    clean_q = q.strip()[:200] if q else None
    if clean_q:
        search_pattern = f"%{clean_q}%"
        base_conditions.append(
            or_(
                BlogPost.title.ilike(search_pattern),
                BlogPost.excerpt.ilike(search_pattern),
                BlogPost.content.ilike(search_pattern),
            )
        )

    # Filter by category slug
    if category:
        clean_cat = normalize_slug(category)
        base_conditions.append(BlogPost.category.has(BlogCategory.slug == clean_cat))

    # Filter by tag slug
    if tag:
        clean_tag = normalize_slug(tag)
        base_conditions.append(BlogPost.tags.any(BlogTag.slug == clean_tag))

    # Filter by author slug
    if author:
        clean_author = normalize_slug(author)
        base_conditions.append(BlogPost.author.has(BlogAuthor.slug == clean_author))

    # Filter by featured
    if featured is True:
        base_conditions.append(BlogPost.is_featured == True)
    elif featured is False:
        base_conditions.append(BlogPost.is_featured == False)

    # Base query
    stmt = (
        select(BlogPost)
        .options(
            selectinload(BlogPost.category),
            selectinload(BlogPost.featured_media),
            selectinload(BlogPost.faqs),
            selectinload(BlogPost.author),
            selectinload(BlogPost.tags),
        )
        .where(*base_conditions)
    )

    # Deterministic ordering
    if clean_q:
        relevance = case(
            (BlogPost.title.ilike(f"%{clean_q}%"), 3),
            (BlogPost.excerpt.ilike(f"%{clean_q}%"), 2),
            else_=1,
        )
        stmt = stmt.order_by(desc(relevance), desc(BlogPost.published_at), desc(BlogPost.created_at), desc(BlogPost.id))
    else:
        stmt = stmt.order_by(desc(BlogPost.published_at), desc(BlogPost.created_at), desc(BlogPost.id))

    # If paginated
    if page is not None or page_size is not None:
        effective_page = max(1, page) if page is not None else 1
        effective_page_size = min(50, max(1, page_size)) if page_size is not None else 10

        count_stmt = select(func.count(BlogPost.id)).where(*base_conditions)
        total = (await db.execute(count_stmt)).scalar_one()
        total_pages = math.ceil(total / effective_page_size) if total > 0 else 1

        paginated_stmt = stmt.offset((effective_page - 1) * effective_page_size).limit(effective_page_size)
        result = await db.execute(paginated_stmt)
        posts = result.scalars().all()

        return BlogPostListResponse(
            items=[BlogPostResponse.model_validate(p) for p in posts],
            total=total,
            page=effective_page,
            page_size=effective_page_size,
            total_pages=total_pages,
            has_next=effective_page < total_pages,
            has_previous=effective_page > 1,
        )

    # Unpaginated list (full backward compatibility)
    result = await db.execute(stmt)
    posts = result.scalars().all()
    return [BlogPostResponse.model_validate(p) for p in posts]


@router.get("/blog/posts/{slug}", response_model=BlogPostResponse)
async def get_blog_post(slug: str, db: AsyncSession = Depends(get_db)):
    """
    Retrieves a single published blog post by slug.
    Strictly enforces published status and published_at <= now.
    Includes category, author, tags, and deterministic related articles.
    Drafts, future-dated posts, and non-existent posts all return a uniform 404.
    """
    clean_slug = normalize_slug(slug)
    now_utc = datetime.now(timezone.utc)
    stmt = (
        select(BlogPost)
        .options(
            selectinload(BlogPost.category),
            selectinload(BlogPost.featured_media),
            selectinload(BlogPost.faqs),
            selectinload(BlogPost.author),
            selectinload(BlogPost.tags),
        )
        .where(
            BlogPost.slug == clean_slug,
            BlogPost.status == "published",
            BlogPost.published_at.is_not(None),
            BlogPost.published_at <= now_utc,
        )
    )
    result = await db.execute(stmt)
    post = result.scalar_one_or_none()

    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blog post not found.")

    response_data = BlogPostResponse.model_validate(post)
    related = await _get_related_posts(db, post, limit=3)
    response_data.related_posts = related
    return response_data


@router.get("/blog/posts/{slug}/related", response_model=List[BlogPostSummaryResponse])
async def get_related_blog_posts(slug: str, db: AsyncSession = Depends(get_db)):
    """
    Dedicated endpoint to fetch related published articles for a given article slug.
    Excludes the current article, drafts, and scheduled articles.
    """
    clean_slug = normalize_slug(slug)
    now_utc = datetime.now(timezone.utc)
    stmt = (
        select(BlogPost)
        .options(
            selectinload(BlogPost.category),
            selectinload(BlogPost.author),
            selectinload(BlogPost.tags),
        )
        .where(
            BlogPost.slug == clean_slug,
            BlogPost.status == "published",
            BlogPost.published_at.is_not(None),
            BlogPost.published_at <= now_utc,
        )
    )
    result = await db.execute(stmt)
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blog post not found.")

    return await _get_related_posts(db, post, limit=4)


@router.get("/blog/tags", response_model=List[BlogTagResponse])
async def list_public_tags(db: AsyncSession = Depends(get_db)):
    """Public endpoint to list all blog tags with accurate published post counts."""
    now_utc = datetime.now(timezone.utc)
    count_stmt = (
        select(BlogPostTag.tag_id, func.count(BlogPost.id).label("count"))
        .join(BlogPost, BlogPost.id == BlogPostTag.blog_post_id)
        .where(
            BlogPost.status == "published",
            BlogPost.published_at.is_not(None),
            BlogPost.published_at <= now_utc,
        )
        .group_by(BlogPostTag.tag_id)
    )
    count_res = await db.execute(count_stmt)
    count_map = {row[0]: row[1] for row in count_res.all()}

    stmt = select(BlogTag).order_by(BlogTag.name.asc())
    result = await db.execute(stmt)
    tags = result.scalars().all()
    out = []
    for t in tags:
        dto = BlogTagResponse.model_validate(t)
        dto.post_count = count_map.get(t.id, 0)
        out.append(dto)
    return out


@router.get("/blog/authors", response_model=List[BlogAuthorResponse])
async def list_public_authors(db: AsyncSession = Depends(get_db)):
    """Public endpoint to list all blog authors (strictly public profile fields only)."""
    stmt = select(BlogAuthor).order_by(BlogAuthor.name.asc())
    result = await db.execute(stmt)
    authors = result.scalars().all()
    return [BlogAuthorResponse.model_validate(a) for a in authors]


@router.get("/blog/authors/{slug}", response_model=BlogAuthorResponse)
async def get_public_author(slug: str, db: AsyncSession = Depends(get_db)):
    """Public endpoint to get a single author profile by slug."""
    clean_slug = normalize_slug(slug)
    stmt = select(BlogAuthor).where(BlogAuthor.slug == clean_slug)
    result = await db.execute(stmt)
    author = result.scalar_one_or_none()
    if not author:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Author not found.")
    return BlogAuthorResponse.model_validate(author)


def _is_published_utc(dt: Optional[datetime]) -> bool:
    """Helper to check if datetime is set and <= now, handling naive vs aware datetimes."""
    if not dt:
        return False
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt <= now


@router.get("/blog/redirects/{slug}", response_model=BlogRedirectResponse)
async def get_blog_redirect(slug: str, db: AsyncSession = Depends(get_db)):
    """
    Public endpoint to resolve historical slug redirects.
    Only returns a redirect if the target blog post is currently published.
    If the target post is a draft, future-dated, archived, or deleted,
    returns 404 to avoid leaking private/draft existence.
    """
    clean_slug = normalize_slug(slug)
    stmt = (
        select(BlogRedirect)
        .options(selectinload(BlogRedirect.post))
        .where(BlogRedirect.old_slug == clean_slug)
    )
    result = await db.execute(stmt)
    redirect_record = result.scalar_one_or_none()
    if not redirect_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Redirect not found.")

    target_post = redirect_record.post
    if (
        not target_post
        or target_post.status != "published"
        or not _is_published_utc(target_post.published_at)
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Redirect target is not published.",
        )

    return BlogRedirectResponse.model_validate(redirect_record)


@router.get("/blog/sitemap-posts", response_model=List[BlogPostSitemapItem])
async def list_sitemap_posts(db: AsyncSession = Depends(get_db)):
    """
    Lightweight public endpoint for dynamic sitemap generation.
    Returns minimal metadata (slug, timestamps, representative image)
    only for currently published articles. Drafts and future posts are strictly omitted.
    """
    now_utc = datetime.now(timezone.utc)
    stmt = (
        select(BlogPost)
        .options(selectinload(BlogPost.featured_media))
        .where(
            BlogPost.status == "published",
            BlogPost.published_at.is_not(None),
            BlogPost.published_at <= now_utc,
        )
        .order_by(desc(BlogPost.published_at), desc(BlogPost.created_at))
    )
    result = await db.execute(stmt)
    posts = result.scalars().all()
    items = []
    for p in posts:
        media_url = p.featured_media.public_url if p.featured_media else None
        items.append(
            BlogPostSitemapItem(
                id=p.id,
                slug=p.slug,
                published_at=p.published_at,
                updated_at=p.updated_at,
                featured_image=p.featured_image,
                featured_media_url=media_url,
            )
        )
    return items


@router.get("/blog/categories", response_model=List[BlogCategoryResponse])
async def list_public_categories(db: AsyncSession = Depends(get_db)):
    """Public endpoint to list all blog categories."""
    stmt = select(BlogCategory).order_by(BlogCategory.name.asc())
    result = await db.execute(stmt)
    categories = result.scalars().all()
    return [BlogCategoryResponse.model_validate(c) for c in categories]


# ==========================================
# Blog Endpoints (Admin)
# ==========================================
@router.get("/admin/blog/posts", response_model=List[BlogPostResponse])
async def list_admin_blog_posts(
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin endpoint to list all blog posts (published, drafts, scheduled, archived)."""
    stmt = (
        select(BlogPost)
        .options(
            selectinload(BlogPost.category),
            selectinload(BlogPost.featured_media),
            selectinload(BlogPost.faqs),
            selectinload(BlogPost.author),
            selectinload(BlogPost.tags),
        )
        .order_by(desc(BlogPost.created_at))
    )
    result = await db.execute(stmt)
    posts = result.scalars().all()
    return [BlogPostResponse.model_validate(p) for p in posts]


@router.get("/admin/blog/posts/{post_id}", response_model=BlogPostResponse)
async def get_admin_blog_post(
    post_id: uuid.UUID,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin endpoint to retrieve a single blog post by ID with all relationships."""
    stmt = (
        select(BlogPost)
        .options(
            selectinload(BlogPost.category),
            selectinload(BlogPost.featured_media),
            selectinload(BlogPost.faqs),
            selectinload(BlogPost.author),
            selectinload(BlogPost.tags),
        )
        .where(BlogPost.id == post_id)
    )
    result = await db.execute(stmt)
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blog post not found.")
    return BlogPostResponse.model_validate(post)


@router.get("/admin/blog/redirects", response_model=List[BlogRedirectResponse])
async def list_admin_blog_redirects(
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin endpoint to list all blog slug redirect records."""
    stmt = select(BlogRedirect).order_by(desc(BlogRedirect.created_at))
    result = await db.execute(stmt)
    redirects = result.scalars().all()
    return [BlogRedirectResponse.model_validate(r) for r in redirects]


# ==========================================
# Admin Tag Endpoints (Phase E5)
# ==========================================
@router.get("/admin/blog/tags", response_model=List[BlogTagResponse])
async def list_admin_blog_tags(
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin endpoint to list all blog tags."""
    count_stmt = (
        select(BlogPostTag.tag_id, func.count(BlogPostTag.blog_post_id).label("count"))
        .group_by(BlogPostTag.tag_id)
    )
    count_res = await db.execute(count_stmt)
    count_map = {row[0]: row[1] for row in count_res.all()}

    stmt = select(BlogTag).order_by(BlogTag.name.asc())
    result = await db.execute(stmt)
    tags = result.scalars().all()
    out = []
    for t in tags:
        dto = BlogTagResponse.model_validate(t)
        dto.post_count = count_map.get(t.id, 0)
        out.append(dto)
    return out


@router.post("/admin/blog/tags", response_model=BlogTagResponse, status_code=status.HTTP_201_CREATED)
async def create_blog_tag(
    tag_in: BlogTagCreateRequest,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin endpoint to create a blog tag."""
    clean_name = tag_in.name.strip()
    slug_str = tag_in.slug if tag_in.slug else clean_name
    clean_slug = normalize_slug(slug_str)
    if not clean_slug or not is_valid_slug(clean_slug):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The slug must be lowercase, alphanumeric, and URL-safe with hyphens.",
        )

    existing = await db.execute(
        select(BlogTag).where(or_(BlogTag.slug == clean_slug, BlogTag.name.ilike(clean_name)))
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A tag with this name or slug already exists.",
        )

    tag = BlogTag(
        id=uuid.uuid4(),
        name=clean_name,
        slug=clean_slug,
        description=tag_in.description.strip() if tag_in.description else None,
    )
    db.add(tag)
    await db.commit()
    await db.refresh(tag)

    await record_audit_event(
        db=db,
        action="BLOG_TAG_CREATED",
        entity_type="BLOG_TAG",
        user_id=auth.user.id,
        entity_id=str(tag.id),
        metadata={"name": tag.name, "slug": tag.slug},
    )
    dto = BlogTagResponse.model_validate(tag)
    dto.post_count = 0
    return dto


@router.patch("/admin/blog/tags/{tag_id}", response_model=BlogTagResponse)
async def update_blog_tag(
    tag_id: uuid.UUID,
    tag_in: BlogTagUpdateRequest,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin endpoint to update a blog tag."""
    tag = await db.get(BlogTag, tag_id)
    if not tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found.")

    if tag_in.name is not None:
        clean_name = tag_in.name.strip()
        existing_name = (
            await db.execute(
                select(BlogTag).where(BlogTag.name.ilike(clean_name), BlogTag.id != tag_id)
            )
        ).scalar_one_or_none()
        if existing_name:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A tag with this name already exists.")
        tag.name = clean_name

    if tag_in.slug is not None:
        clean_slug = normalize_slug(tag_in.slug)
        if not clean_slug or not is_valid_slug(clean_slug):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="The slug must be lowercase, alphanumeric, and URL-safe with hyphens.",
            )
        existing_slug = (
            await db.execute(
                select(BlogTag).where(BlogTag.slug == clean_slug, BlogTag.id != tag_id)
            )
        ).scalar_one_or_none()
        if existing_slug:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A tag with this slug already exists.")
        tag.slug = clean_slug

    if tag_in.description is not None:
        tag.description = tag_in.description.strip() if tag_in.description else None

    await db.commit()
    await db.refresh(tag)

    await record_audit_event(
        db=db,
        action="BLOG_TAG_UPDATED",
        entity_type="BLOG_TAG",
        user_id=auth.user.id,
        entity_id=str(tag.id),
        metadata={"name": tag.name, "slug": tag.slug},
    )
    count_stmt = select(func.count(BlogPostTag.blog_post_id)).where(BlogPostTag.tag_id == tag_id)
    post_count = (await db.execute(count_stmt)).scalar_one()
    dto = BlogTagResponse.model_validate(tag)
    dto.post_count = post_count
    return dto


@router.delete("/admin/blog/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_blog_tag(
    tag_id: uuid.UUID,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin endpoint to delete a blog tag safely.
    Removes associations from blog_post_tags without deleting any blog posts.
    """
    tag = await db.get(BlogTag, tag_id)
    if not tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found.")

    tag_name = tag.name
    await db.delete(tag)
    await db.commit()

    await record_audit_event(
        db=db,
        action="BLOG_TAG_DELETED",
        entity_type="BLOG_TAG",
        user_id=auth.user.id,
        entity_id=str(tag_id),
        metadata={"name": tag_name},
    )
    return None


# ==========================================
# Admin Author Endpoints (Phase E5)
# ==========================================
@router.get("/admin/blog/authors", response_model=List[BlogAuthorResponse])
async def list_admin_blog_authors(
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin endpoint to list all blog authors."""
    stmt = select(BlogAuthor).order_by(BlogAuthor.name.asc())
    result = await db.execute(stmt)
    authors = result.scalars().all()
    return [BlogAuthorResponse.model_validate(a) for a in authors]


@router.post("/admin/blog/authors", response_model=BlogAuthorResponse, status_code=status.HTTP_201_CREATED)
async def create_blog_author(
    author_in: BlogAuthorCreateRequest,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin endpoint to create a blog author."""
    clean_name = author_in.name.strip()
    slug_str = author_in.slug if author_in.slug else clean_name
    clean_slug = normalize_slug(slug_str)
    if not clean_slug or not is_valid_slug(clean_slug):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The slug must be lowercase, alphanumeric, and URL-safe with hyphens.",
        )

    existing = await db.execute(select(BlogAuthor).where(BlogAuthor.slug == clean_slug))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An author with this slug already exists.",
        )

    author = BlogAuthor(
        id=uuid.uuid4(),
        name=clean_name,
        slug=clean_slug,
        bio=author_in.bio.strip() if author_in.bio else None,
        avatar_url=author_in.avatar_url.strip() if author_in.avatar_url else None,
        user_id=author_in.user_id,
    )
    db.add(author)
    await db.commit()
    await db.refresh(author)

    await record_audit_event(
        db=db,
        action="BLOG_AUTHOR_CREATED",
        entity_type="BLOG_AUTHOR",
        user_id=auth.user.id,
        entity_id=str(author.id),
        metadata={"name": author.name, "slug": author.slug},
    )
    return BlogAuthorResponse.model_validate(author)


@router.patch("/admin/blog/authors/{author_id}", response_model=BlogAuthorResponse)
async def update_blog_author(
    author_id: uuid.UUID,
    author_in: BlogAuthorUpdateRequest,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin endpoint to update a blog author."""
    author = await db.get(BlogAuthor, author_id)
    if not author:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Author not found.")

    if author_in.name is not None:
        author.name = author_in.name.strip()

    if author_in.slug is not None:
        clean_slug = normalize_slug(author_in.slug)
        if not clean_slug or not is_valid_slug(clean_slug):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="The slug must be lowercase, alphanumeric, and URL-safe with hyphens.",
            )
        existing = (
            await db.execute(
                select(BlogAuthor).where(BlogAuthor.slug == clean_slug, BlogAuthor.id != author_id)
            )
        ).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An author with this slug already exists.")
        author.slug = clean_slug

    if author_in.bio is not None:
        author.bio = author_in.bio.strip() if author_in.bio else None

    if author_in.avatar_url is not None:
        author.avatar_url = author_in.avatar_url.strip() if author_in.avatar_url else None

    if author_in.user_id is not None:
        author.user_id = author_in.user_id

    await db.commit()
    await db.refresh(author)

    await record_audit_event(
        db=db,
        action="BLOG_AUTHOR_UPDATED",
        entity_type="BLOG_AUTHOR",
        user_id=auth.user.id,
        entity_id=str(author.id),
        metadata={"name": author.name, "slug": author.slug},
    )
    return BlogAuthorResponse.model_validate(author)


@router.delete("/admin/blog/authors/{author_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_blog_author(
    author_id: uuid.UUID,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin endpoint to delete a blog author safely.
    Sets author_id to NULL on any associated blog posts.
    """
    author = await db.get(BlogAuthor, author_id)
    if not author:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Author not found.")

    author_name = author.name
    await db.delete(author)
    await db.commit()

    await record_audit_event(
        db=db,
        action="BLOG_AUTHOR_DELETED",
        entity_type="BLOG_AUTHOR",
        user_id=auth.user.id,
        entity_id=str(author_id),
        metadata={"name": author_name},
    )
    return None


@router.post("/admin/blog/posts", response_model=BlogPostResponse, status_code=status.HTTP_201_CREATED)
async def create_blog_post(
    post_in: BlogPostCreateRequest,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin endpoint to create a new blog post.
    Defaults to draft status unless explicitly set to published.
    Enforces normalized slug uniqueness with clean 409 validation.
    """
    clean_slug = normalize_slug(post_in.slug)
    if not clean_slug or not is_valid_slug(clean_slug):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The slug must be lowercase, alphanumeric, and URL-safe with hyphens.",
        )

    # Collision pre-check
    existing_slug = await db.execute(select(BlogPost.id).where(BlogPost.slug == clean_slug))
    if existing_slug.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The slug is already in use.",
        )

    # Remove any obsolete redirect where old_slug equals this new article slug
    obsolete_redirect = (
        await db.execute(select(BlogRedirect).where(BlogRedirect.old_slug == clean_slug))
    ).scalar_one_or_none()
    if obsolete_redirect:
        await db.delete(obsolete_redirect)

    # Validate category existence if assigned
    if post_in.category_id is not None:
        category = await db.get(BlogCategory, post_in.category_id)
        if not category:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")

    # Validate author existence if assigned
    if post_in.author_id is not None:
        author = await db.get(BlogAuthor, post_in.author_id)
        if not author:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Author not found.")

    # Fetch tags if assigned
    tags_to_assign = []
    if post_in.tag_ids:
        tag_stmt = select(BlogTag).where(BlogTag.id.in_(post_in.tag_ids))
        tags_to_assign = (await db.execute(tag_stmt)).scalars().all()

    # Validate featured media existence if assigned
    featured_image: Optional[str] = post_in.featured_image
    if post_in.featured_media_id is not None:
        media = await db.get(MediaAsset, post_in.featured_media_id)
        if not media:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Featured media asset not found.")
        if not featured_image:
            featured_image = media.public_url

    # Determine publication date
    published_at: Optional[datetime] = post_in.published_at
    if post_in.status == "published" and not published_at:
        published_at = datetime.now(timezone.utc)
    elif post_in.status == "draft" and not post_in.published_at:
        published_at = None

    post_id = uuid.uuid4()
    post = BlogPost(
        id=post_id,
        title=post_in.title.strip(),
        slug=clean_slug,
        excerpt=post_in.excerpt.strip(),
        content=post_in.content,
        category_id=post_in.category_id,
        author_id=post_in.author_id,
        is_featured=post_in.is_featured if post_in.is_featured is not None else False,
        featured_image=featured_image,
        featured_media_id=post_in.featured_media_id,
        seo_title=post_in.seo_title.strip() if post_in.seo_title else post_in.title.strip(),
        meta_description=post_in.meta_description.strip() if post_in.meta_description else post_in.excerpt.strip(),
        canonical_url=post_in.canonical_url,
        og_image=post_in.og_image,
        status=post_in.status,
        published_at=published_at,
        created_by=auth.user.id,
    )
    if tags_to_assign:
        post.tags = list(tags_to_assign)
    db.add(post)

    # Add FAQs if provided
    if post_in.faqs:
        for idx, f in enumerate(post_in.faqs):
            if f.question.strip() and f.answer.strip():
                faq = BlogPostFAQ(
                    id=uuid.uuid4(),
                    blog_post_id=post_id,
                    question=f.question.strip(),
                    answer=f.answer.strip(),
                    display_order=f.display_order if f.display_order is not None else idx,
                )
                db.add(faq)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The slug is already in use.",
        )

    # Refresh with category, media, faqs, author, and tags relations loaded
    stmt = (
        select(BlogPost)
        .options(
            selectinload(BlogPost.category),
            selectinload(BlogPost.featured_media),
            selectinload(BlogPost.faqs),
            selectinload(BlogPost.author),
            selectinload(BlogPost.tags),
        )
        .where(BlogPost.id == post.id)
    )
    refreshed = (await db.execute(stmt)).scalar_one()

    await record_audit_event(
        db=db,
        action="BLOG_POST_CREATED",
        entity_type="BLOG_POST",
        user_id=auth.user.id,
        entity_id=str(refreshed.id),
        metadata={
            "title": refreshed.title,
            "slug": refreshed.slug,
            "status": refreshed.status,
            "category_id": str(refreshed.category_id) if refreshed.category_id else None,
            "author_id": str(refreshed.author_id) if refreshed.author_id else None,
            "is_featured": refreshed.is_featured,
            "featured_media_id": str(refreshed.featured_media_id) if refreshed.featured_media_id else None,
        },
    )
    if refreshed.is_featured:
        await record_audit_event(
            db=db,
            action="BLOG_POST_FEATURED",
            entity_type="BLOG_POST",
            user_id=auth.user.id,
            entity_id=str(refreshed.id),
            metadata={"title": refreshed.title, "slug": refreshed.slug},
        )
    return BlogPostResponse.model_validate(refreshed)


@router.patch("/admin/blog/posts/{post_id}", response_model=BlogPostResponse)
async def update_blog_post(
    post_id: uuid.UUID,
    post_in: BlogPostUpdateRequest,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin endpoint to edit a blog post or change publish status.
    Provides safe slug collision checking, slug change redirect tracking,
    redirect chain collapsing, status transition tracking, and audit logging.
    """
    stmt = (
        select(BlogPost)
        .options(
            selectinload(BlogPost.category),
            selectinload(BlogPost.featured_media),
            selectinload(BlogPost.faqs),
            selectinload(BlogPost.author),
            selectinload(BlogPost.tags),
        )
        .where(BlogPost.id == post_id)
    )
    result = await db.execute(stmt)
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blog post not found.")

    old_status = post.status
    old_slug = post.slug
    was_published = (old_status == "published" and _is_published_utc(post.published_at))
    fields_set = post_in.model_fields_set
    slug_changed = False

    if "title" in fields_set and post_in.title is not None:
        post.title = post_in.title.strip()

    if "slug" in fields_set and post_in.slug is not None:
        clean_slug = normalize_slug(post_in.slug)
        if not clean_slug or not is_valid_slug(clean_slug):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="The slug must be lowercase, alphanumeric, and URL-safe with hyphens.",
            )
        if clean_slug != post.slug:
            # Collision pre-check excluding current post
            existing = await db.execute(
                select(BlogPost.id).where(BlogPost.slug == clean_slug, BlogPost.id != post_id)
            )
            if existing.scalar_one_or_none() is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="The slug is already in use.",
                )
            post.slug = clean_slug
            slug_changed = True

    if "excerpt" in fields_set and post_in.excerpt is not None:
        post.excerpt = post_in.excerpt.strip()
    if "content" in fields_set and post_in.content is not None:
        post.content = post_in.content
    if "category_id" in fields_set:
        if post_in.category_id is not None:
            category = await db.get(BlogCategory, post_in.category_id)
            if not category:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")
            post.category_id = post_in.category_id
        else:
            post.category_id = None
    if "author_id" in fields_set:
        if post_in.author_id is not None:
            author = await db.get(BlogAuthor, post_in.author_id)
            if not author:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Author not found.")
            post.author_id = post_in.author_id
        else:
            post.author_id = None
    if "tag_ids" in fields_set:
        if post_in.tag_ids:
            tag_stmt = select(BlogTag).where(BlogTag.id.in_(post_in.tag_ids))
            new_tags = (await db.execute(tag_stmt)).scalars().all()
            post.tags = list(new_tags)
        else:
            post.tags.clear()
    if "is_featured" in fields_set and post_in.is_featured is not None:
        old_featured = post.is_featured
        post.is_featured = post_in.is_featured
        if not old_featured and post_in.is_featured:
            await record_audit_event(
                db=db,
                action="BLOG_POST_FEATURED",
                entity_type="BLOG_POST",
                user_id=auth.user.id,
                entity_id=str(post.id),
                metadata={"title": post.title, "slug": post.slug},
            )
        elif old_featured and not post_in.is_featured:
            await record_audit_event(
                db=db,
                action="BLOG_POST_UNFEATURED",
                entity_type="BLOG_POST",
                user_id=auth.user.id,
                entity_id=str(post.id),
                metadata={"title": post.title, "slug": post.slug},
            )
    if "featured_media_id" in fields_set:
        if post_in.featured_media_id is not None:
            media = await db.get(MediaAsset, post_in.featured_media_id)
            if not media:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Featured media asset not found.")
            post.featured_media_id = post_in.featured_media_id
            if "featured_image" not in fields_set or not post_in.featured_image:
                post.featured_image = media.public_url
        else:
            post.featured_media_id = None
    if "featured_image" in fields_set:
        post.featured_image = post_in.featured_image
    if "seo_title" in fields_set:
        post.seo_title = post_in.seo_title.strip() if post_in.seo_title else None
    if "meta_description" in fields_set:
        post.meta_description = post_in.meta_description.strip() if post_in.meta_description else None
    if "canonical_url" in fields_set:
        post.canonical_url = post_in.canonical_url
    if "og_image" in fields_set:
        post.og_image = post_in.og_image
    if "published_at" in fields_set:
        post.published_at = post_in.published_at

    if "status" in fields_set and post_in.status is not None:
        post.status = post_in.status
        if post.status == "published" and not post.published_at:
            post.published_at = datetime.now(timezone.utc)

    # Handle FAQs update if specified
    if "faqs" in fields_set:
        post.faqs.clear()
        if post_in.faqs:
            for idx, f in enumerate(post_in.faqs):
                if f.question.strip() and f.answer.strip():
                    new_faq = BlogPostFAQ(
                        id=uuid.uuid4(),
                        blog_post_id=post.id,
                        question=f.question.strip(),
                        answer=f.answer.strip(),
                        display_order=f.display_order if f.display_order is not None else idx,
                    )
                    post.faqs.append(new_faq)

    # Handle Slug Change Redirection and Chain Collapsing
    if slug_changed and was_published:
        # Prevent loops: If clean_slug was an old_slug in blog_redirects, remove it
        loop_redirect = (
            await db.execute(select(BlogRedirect).where(BlogRedirect.old_slug == post.slug))
        ).scalar_one_or_none()
        if loop_redirect:
            await db.delete(loop_redirect)

        # Check if redirect from old_slug already exists
        existing_redirect = (
            await db.execute(select(BlogRedirect).where(BlogRedirect.old_slug == old_slug))
        ).scalar_one_or_none()
        if existing_redirect:
            existing_redirect.target_slug = post.slug
            existing_redirect.blog_post_id = post.id
            existing_redirect.status_code = 301
        else:
            redirect_entry = BlogRedirect(
                id=uuid.uuid4(),
                blog_post_id=post.id,
                old_slug=old_slug,
                target_slug=post.slug,
                status_code=301,
            )
            db.add(redirect_entry)

        # Collapse redirect chains: Update any historical redirects pointing to old_slug
        chain_redirects = (
            await db.execute(select(BlogRedirect).where(BlogRedirect.target_slug == old_slug))
        ).scalars().all()
        for cr in chain_redirects:
            cr.target_slug = post.slug
            cr.blog_post_id = post.id

        # Log specific slug change audit event
        await record_audit_event(
            db=db,
            action="BLOG_POST_SLUG_CHANGED",
            entity_type="BLOG_POST",
            user_id=auth.user.id,
            entity_id=str(post.id),
            metadata={
                "post_id": str(post.id),
                "old_slug": old_slug,
                "new_slug": post.slug,
                "title": post.title,
            },
        )

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The slug is already in use.",
        )

    # Refresh with loaded relationships
    stmt = (
        select(BlogPost)
        .options(
            selectinload(BlogPost.category),
            selectinload(BlogPost.featured_media),
            selectinload(BlogPost.faqs),
            selectinload(BlogPost.author),
            selectinload(BlogPost.tags),
        )
        .where(BlogPost.id == post.id)
    )
    refreshed = (await db.execute(stmt)).scalar_one()

    # Record base update audit event
    await record_audit_event(
        db=db,
        action="BLOG_POST_UPDATED",
        entity_type="BLOG_POST",
        user_id=auth.user.id,
        entity_id=str(refreshed.id),
        metadata={
            "title": refreshed.title,
            "slug": refreshed.slug,
            "status": refreshed.status,
            "old_status": old_status,
            "category_id": str(refreshed.category_id) if refreshed.category_id else None,
        },
    )

    # Record specific publishing state transition audit event if status changed
    if old_status != "published" and refreshed.status == "published":
        await record_audit_event(
            db=db,
            action="BLOG_POST_PUBLISHED",
            entity_type="BLOG_POST",
            user_id=auth.user.id,
            entity_id=str(refreshed.id),
            metadata={"title": refreshed.title, "slug": refreshed.slug},
        )
    elif old_status == "published" and refreshed.status != "published":
        await record_audit_event(
            db=db,
            action="BLOG_POST_UNPUBLISHED",
            entity_type="BLOG_POST",
            user_id=auth.user.id,
            entity_id=str(refreshed.id),
            metadata={"title": refreshed.title, "slug": refreshed.slug},
        )
    return BlogPostResponse.model_validate(refreshed)


@router.delete("/admin/blog/posts/{post_id}")
async def delete_blog_post(
    post_id: uuid.UUID,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin endpoint to permanently delete a blog post."""
    post = await db.get(BlogPost, post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blog post not found.")

    post_title = post.title
    post_slug = post.slug

    await db.delete(post)
    await db.commit()

    await record_audit_event(
        db=db,
        action="BLOG_POST_DELETED",
        entity_type="BLOG_POST",
        user_id=auth.user.id,
        entity_id=str(post_id),
        metadata={"title": post_title, "slug": post_slug},
    )
    return {"status": "deleted", "post_id": str(post_id)}


# ==========================================
# Category Endpoints (Admin)
# ==========================================
@router.get("/admin/blog/categories", response_model=List[BlogCategoryResponse])
async def list_admin_categories(
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin endpoint to list all blog categories."""
    stmt = select(BlogCategory).order_by(BlogCategory.name.asc())
    result = await db.execute(stmt)
    categories = result.scalars().all()
    return [BlogCategoryResponse.model_validate(c) for c in categories]


@router.post("/admin/blog/categories", response_model=BlogCategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_admin_category(
    cat_in: BlogCategoryCreateRequest,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin endpoint to create a new blog category.
    Enforces name and slug uniqueness with clean 409 validation.
    """
    clean_name = cat_in.name.strip()
    raw_slug = cat_in.slug or clean_name
    clean_slug = normalize_slug(raw_slug)

    if not clean_slug or not is_valid_slug(clean_slug):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The category slug must be lowercase, alphanumeric, and URL-safe with hyphens.",
        )

    # Collision pre-check for name or slug
    existing = await db.execute(
        select(BlogCategory.id).where(
            or_(BlogCategory.name == clean_name, BlogCategory.slug == clean_slug)
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A category with this name or slug already exists.",
        )

    category = BlogCategory(
        id=uuid.uuid4(),
        name=clean_name,
        slug=clean_slug,
        description=cat_in.description.strip() if cat_in.description else None,
    )
    db.add(category)

    try:
        await db.commit()
        await db.refresh(category)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A category with this name or slug already exists.",
        )

    await record_audit_event(
        db=db,
        action="BLOG_CATEGORY_CREATED",
        entity_type="BLOG_CATEGORY",
        user_id=auth.user.id,
        entity_id=str(category.id),
        metadata={"name": category.name, "slug": category.slug},
    )
    return BlogCategoryResponse.model_validate(category)


@router.patch("/admin/blog/categories/{category_id}", response_model=BlogCategoryResponse)
async def update_admin_category(
    category_id: uuid.UUID,
    cat_in: BlogCategoryUpdateRequest,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin endpoint to edit a category name, slug, or description.
    Enforces uniqueness against other categories.
    """
    category = await db.get(BlogCategory, category_id)
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")

    clean_name = cat_in.name.strip() if cat_in.name is not None else category.name
    clean_slug = normalize_slug(cat_in.slug) if cat_in.slug is not None else category.slug

    if not clean_slug or not is_valid_slug(clean_slug):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The category slug must be lowercase, alphanumeric, and URL-safe with hyphens.",
        )

    # Collision check excluding current category
    existing = await db.execute(
        select(BlogCategory.id).where(
            or_(BlogCategory.name == clean_name, BlogCategory.slug == clean_slug),
            BlogCategory.id != category_id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A category with this name or slug already exists.",
        )

    category.name = clean_name
    category.slug = clean_slug
    if cat_in.description is not None:
        category.description = cat_in.description.strip() if cat_in.description else None

    try:
        await db.commit()
        await db.refresh(category)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A category with this name or slug already exists.",
        )

    await record_audit_event(
        db=db,
        action="BLOG_CATEGORY_UPDATED",
        entity_type="BLOG_CATEGORY",
        user_id=auth.user.id,
        entity_id=str(category.id),
        metadata={"name": category.name, "slug": category.slug},
    )
    return BlogCategoryResponse.model_validate(category)


@router.delete("/admin/blog/categories/{category_id}")
async def delete_admin_category(
    category_id: uuid.UUID,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin endpoint to delete a blog category.
    Category Delete Safety (Option A):
    Rejects deletion with HTTP 409 Conflict if active blog posts reference this category.
    Prevents content orphaning and preserves article integrity.
    """
    category = await db.get(BlogCategory, category_id)
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")

    # Safety check: are any blog posts currently assigned to this category?
    count_stmt = select(func.count(BlogPost.id)).where(BlogPost.category_id == category_id)
    count_res = await db.execute(count_stmt)
    assigned_count = count_res.scalar() or 0

    if assigned_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete category '{category.name}' because {assigned_count} blog post(s) are assigned to it. Please reassign or update those posts first.",
        )

    cat_name = category.name
    cat_slug = category.slug

    await db.delete(category)
    await db.commit()

    await record_audit_event(
        db=db,
        action="BLOG_CATEGORY_DELETED",
        entity_type="BLOG_CATEGORY",
        user_id=auth.user.id,
        entity_id=str(category_id),
        metadata={"name": cat_name, "slug": cat_slug},
    )
    return {"status": "deleted", "category_id": str(category_id)}


# ==========================================
# Media Endpoints (Admin & Public)
# ==========================================
@router.post("/admin/blog/media", response_model=MediaAssetResponse, status_code=status.HTTP_201_CREATED)
async def upload_blog_media(
    file: UploadFile = File(...),
    alt_text: Optional[str] = Form(None),
    caption: Optional[str] = Form(None),
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin endpoint to upload and optimize an image for blog articles.
    Performs multi-layer validation (size, extension, MIME, magic bytes, Pillow decoding, dimensions).
    Strips sensitive EXIF data, corrects orientation, and stores safely.
    """
    if not file or not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file uploaded.")

    # Read binary stream
    raw_bytes = await file.read()

    # Validate and process image
    result = process_and_validate_image(
        raw_bytes=raw_bytes,
        original_filename=file.filename,
        declared_content_type=file.content_type or "",
    )

    media_id = uuid.uuid4()
    now_utc = datetime.now(timezone.utc)
    stored_filename = f"{media_id.hex}{result['extension']}"
    storage_key = f"blog/{now_utc.year}/{now_utc.month:02d}/{stored_filename}"

    # Save to disk
    try:
        media_storage.save(result["processed_bytes"], storage_key)
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to store media asset on server disk.",
        )

    public_url = f"{settings.MEDIA_PUBLIC_URL_PREFIX}/{storage_key}"

    clean_alt = alt_text.strip() if alt_text and alt_text.strip() else None
    clean_caption = caption.strip() if caption and caption.strip() else None

    media = MediaAsset(
        id=media_id,
        filename=stored_filename,
        original_filename=result["sanitized_filename"],
        storage_key=storage_key,
        public_url=public_url,
        mime_type=result["mime_type"],
        file_size=result["file_size"],
        width=result["width"],
        height=result["height"],
        alt_text=clean_alt,
        caption=clean_caption,
        checksum=result["checksum"],
        created_by=auth.user.id,
    )
    db.add(media)

    try:
        await db.commit()
        await db.refresh(media)
    except Exception as db_err:
        await db.rollback()
        # Clean up file from disk to prevent orphan
        media_storage.delete(storage_key)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist media asset record.",
        )

    await record_audit_event(
        db=db,
        action="BLOG_MEDIA_UPLOADED",
        entity_type="BLOG_MEDIA",
        user_id=auth.user.id,
        entity_id=str(media.id),
        metadata={
            "filename": media.filename,
            "original_filename": media.original_filename,
            "file_size": media.file_size,
            "mime_type": media.mime_type,
            "width": media.width,
            "height": media.height,
        },
    )

    return MediaAssetResponse.model_validate(media)


@router.get("/admin/blog/media", response_model=MediaAssetListResponse)
async def list_admin_media_assets(
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    search: Optional[str] = Query(None),
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin endpoint to list media assets with search and pagination.
    Ordered by created_at DESC.
    """
    query = select(MediaAsset)
    count_query = select(func.count(MediaAsset.id))

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        filter_clause = or_(
            func.lower(MediaAsset.original_filename).like(term),
            func.lower(MediaAsset.filename).like(term),
            func.lower(MediaAsset.alt_text).like(term),
        )
        query = query.where(filter_clause)
        count_query = count_query.where(filter_clause)

    total_res = await db.execute(count_query)
    total = total_res.scalar() or 0

    offset = (page - 1) * page_size
    query = query.order_by(desc(MediaAsset.created_at)).offset(offset).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()

    pages = (total + page_size - 1) // page_size if total > 0 else 1

    return MediaAssetListResponse(
        items=[MediaAssetResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/admin/blog/media/{media_id}", response_model=MediaAssetResponse)
async def get_admin_media_asset(
    media_id: uuid.UUID,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin endpoint to retrieve a single media asset by ID."""
    media = await db.get(MediaAsset, media_id)
    if not media:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media asset not found.")
    return MediaAssetResponse.model_validate(media)


@router.patch("/admin/blog/media/{media_id}", response_model=MediaAssetResponse)
async def update_admin_media_asset(
    media_id: uuid.UUID,
    media_in: MediaAssetUpdateRequest,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin endpoint to update media metadata (alt_text, caption).
    Does not modify server-controlled properties (storage_key, mime_type, dimensions).
    """
    media = await db.get(MediaAsset, media_id)
    if not media:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media asset not found.")

    fields_set = media_in.model_fields_set
    if "alt_text" in fields_set:
        media.alt_text = media_in.alt_text.strip() if media_in.alt_text and media_in.alt_text.strip() else None
    if "caption" in fields_set:
        media.caption = media_in.caption.strip() if media_in.caption and media_in.caption.strip() else None

    await db.commit()
    await db.refresh(media)

    await record_audit_event(
        db=db,
        action="BLOG_MEDIA_UPDATED",
        entity_type="BLOG_MEDIA",
        user_id=auth.user.id,
        entity_id=str(media.id),
        metadata={"alt_text": media.alt_text, "caption": media.caption},
    )

    return MediaAssetResponse.model_validate(media)


@router.delete("/admin/blog/media/{media_id}")
async def delete_admin_media_asset(
    media_id: uuid.UUID,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin endpoint to safely delete a media asset.
    Rejects deletion with HTTP 409 Conflict if the asset is referenced:
    - as featured_media_id in any blog post
    - inside any blog post Markdown content by storage_key or public_url
    """
    media = await db.get(MediaAsset, media_id)
    if not media:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media asset not found.")

    # 1. Check featured image references
    featured_ref_stmt = select(func.count(BlogPost.id)).where(BlogPost.featured_media_id == media_id)
    featured_count = (await db.execute(featured_ref_stmt)).scalar() or 0
    if featured_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete media asset because it is currently used as the featured image for {featured_count} article(s).",
        )

    # 2. Check inline markdown content references
    content_ref_stmt = select(func.count(BlogPost.id)).where(
        or_(
            BlogPost.content.contains(media.storage_key),
            BlogPost.content.contains(media.public_url),
        )
    )
    content_count = (await db.execute(content_ref_stmt)).scalar() or 0
    if content_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete media asset because it is referenced in the content of {content_count} article(s).",
        )

    storage_key = media.storage_key
    media_filename = media.filename

    # Delete from DB
    await db.delete(media)
    await db.commit()

    # Delete from disk
    media_storage.delete(storage_key)

    await record_audit_event(
        db=db,
        action="BLOG_MEDIA_DELETED",
        entity_type="BLOG_MEDIA",
        user_id=auth.user.id,
        entity_id=str(media_id),
        metadata={"filename": media_filename, "storage_key": storage_key},
    )

    return {"status": "deleted", "media_id": str(media_id)}


@router.get("/media/{path:path}")
async def serve_public_media(path: str):
    """
    Public controlled media serving endpoint.
    Safely resolves path within MEDIA_ROOT, prevents path traversal,
    and returns image with strict headers.
    """
    # Defensive path check
    if not path or ".." in path or "\\" in path or "\0" in path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found.")

    abs_path = media_storage.get_path(path)
    if not abs_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found.")

    # Determine safe MIME type from extension
    ext = os.path.splitext(abs_path)[1].lower()
    mime_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }
    media_type = mime_map.get(ext, "application/octet-stream")

    return FileResponse(
        abs_path,
        media_type=media_type,
        headers={
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": "inline",
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    )


# ==========================================
# Support & Contact Endpoints
# ==========================================
@router.post("/contact", status_code=status.HTTP_201_CREATED)
async def submit_contact_message(
    msg_in: ContactMessageCreate,
    db: AsyncSession = Depends(get_db),
):
    """Submits a public contact message."""
    msg = ContactMessage(
        id=uuid.uuid4(),
        name=msg_in.name,
        email=msg_in.email,
        subject=msg_in.subject,
        message=msg_in.message,
    )
    db.add(msg)
    await db.commit()
    return {"status": "received", "message": "Thank you for reaching out. We will get back to you shortly."}


@router.post("/support/tickets", response_model=SupportTicketResponse, status_code=status.HTTP_201_CREATED)
async def create_support_ticket(
    ticket_in: SupportTicketCreate,
    token_data: Dict[str, Any] = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    """Creates a customer support ticket."""
    user, org = await get_or_create_user(db, token_data)

    ticket = SupportTicket(
        id=uuid.uuid4(),
        user_id=user.id,
        organization_id=org.id,
        subject=ticket_in.subject,
        message=ticket_in.message,
        priority=ticket_in.priority,
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)
    return SupportTicketResponse.model_validate(ticket)


# ==========================================
# Phase E7: Public Resources Endpoints
# ==========================================
@router.get("/resources", response_model=ResourceListResponse)
async def list_public_resources(
    q: Optional[str] = Query(None, description="Search term for title and description"),
    resource_type: Optional[str] = Query(None, description="Filter by resource type"),
    category: Optional[str] = Query(None, description="Filter by category"),
    page: Optional[int] = Query(1, description="Page number (1-indexed)"),
    page_size: Optional[int] = Query(12, description="Items per page (max 50)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Lists publicly available resources (guides, checklists, templates, tools).
    Strictly excludes drafts and future-scheduled resources.
    """
    now_utc = datetime.now(timezone.utc)
    base_conditions = [
        Resource.status == "published",
        Resource.published_at.is_not(None),
        Resource.published_at <= now_utc,
    ]

    if q:
        clean_q = q.strip()[:200]
        search_pattern = f"%{clean_q}%"
        base_conditions.append(
            or_(
                Resource.title.ilike(search_pattern),
                Resource.description.ilike(search_pattern),
            )
        )

    if resource_type:
        base_conditions.append(Resource.resource_type == resource_type.strip().lower())

    if category:
        base_conditions.append(Resource.category.ilike(category.strip()))

    stmt = (
        select(Resource)
        .options(selectinload(Resource.featured_media))
        .where(*base_conditions)
        .order_by(desc(Resource.published_at), desc(Resource.created_at))
    )

    effective_page = max(1, page) if page is not None else 1
    effective_page_size = min(50, max(1, page_size)) if page_size is not None else 12

    count_stmt = select(func.count(Resource.id)).where(*base_conditions)
    total = (await db.execute(count_stmt)).scalar_one()
    total_pages = math.ceil(total / effective_page_size) if total > 0 else 1

    paginated_stmt = stmt.offset((effective_page - 1) * effective_page_size).limit(effective_page_size)
    result = await db.execute(paginated_stmt)
    resources = result.scalars().all()

    return ResourceListResponse(
        items=[ResourceResponse.model_validate(r) for r in resources],
        total=total,
        page=effective_page,
        page_size=effective_page_size,
        total_pages=total_pages,
        has_next=effective_page < total_pages,
        has_previous=effective_page > 1,
    )


@router.get("/resources/{slug}", response_model=ResourceResponse)
async def get_public_resource(slug: str, db: AsyncSession = Depends(get_db)):
    """
    Retrieves a single published resource by slug.
    Strictly returns 404 for drafts, future-scheduled resources, or non-existent slugs.
    """
    clean_slug = normalize_slug(slug)
    now_utc = datetime.now(timezone.utc)
    stmt = (
        select(Resource)
        .options(selectinload(Resource.featured_media))
        .where(
            Resource.slug == clean_slug,
            Resource.status == "published",
            Resource.published_at.is_not(None),
            Resource.published_at <= now_utc,
        )
    )
    result = await db.execute(stmt)
    resource = result.scalar_one_or_none()

    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found.")

    return ResourceResponse.model_validate(resource)


@router.get("/resources/sitemap/items", response_model=List[ResourceSitemapItem])
async def get_resources_sitemap_items(db: AsyncSession = Depends(get_db)):
    """Public endpoint for dynamic sitemap generator to fetch published resources."""
    now_utc = datetime.now(timezone.utc)
    stmt = (
        select(Resource.slug, Resource.title, Resource.published_at, Resource.updated_at)
        .where(
            Resource.status == "published",
            Resource.published_at.is_not(None),
            Resource.published_at <= now_utc,
        )
        .order_by(desc(Resource.published_at))
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        ResourceSitemapItem(
            slug=row.slug,
            title=row.title,
            published_at=row.published_at,
            updated_at=row.updated_at,
        )
        for row in rows
    ]


# ==========================================
# Phase E7: Admin Resources Endpoints
# ==========================================
@router.get("/admin/resources", response_model=ResourceListResponse)
async def list_admin_resources(
    q: Optional[str] = Query(None, description="Search term for title and description"),
    status: Optional[str] = Query(None, description="Filter by status (draft, published)"),
    resource_type: Optional[str] = Query(None, description="Filter by resource type"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin endpoint to list all resources including drafts."""
    conditions = []
    if q:
        search_pattern = f"%{q.strip()}%"
        conditions.append(
            or_(
                Resource.title.ilike(search_pattern),
                Resource.description.ilike(search_pattern),
            )
        )
    if status:
        conditions.append(Resource.status == status.strip().lower())
    if resource_type:
        conditions.append(Resource.resource_type == resource_type.strip().lower())

    stmt = (
        select(Resource)
        .options(selectinload(Resource.featured_media))
        .where(*conditions)
        .order_by(desc(Resource.created_at))
    )

    count_stmt = select(func.count(Resource.id)).where(*conditions)
    total = (await db.execute(count_stmt)).scalar_one()
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    paginated_stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(paginated_stmt)
    resources = result.scalars().all()

    return ResourceListResponse(
        items=[ResourceResponse.model_validate(r) for r in resources],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_previous=page > 1,
    )


@router.post("/admin/resources", response_model=ResourceResponse, status_code=status.HTTP_201_CREATED)
async def create_admin_resource(
    res_in: ResourceCreateRequest,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Creates a new technical resource (guide, checklist, tool)."""
    raw_slug = res_in.slug or res_in.title
    clean_slug = normalize_slug(raw_slug)

    # Check slug collision
    existing = await db.execute(select(Resource).where(Resource.slug == clean_slug))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Resource with slug '{clean_slug}' already exists.",
        )

    now_utc = datetime.now(timezone.utc)
    status_val = res_in.status.strip().lower() if res_in.status else "draft"
    published_at_val = now_utc if status_val == "published" else None

    resource = Resource(
        id=uuid.uuid4(),
        title=res_in.title.strip(),
        slug=clean_slug,
        description=res_in.description.strip(),
        resource_type=res_in.resource_type.strip().lower(),
        category=res_in.category.strip() if res_in.category else None,
        featured_image=res_in.featured_image,
        featured_media_id=res_in.featured_media_id,
        file_url=res_in.file_url,
        external_url=res_in.external_url,
        content=res_in.content,
        status=status_val,
        published_at=published_at_val,
        created_by=auth.user.id,
    )
    db.add(resource)
    await db.commit()

    # Load relationship for response
    stmt = select(Resource).options(selectinload(Resource.featured_media)).where(Resource.id == resource.id)
    reloaded = (await db.execute(stmt)).scalar_one()

    await record_audit_event(
        db=db,
        action="RESOURCE_CREATED",
        entity_type="RESOURCE",
        organization_id=auth.organization.id if auth.organization else None,
        user_id=auth.user.id,
        entity_id=str(resource.id),
        metadata={"title": resource.title, "slug": resource.slug},
    )

    return ResourceResponse.model_validate(reloaded)


@router.get("/admin/resources/{id}", response_model=ResourceResponse)
async def get_admin_resource_detail(
    id: uuid.UUID,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves a single resource for admin management."""
    stmt = select(Resource).options(selectinload(Resource.featured_media)).where(Resource.id == id)
    result = await db.execute(stmt)
    resource = result.scalar_one_or_none()
    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found.")
    return ResourceResponse.model_validate(resource)


@router.patch("/admin/resources/{id}", response_model=ResourceResponse)
async def update_admin_resource(
    id: uuid.UUID,
    res_in: ResourceUpdateRequest,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Updates an existing resource."""
    stmt = select(Resource).options(selectinload(Resource.featured_media)).where(Resource.id == id)
    result = await db.execute(stmt)
    resource = result.scalar_one_or_none()
    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found.")

    if res_in.title is not None:
        resource.title = res_in.title.strip()

    if res_in.slug is not None:
        clean_slug = normalize_slug(res_in.slug)
        if clean_slug != resource.slug:
            existing = await db.execute(select(Resource).where(Resource.slug == clean_slug, Resource.id != id))
            if existing.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Resource with slug '{clean_slug}' already exists.",
                )
            resource.slug = clean_slug

    if res_in.description is not None:
        resource.description = res_in.description.strip()
    if res_in.resource_type is not None:
        resource.resource_type = res_in.resource_type.strip().lower()
    if res_in.category is not None:
        resource.category = res_in.category.strip()
    if res_in.featured_image is not None:
        resource.featured_image = res_in.featured_image
    if res_in.featured_media_id is not None:
        resource.featured_media_id = res_in.featured_media_id
    if res_in.file_url is not None:
        resource.file_url = res_in.file_url
    if res_in.external_url is not None:
        resource.external_url = res_in.external_url
    if res_in.content is not None:
        resource.content = res_in.content

    if res_in.status is not None:
        new_status = res_in.status.strip().lower()
        if new_status == "published" and resource.status != "published":
            resource.published_at = datetime.now(timezone.utc)
        elif new_status == "draft":
            resource.published_at = None
        resource.status = new_status

    await db.commit()
    await db.refresh(resource)

    await record_audit_event(
        db=db,
        action="RESOURCE_UPDATED",
        entity_type="RESOURCE",
        organization_id=auth.organization.id if auth.organization else None,
        user_id=auth.user.id,
        entity_id=str(resource.id),
        metadata={"title": resource.title, "status": resource.status},
    )

    return ResourceResponse.model_validate(resource)


@router.delete("/admin/resources/{id}", status_code=status.HTTP_200_OK)
async def delete_admin_resource(
    id: uuid.UUID,
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Deletes a resource."""
    stmt = select(Resource).where(Resource.id == id)
    result = await db.execute(stmt)
    resource = result.scalar_one_or_none()
    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found.")

    res_title = resource.title
    await db.delete(resource)
    await db.commit()

    await record_audit_event(
        db=db,
        action="RESOURCE_DELETED",
        entity_type="RESOURCE",
        organization_id=auth.organization.id if auth.organization else None,
        user_id=auth.user.id,
        entity_id=str(id),
        metadata={"title": res_title},
    )

    return {"status": "deleted", "message": f"Resource '{res_title}' deleted successfully."}


# ==========================================
# Phase E7: Newsletter Endpoints
# ==========================================
@router.post("/newsletter/subscribe", status_code=status.HTTP_200_OK)
async def subscribe_newsletter(
    sub_in: NewsletterSubscribeRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Subscribes an email address to SiteSecura security updates and technical guides.
    Rate limited to prevent spam. Handles duplicate subscriptions idempotently.
    """
    client_ip = request.client.host if request.client else "unknown"
    await check_rate_limit(f"newsletter:{client_ip}", max_requests=5, window_seconds=300)

    clean_email = sub_in.email.strip().lower()
    stmt = select(NewsletterSubscriber).where(NewsletterSubscriber.email == clean_email)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    now_utc = datetime.now(timezone.utc)

    if existing:
        if existing.status == "subscribed":
            # Idempotent friendly response
            return {
                "status": "subscribed",
                "message": "You are already subscribed to SiteSecura security updates!",
            }
        else:
            # Reactivate
            existing.status = "subscribed"
            existing.subscribed_at = now_utc
            existing.unsubscribed_at = None
            existing.source = sub_in.source or existing.source
            await db.commit()
            return {
                "status": "subscribed",
                "message": "Welcome back! Your newsletter subscription has been reactivated.",
            }

    # Create new subscriber
    subscriber = NewsletterSubscriber(
        id=uuid.uuid4(),
        email=clean_email,
        status="subscribed",
        source=sub_in.source or "blog",
        subscribed_at=now_utc,
    )
    db.add(subscriber)
    await db.commit()

    # Send confirmation email
    send_email(
        to_email=clean_email,
        subject="Welcome to SiteSecura Security Insights",
        text_content=(
            f"Hello,\n\n"
            f"Thank you for subscribing to SiteSecura Security Insights.\n\n"
            f"You will receive actionable tutorials, technical vulnerability advisories, "
            f"and defensive security guidelines.\n\n"
            f"Best regards,\nThe SiteSecura Engineering Team\nhttps://sitesecura.com"
        ),
    )

    return {
        "status": "subscribed",
        "message": "Thank you for subscribing to SiteSecura security insights!",
    }


@router.post("/newsletter/unsubscribe", status_code=status.HTTP_200_OK)
async def unsubscribe_newsletter(
    sub_in: NewsletterUnsubscribeRequest,
    db: AsyncSession = Depends(get_db),
):
    """Unsubscribes an email address safely and idempotently."""
    clean_email = sub_in.email.strip().lower()
    stmt = select(NewsletterSubscriber).where(NewsletterSubscriber.email == clean_email)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing and existing.status != "unsubscribed":
        existing.status = "unsubscribed"
        existing.unsubscribed_at = datetime.now(timezone.utc)
        await db.commit()

    return {
        "status": "unsubscribed",
        "message": "You have been successfully unsubscribed from SiteSecura security updates.",
    }


@router.get("/admin/newsletter/subscribers", response_model=NewsletterSubscriberListResponse)
async def list_admin_newsletter_subscribers(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin endpoint to view newsletter subscribers."""
    count_stmt = select(func.count(NewsletterSubscriber.id))
    total = (await db.execute(count_stmt)).scalar_one()
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    stmt = (
        select(NewsletterSubscriber)
        .order_by(desc(NewsletterSubscriber.subscribed_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    subscribers = result.scalars().all()

    return NewsletterSubscriberListResponse(
        items=[NewsletterSubscriberResponse.model_validate(s) for s in subscribers],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


# ==========================================
# Phase E7: Content Analytics Endpoints
# ==========================================
ALLOWED_ANALYTICS_EVENTS = {
    "blog_article_view",
    "blog_cta_click",
    "resource_view",
    "resource_download",
    "newsletter_signup",
    "blog_search",
    "doc_feedback_helpful",
    "doc_feedback_unhelpful",
}


@router.post("/docs/feedback", response_model=DocFeedbackResponse, status_code=status.HTTP_200_OK)
async def submit_doc_feedback(
    feedback_in: DocFeedbackCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint for documentation helpfulness feedback.
    Rate-limited and privacy-preserving: stores anonymous engagement data
    in content_analytics_events without storing IP address or PII.
    """
    client_ip = request.client.host if request.client else "unknown"
    # Rate limit: max 30 feedback submissions per minute per IP
    await check_rate_limit(f"doc_feedback:{client_ip}", max_requests=30, window_seconds=60)

    clean_slug = normalize_slug(feedback_in.article_slug)
    if not clean_slug:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Article slug is required and must be valid.",
        )

    event_name = "doc_feedback_helpful" if feedback_in.helpful else "doc_feedback_unhelpful"
    resolved_path = (
        feedback_in.path.strip()[:500]
        if feedback_in.path
        else f"/docs/{feedback_in.category or 'general'}/{clean_slug}"
    )

    try:
        event = ContentAnalyticsEvent(
            id=uuid.uuid4(),
            event_name=event_name,
            content_type="doc_article",
            content_id=clean_slug,
            path=resolved_path,
            source="docs_feedback",
            campaign=feedback_in.reason.strip()[:100] if feedback_in.reason else None,
            created_at=datetime.now(timezone.utc),
        )
        db.add(event)
        await db.commit()
    except Exception:
        # Non-blocking telemetry
        pass

    return DocFeedbackResponse(
        status="recorded",
        message="Thank you for your feedback! We continually refine our security documentation based on user input.",
        helpful=feedback_in.helpful,
    )


@router.post("/analytics/events", status_code=status.HTTP_200_OK)
async def record_content_analytics_event(
    event_in: ContentAnalyticsEventCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Public ingestion endpoint for lightweight, privacy-safe content engagement telemetry.
    Never blocks page rendering. Does not collect sensitive user data.
    """
    client_ip = request.client.host if request.client else "unknown"
    # Rate limit: max 120 events per minute
    await check_rate_limit(f"analytics:{client_ip}", max_requests=120, window_seconds=60)

    clean_event = event_in.event_name.strip().lower()
    if clean_event not in ALLOWED_ANALYTICS_EVENTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid event name '{clean_event}'.",
        )

    try:
        event = ContentAnalyticsEvent(
            id=uuid.uuid4(),
            event_name=clean_event,
            content_type=event_in.content_type[:50] if event_in.content_type else None,
            content_id=event_in.content_id[:255] if event_in.content_id else None,
            path=event_in.path[:500] if event_in.path else None,
            referrer=event_in.referrer[:500] if event_in.referrer else None,
            source=event_in.source[:100] if event_in.source else None,
            campaign=event_in.campaign[:100] if event_in.campaign else None,
            created_at=datetime.now(timezone.utc),
        )
        db.add(event)
        await db.commit()
    except Exception as exc:
        # Non-blocking: analytics error must never crash user experience
        pass

    return {"status": "recorded"}


@router.get("/admin/analytics/content", response_model=ContentAnalyticsSummaryResponse)
async def get_admin_content_analytics(
    days: int = Query(30, ge=1, le=90, description="Time window in days"),
    auth: AuthContext = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Calculates operational content metrics from real database events.
    Zero synthetic or hardcoded metrics.
    """
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # 1. Total counts by event name
    counts_stmt = (
        select(ContentAnalyticsEvent.event_name, func.count(ContentAnalyticsEvent.id))
        .where(ContentAnalyticsEvent.created_at >= cutoff)
        .group_by(ContentAnalyticsEvent.event_name)
    )
    counts_res = await db.execute(counts_stmt)
    event_counts = {row[0]: row[1] for row in counts_res.all()}

    # 2. Top articles by views
    top_articles_stmt = (
        select(ContentAnalyticsEvent.content_id, func.count(ContentAnalyticsEvent.id).label("views"))
        .where(
            ContentAnalyticsEvent.created_at >= cutoff,
            ContentAnalyticsEvent.event_name == "blog_article_view",
            ContentAnalyticsEvent.content_id.is_not(None),
        )
        .group_by(ContentAnalyticsEvent.content_id)
        .order_by(desc("views"))
        .limit(5)
    )
    top_articles_res = await db.execute(top_articles_stmt)
    top_articles = [
        TopContentMetric(content_id=row[0], content_type="blog_post", views=row[1])
        for row in top_articles_res.all()
    ]

    # 3. Top resources by views
    top_resources_stmt = (
        select(ContentAnalyticsEvent.content_id, func.count(ContentAnalyticsEvent.id).label("views"))
        .where(
            ContentAnalyticsEvent.created_at >= cutoff,
            ContentAnalyticsEvent.event_name == "resource_view",
            ContentAnalyticsEvent.content_id.is_not(None),
        )
        .group_by(ContentAnalyticsEvent.content_id)
        .order_by(desc("views"))
        .limit(5)
    )
    top_resources_res = await db.execute(top_resources_stmt)
    top_resources = [
        TopContentMetric(content_id=row[0], content_type="resource", views=row[1])
        for row in top_resources_res.all()
    ]

    return ContentAnalyticsSummaryResponse(
        time_window_days=days,
        total_article_views=event_counts.get("blog_article_view", 0),
        total_resource_views=event_counts.get("resource_view", 0),
        total_cta_clicks=event_counts.get("blog_cta_click", 0),
        total_newsletter_signups=event_counts.get("newsletter_signup", 0),
        top_articles=top_articles,
        top_resources=top_resources,
    )
