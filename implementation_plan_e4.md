# SiteSecura — Phase E4 Implementation Plan
**Phase E4: SEO Engine, Structured Data, Dynamic Sitemap, Robots Integration & Slug Redirects**

---

## 1. Existing SEO Implementation
- Root layout (`apps/web/src/app/layout.tsx`): Sets `metadataBase` to `process.env.NEXT_PUBLIC_APP_URL || "https://scanly.io"` (with site origin fallback), global title template `"%s | SiteSecura"`, default title, description, and keywords.
- Blog list page (`apps/web/src/app/blog/page.tsx`): Client-rendered page without dedicated metadata export.
- Blog post detail page (`apps/web/src/app/blog/[slug]/page.tsx`): Currently a client component (`"use client"`) using `useEffect` and `useParams`. Does not export `generateMetadata` and has no structured data scripts (`application/ld+json`).
- Zero instances of `application/ld+json` currently exist across `apps/web`.

## 2. Existing Metadata Fields
Inspected on `BlogPost` model (`apps/api/app/models/cms.py`):
- `title`: String(255), required
- `slug`: String(255), unique, indexed, required
- `excerpt`: Text, required
- `content`: Text (canonical Markdown source), required
- `seo_title`: String(255), nullable
- `meta_description`: String(500), nullable
- `canonical_url`: String(500), nullable
- `og_image`: String(500), nullable
- `featured_image`: String(500), nullable (legacy URL string)
- `featured_media_id`: UUID, nullable, foreign key to `media_assets.id`
- `status`: String(50) — "draft" | "published" | "scheduled" | "archived"
- `published_at`: DateTime(timezone=True), nullable
- `created_at`, `updated_at`: DateTime(timezone=True) via `TimestampMixin`

No duplicate metadata fields will be created. The existing authoritative fields will be utilized.

## 3. Existing URL Architecture
- Public blog index: `/blog`
- Public article: `/blog/[slug]`
- Admin blog CMS: `/admin/blog`
- Public media serving: `/api/v1/media/{path:path}`
- Site origin: Configurable via `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL`, defaulting to `https://sitesecura.com` in production and `http://localhost:3000` in development.

## 4. Existing Sitemap Architecture
- `apps/web/src/app/sitemap.ts`: Currently returns a hardcoded array of static paths (`/`, `/features`, `/pricing`, `/blog`, etc.) with a hardcoded `baseUrl = "https://scanly.io"`.
- Does not query or dynamically include published blog articles.

## 5. Existing Robots Architecture
- `apps/web/src/app/robots.ts`: Disallows `["/dashboard/", "/admin/", "/api/", "/scan/"]`, allows `/`, with hardcoded sitemap directive `https://scanly.io/sitemap.xml`.
- Needs dynamic site origin configuration and explicit preservation of all disallow rules while keeping `/blog` crawlable.

## 6. Existing Media Architecture
- Implemented in Phase E3: `MediaAsset` table with `public_url`, `mime_type`, `file_size`, `width`, `height`, `alt_text`, `caption`, and SHA-256 checksum.
- `BlogPost.featured_media` relation provides access to rich image dimensions and metadata.

## 7. Existing Slug Behavior
- `normalize_slug()` and `is_valid_slug()` in `apps/api/app/utils/slug.py`.
- Enforces lowercase alphanumeric characters and single hyphens.
- Uniqueness enforced via database unique constraint on `blog_posts.slug` and pre-check in `POST /admin/blog/posts` and `PATCH /admin/blog/posts/{id}`.
- Currently, when an article's slug is updated, no redirect history is created.

## 8. Proposed SEO Architecture
Transform article content into a fully SEO-aware publishing pipeline:
```
ADMIN CMS (Admin updates post / SEO / FAQs / slug)
   │
   ├─► BlogPost SEO Fields (seo_title, meta_description, canonical_url, og_image)
   ├─► BlogPostFAQ (article-scoped FAQ items)
   ├─► BlogRedirect (slug change history tracking)
   ▼
PUBLIC SERVING (/blog/[slug])
   │
   ├─► Server-Side Route (checks published status, handles 301/308 redirects, 404 for drafts)
   ├─► generateMetadata() (Dynamic <title>, <meta description>, canonical, OpenGraph, Twitter/X)
   ├─► Structured Data Components:
   │     ├─► BlogPosting / Article JSON-LD
   │     ├─► FAQPage JSON-LD
   │     └─► BreadcrumbList JSON-LD
   └─► Rendered Page (Article content + Featured Image + Visible FAQ accordion)

DISCOVERY
   │
   ├─► Dynamic Sitemap (/sitemap.xml) fetches published articles + featured media images
   └─► Robots.txt (/robots.txt) references configured site origin sitemap
```

## 9. Metadata Precedence Rules
- **Title**:
  1. `post.seo_title` if non-empty string.
  2. Fallback: `post.title`.
  3. Formatted using the global layout template `"%s | SiteSecura"`.
- **Description**:
  1. `post.meta_description` if non-empty string.
  2. Fallback: `post.excerpt` if non-empty string.
  3. Fallback: Safely strip Markdown syntax from `post.content` and truncate cleanly to ~160 characters.
  4. Stored CMS content is never altered or truncated; truncation applies strictly to emitted meta tag values.

## 10. Canonical URL Strategy
- Precedence:
  1. Explicit `post.canonical_url` if valid `http://` or `https://` URL (validating against `javascript:`, `data:`, `vbscript:` schemes).
  2. Generated canonical URL: `${SITE_URL}/blog/${post.slug}`.
- Production origin resolved via centralized helper `toAbsoluteUrl(pathOrUrl)` using configured site origin.

## 11. OpenGraph Strategy
- `og:type`: `"article"`
- `og:title`: Derived from SEO title precedence.
- `og:description`: Derived from Meta description precedence.
- `og:url`: `${SITE_URL}/blog/${post.slug}`
- `og:site_name`: `"SiteSecura"`
- `og:locale`: `"en_US"`
- `og:published_time`: `post.published_at` (ISO 8601 string)
- `og:modified_time`: `(post.updated_at || post.published_at)` (ISO 8601 string)
- `og:image`:
  1. `post.og_image` (if valid safe URL).
  2. `post.featured_media.public_url` (resolved to absolute URL).
  3. Legacy `post.featured_image` (resolved to absolute URL).
  4. Default site social image: `${SITE_URL}/images/og-default.png`.
- Provide `og:image:width`, `og:image:height`, and `og:image:alt` when `featured_media` is linked.

## 12. Twitter/X Strategy
- `twitter:card`: `"summary_large_image"` if an image exists, else `"summary"`.
- `twitter:title`: Same as SEO title precedence.
- `twitter:description`: Same as Meta description precedence.
- `twitter:image`: Same as OpenGraph image precedence.

## 13. Article JSON-LD Strategy
- Schema: `@type`: `"BlogPosting"`
- Properties:
  - `@context`: `"https://schema.org"`
  - `headline`: Title precedence.
  - `description`: Meta description precedence.
  - `url`: Canonical URL.
  - `mainEntityOfPage`: `{"@type": "WebPage", "@id": canonicalUrl}`
  - `datePublished`: `post.published_at` ISO string.
  - `dateModified`: `post.updated_at || post.published_at` ISO string.
  - `author`: `{"@type": "Organization", "name": "SiteSecura Security Engineering", "url": SITE_URL}`.
  - `publisher`: `{"@type": "Organization", "name": "SiteSecura", "url": SITE_URL, "logo": {"@type": "ImageObject", "url": `${SITE_URL}/images/logo.png`}}`.
  - `image`: Absolute URL of representative featured image if present.
- Full Markdown article body is strictly excluded from JSON-LD to avoid bloated or unescaped structured data payloads.

## 14. FAQ JSON-LD Strategy
- Supported by a dedicated `BlogPostFAQ` database model for article-scoped questions and answers.
- Emits schema only when visible FAQs are present for the article.
- Schema: `@type`: `"FAQPage"` with `mainEntity`:
  ```json
  [
    {
      "@type": "Question",
      "name": "FAQ Question Here",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Sanitized plain text answer here"
      }
    }
  ]
  ```
- Public visibility: FAQs rendered visibly under the article content with accessible controls (`aria-expanded`).
- Truthfulness: Schema matches visible content 1:1; no hidden search-engine-only FAQ payloads.

## 15. Breadcrumb Strategy
- Schema: `@type`: `"BreadcrumbList"`
- Hierarchy:
  1. Position 1: `{"@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL}`
  2. Position 2: `{"@type": "ListItem", "position": 2, "name": "Blog", "item": `${SITE_URL}/blog`}`
  3. Position 3: `{"@type": "ListItem", "position": 3, "name": post.title, "item": `${SITE_URL}/blog/${post.slug}`}`
- Strictly adheres to instruction 81: Because public category routes belong to Phase E5, no fake category URLs are introduced into breadcrumbs.

## 16. Sitemap Strategy
- Updated in `apps/web/src/app/sitemap.ts`:
  - Retains all existing static marketing routes (`/`, `/features`, `/pricing`, `/docs`, etc.).
  - Asynchronously fetches published blog posts from backend API (`GET /api/v1/blog/posts` or lightweight sitemap endpoint).
  - Strictly filters by publication criteria: `status == "published"` and `published_at <= now()`.
  - Drafts, future scheduled, archived, and deleted posts are 100% excluded.
  - Emits `lastModified` from `post.updated_at || post.published_at`.
  - If a featured media image is present, includes the safe absolute image URL.
  - Fails safely: In the event of a network or backend glitch, returns static routes cleanly rather than crashing the Next.js application.

## 17. Robots Strategy
- Updated in `apps/web/src/app/robots.ts`:
  - Dynamically points sitemap directive to `${SITE_URL}/sitemap.xml`.
  - Preserves disallow rules: `["/dashboard/", "/admin/", "/api/", "/scan/"]`.
  - Guarantees `/blog` and `/blog/*` remain crawlable.

## 18. Redirect Strategy
- Model: `BlogRedirect` (`blog_redirects` table).
- When an administrator modifies the slug of a post that is currently or previously published:
  1. Inspect `old_slug` and `new_slug`.
  2. Verify `new_slug` is valid, unique, and not colliding with existing articles.
  3. Insert/update redirect record pointing `old_slug` to the target post.
  4. **Collapse chains**: Any historical redirects pointing to `old_slug` are automatically updated to target `new_slug` directly (converting A -> B -> C into A -> C and B -> C).
  5. **Prevent loops**: Cyclic redirects are blocked before insertion.
  6. **Prevent open redirects**: Targets are restricted strictly to internal `/blog/{slug}` routes.
  7. Audit event logged: `BLOG_POST_SLUG_CHANGED`.
- Public routing in `/blog/[slug]`:
  1. Query published article by slug.
  2. If found, render article.
  3. If not found, query redirect record (`GET /api/v1/blog/redirects/{slug}`).
  4. If redirect found and target post is currently published: issue permanent redirect (`308` / `301`) to `/blog/{target_slug}`.
  5. If no redirect or target post is unpublished/draft: invoke `notFound()` (404).

## 19. Redirect Database Model
```python
class BlogRedirect(Base, TimestampMixin):
    __tablename__ = "blog_redirects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    blog_post_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("blog_posts.id", ondelete="CASCADE"), nullable=False)
    old_slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    target_slug: Mapped[str] = mapped_column(String(255), nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, default=301, nullable=False)

    post: Mapped["BlogPost"] = relationship("BlogPost")
```

And for article FAQs:
```python
class BlogPostFAQ(Base, TimestampMixin):
    __tablename__ = "blog_post_faqs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    blog_post_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("blog_posts.id", ondelete="CASCADE"), nullable=False)
    question: Mapped[str] = mapped_column(String(500), nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    post: Mapped["BlogPost"] = relationship("BlogPost", back_populates="faqs")
```
Add `faqs: Mapped[List["BlogPostFAQ"]] = relationship("BlogPostFAQ", back_populates="post", cascade="all, delete-orphan", order_by="BlogPostFAQ.display_order")` to `BlogPost`.

## 20. Security Model
- **JSON-LD XSS Immunization**:
  All structured data payloads are serialized with characters `<` and `>` replaced with unicode escapes (`\\u003c`, `\\u003e`). This ensures payloads like `</script><script>alert(1)</script>` never break out of the `<script type="application/ld+json">` tag.
- **Protocol Sanitization**:
  Canonical, OpenGraph, and Twitter URLs are strictly restricted to `http://` and `https://` schemes. All `javascript:`, `vbscript:`, `data:`, and local file paths are rejected.
- **Draft & Future Post Leakage Immunity**:
  Unpublished content (drafts, scheduled future posts, archived posts) returns 404 and is strictly excluded from sitemaps, dynamic metadata, JSON-LD, and redirect destinations.
- **Open Redirect Neutralization**:
  Redirect targets are strictly bounded to internal blog routes.

## 21. Testing Strategy
- **Backend Tests (`tests/test_cms_phase_e4.py`)**:
  - SEO fields persistence and update.
  - FAQ model CRUD, order, and cascade delete with BlogPost.
  - Slug redirect generation on published post slug update.
  - Redirect chain collapsing (A -> B, B -> C => A -> C, B -> C).
  - Slug collision prevention during redirect creation.
  - Draft slug change does NOT create public redirect.
  - Drafts and future posts return 404 and are excluded from public redirects and sitemap endpoints.
  - Open redirect attempts blocked.
  - Audit logging of `BLOG_POST_SLUG_CHANGED`.
- **Frontend Security & Rendering Tests (`apps/web/scripts/test_seo_security.mjs`)**:
  - Structured data XSS safety (safe serialization of `</script>` tags).
  - Canonical and social image URL sanitization.
  - Fallback title and description resolution.
  - Sitemap filtering logic.
  - Robots configuration.
- **Regressions**:
  - `pytest tests/test_cms_phase_e1.py`
  - `pytest tests/test_cms_phase_e2.py`
  - `pytest tests/test_cms_phase_e3.py`
  - `pytest tests/test_admin_control_center.py`
  - Core security & API test suites.
- **Production Build**:
  - `npm.cmd run build` in `apps/web`.

## 22. Backward Compatibility
- Retains existing `BlogPost` metadata fields (`seo_title`, `meta_description`, `canonical_url`, `og_image`, `featured_image`).
- Articles without explicit SEO fields seamlessly fallback to title and excerpt.
- Articles without FAQs simply omit the `FAQPage` schema.
- Existing routes and media references continue operating without modification.

## 23. Deferred Features
- **Phase E5 (Taxonomy & Discovery)**: Author profiles, author JSON-LD identities, tag pages, public category filtering, public search, related articles engine.
- **Phase E6 (Premium Public Blog UX)**: Public blog redesign, hero article layout, reading time indicator, table of contents.
- **Phase E7 (Conversion & Content Ecosystem)**: Contextual scanner CTAs, newsletter subscription, content analytics.
