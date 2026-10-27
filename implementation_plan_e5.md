# SiteSecura — Phase E5 Implementation Plan: Taxonomy & Discovery

This document outlines the implementation plan for **Phase E5: Taxonomy & Discovery** for the SiteSecura Blog CMS.

---

## 1. Overview & Objectives

Turn the existing SiteSecura Blog into a structured, production-ready content discovery system.
- **Tags**: Multi-tag assignment, slug normalization, collision prevention, safe deletion, tag filtering.
- **Authors**: Dedicated public author profile model (`BlogAuthor`), author selector in admin, safe attribution, zero private data exposure.
- **Categories**: Dynamic category filtering, seamless combination with search and tags.
- **Search**: Server-side parameterized search against title, excerpt, and content with deterministic relevance ranking.
- **Filters**: Combinable query parameters (`?q=...&category=...&tag=...&author=...&featured=...`).
- **Pagination**: Server-side pagination with limit/offset, page bounds, and filter preservation across pages.
- **Featured Articles**: Admin toggle (`is_featured`), public filter, strict publication status enforcement.
- **Related Articles**: Deterministic relevance scoring (+3 category, +2 shared tags, +1 author), published-only exposure.

---

## 2. Files to Create

1. `apps/api/alembic/versions/009_add_blog_taxonomy_e5.py` - Database migration for tags, authors, post associations, and featured status.
2. `tests/test_cms_phase_e5.py` - Comprehensive backend test suite (minimum 50 test cases).
3. `walkthrough_e5.md` - Complete post-implementation documentation and test verification report.

---

## 3. Files to Change

1. `apps/api/app/models/cms.py` - Add `BlogTag`, `BlogPostTag`, `BlogAuthor` models; update `BlogPost` with `is_featured`, `author_id`, `author`, `tags`.
2. `apps/api/app/models/__init__.py` - Export new models.
3. `apps/api/app/schemas/shared.py` - Add tag, author, summary, and paginated response schemas; update post schemas.
4. `apps/api/app/api/v1/cms.py` - Implement search, filtering, pagination, tag & author management, related article resolution, and audit logging.
5. `apps/web/src/types/index.ts` - Add TypeScript interfaces for tags, authors, summaries, and paginated listings.
6. `apps/web/src/lib/api.ts` - Add tag, author, related posts, and paginated query client methods.
7. `apps/web/src/app/blog/page.tsx` - Add search bar, category pills, tag chips, pagination bar, and featured badge.
8. `apps/web/src/app/blog/[slug]/page.tsx` - Add dynamic author attribution, tag chips, and related articles section.
9. `apps/web/src/app/admin/blog/page.tsx` - Add author selector, multi-tag picker with inline creation, featured checkbox, and Tags tab.

---

## 4. Database Changes & Migration Strategy

- **Migration**: `009_add_blog_taxonomy_e5.py`
- **Tables created**:
  - `blog_authors`: `id` (UUID PK), `name` (String 100), `slug` (String 100 unique indexed), `bio` (Text nullable), `avatar_url` (String 500 nullable), `user_id` (UUID FK to `users.id` nullable), `created_at`, `updated_at`.
  - `blog_tags`: `id` (UUID PK), `name` (String 100 unique), `slug` (String 100 unique indexed), `description` (String 255 nullable), `created_at`, `updated_at`.
  - `blog_post_tags`: `blog_post_id` (UUID FK to `blog_posts.id` CASCADE), `tag_id` (UUID FK to `blog_tags.id` CASCADE), composite PK `(blog_post_id, tag_id)`.
- **Columns added to `blog_posts`**:
  - `author_id`: UUID nullable, FK to `blog_authors.id` (`ondelete="SET NULL"`).
  - `is_featured`: Boolean default `False`, `nullable=False`.
- **Indexes**:
  - `ix_blog_authors_slug` on `blog_authors(slug)`
  - `ix_blog_tags_slug` on `blog_tags(slug)`
  - `ix_blog_post_tags_post_id` on `blog_post_tags(blog_post_id)`
  - `ix_blog_post_tags_tag_id` on `blog_post_tags(tag_id)`
  - `ix_blog_posts_author_id` on `blog_posts(author_id)`
  - `ix_blog_posts_is_featured` on `blog_posts(is_featured)`
- **Data Preservation & Seeding**:
  - Seed default author: "SiteSecura Team" (`sitesecura-team`) so legacy articles have default attribution.
  - Zero disruption to existing rows in `blog_posts`, `blog_categories`, `media_assets`, `blog_post_faqs`, or `blog_redirects`.

---

## 5. API Changes

- **Public Endpoints**:
  - `GET /api/v1/blog/posts`: Supports query params `q`, `category`, `tag`, `author`, `featured`, `page`, `page_size`. Returns `BlogPostListResponse` when pagination params are passed; returns `List[BlogPostResponse]` when unpaginated for full Phase E1 compatibility.
  - `GET /api/v1/blog/posts/{slug}`: Includes `author`, `tags`, and `related_posts`.
  - `GET /api/v1/blog/posts/{slug}/related`: Dedicated endpoint returning `List[BlogPostSummaryResponse]`.
  - `GET /api/v1/blog/tags`: Lists all tags with post counts.
  - `GET /api/v1/blog/authors`: Lists public author profiles with sanitized fields.
- **Admin Endpoints**:
  - `GET /api/v1/admin/blog/tags`: List tags.
  - `POST /api/v1/admin/blog/tags`: Create tag.
  - `PATCH /api/v1/admin/blog/tags/{tag_id}`: Update tag.
  - `DELETE /api/v1/admin/blog/tags/{tag_id}`: Safe delete tag associations.
  - `GET /api/v1/admin/blog/authors`: List authors.
  - `POST /api/v1/admin/blog/authors`: Create author.
  - `PATCH /api/v1/admin/blog/authors/{author_id}`: Update author.
  - `DELETE /api/v1/admin/blog/authors/{author_id}`: Delete author.

---

## 6. Frontend Changes

- **`/blog` Listing Page**:
  - Dynamic search input with clear button.
  - Dynamic category pills and tag chips.
  - Accessible pagination bar (Previous, Page X of Y, Next) preserving active URL search params.
  - Subtle "Featured" badge on post cards.
- **`/blog/[slug]` Article Page**:
  - Author attribution: "By SiteSecura Team" (or author name).
  - Tags display linking to `/blog?tag={slug}`.
  - Related articles section rendering 2-3 cards.
- **`/admin/blog` Admin Page**:
  - Author selector in Create/Edit forms.
  - Multi-tag selector with search, chips, and quick-add in Create/Edit forms.
  - "Mark as Featured Article" checkbox.
  - Dedicated "Tags" tab for administrative management.

---

## 7. Tests & Verification Strategy

- **`tests/test_cms_phase_e5.py`**:
  - 50+ test cases covering tags, authors, categories, search, pagination, combinations, featured posts, related articles, and security.
- **Regression Suites**:
  - `pytest tests/test_cms_phase_e1.py -v` (22 tests)
  - `pytest tests/test_cms_phase_e2.py -v` (8 tests)
  - `pytest tests/test_cms_phase_e3.py -v` (18 tests)
  - `pytest tests/test_cms_phase_e4.py -v` (10 tests)
- **Frontend Build**:
  - `npm.cmd run build` in `apps/web` (verifying 43+ routes compile with 0 errors).

---

## 8. Compatibility Risks & Mitigations

1. **Risk**: Existing test suites (e.g. E1) call `client.get("/api/v1/blog/posts")` expecting a JSON array.
   - **Mitigation**: When `page` and `page_size` are omitted, return `List[BlogPostResponse]`. When `page` or `page_size` is passed, return `BlogPostListResponse`.
2. **Risk**: Author attribution exposes sensitive account info.
   - **Mitigation**: Dedicated `BlogAuthor` model and `BlogAuthorResponse` completely separate from `User`, omitting `email`, `firebase_uid`, and `organization_id`.
3. **Risk**: Unpublished drafts leak through search or taxonomy filters.
   - **Mitigation**: Every public query unconditionally applies `status == 'published'` and `published_at <= now_utc`. Draft counts and draft titles are never leaked.
