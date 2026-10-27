# SiteSecura — Phase E3 Implementation Plan
**Phase E3: Media & Article Content (Media Library, Secure Uploads, Image Validation, Storage Architecture, Featured Images, Inline Markdown Images, Alt Text, and Media Management)**

---

## 1. Existing Media & Storage Architecture
- Currently, SiteSecura uses local disk storage for PDF reports (`./storage/reports` defined via `Settings.STORAGE_PATH`).
- No dedicated media storage or media asset database table existed prior to Phase E3.
- Articles in Phase E1 and E2 stored content as canonical Markdown in `BlogPost.content` and an optional string URL in `BlogPost.featured_image`.

## 2. Existing BlogPost Fields
Inspected from `apps/api/app/models/cms.py`:
- `id`: UUID (Primary Key)
- `title`: String(255)
- `slug`: String(255), unique, indexed
- `excerpt`: Text
- `content`: Text (canonical Markdown source)
- `category_id`: UUID, foreign key to `blog_categories.id`
- `featured_image`: String(500), nullable (legacy URL string)
- `seo_title`: String(255), nullable
- `meta_description`: String(500), nullable
- `canonical_url`: String(500), nullable
- `og_image`: String(500), nullable
- `status`: String(50) — "draft" | "published" | "scheduled" | "archived"
- `published_at`: DateTime(timezone=True), nullable
- `created_by`: UUID, foreign key to `users.id`
- `created_at`, `updated_at`: DateTime(timezone=True) via `TimestampMixin`

## 3. Existing E2 Editor Architecture
Inspected from `apps/web/src/app/admin/blog/page.tsx`:
- Desktop 2-column split pane: Left pane holds the Markdown Source textarea; Right pane holds the real-time Live Preview with `MarkdownRenderer`.
- Mobile responsive toggle: `[ Write ]` and `[ Preview ]` tabs for viewports `< 1024px`.
- Formatting toolbar: Action buttons for H2, H3, Bold, Italic, Strikethrough, Bulleted Lists, Numbered Lists, Blockquotes, Inline Code, Code Blocks, Links, GFM Tables, and Horizontal Rules.
- Preserves cursor position and selection wrapping.

## 4. Proposed Media Data Model (`media_assets`)
We define `MediaAsset` in `apps/api/app/models/cms.py`:
- `id`: UUID (PK, default `uuid.uuid4`)
- `filename`: String(255) — stored filename on disk (e.g., `<uuid>.webp`)
- `original_filename`: String(255) — sanitized client-provided filename
- `storage_key`: String(500), unique, indexed — relative storage path (e.g., `blog/2026/09/<uuid>.webp`)
- `public_url`: String(500) — resolved serving URL (e.g., `/api/v1/media/blog/2026/09/<uuid>.webp`)
- `mime_type`: String(100) — verified MIME type (`image/webp`, `image/jpeg`, `image/png`)
- `file_size`: Integer — file size in bytes
- `width`: Integer — actual pixel width
- `height`: Integer — actual pixel height
- `alt_text`: String(500), nullable — accessibility description
- `caption`: Text, nullable — editorial contextual caption
- `checksum`: String(64), nullable, indexed — SHA256 hex digest for integrity and deduplication tracking
- `created_by`: UUID, foreign key to `users.id`, nullable (SET NULL on delete)
- `created_at`, `updated_at`: DateTime(timezone=True)

In `BlogPost`:
- Add column `featured_media_id`: UUID, foreign key to `media_assets.id` (ondelete="SET NULL"), nullable
- Relationship: `featured_media = relationship("MediaAsset", foreign_keys=[featured_media_id])`
- Retain existing `featured_image` column for backward compatibility with existing data and external URLs.

## 5. Upload Security Architecture
Never trust client headers or extensions. Upload validation enforces a multi-tier defense:
1. **Server-Side Authentication & Authorization**: Only users with platform admin role (`require_admin`) can upload.
2. **File Size Limit**: Reject files exceeding 5 MB (`5 * 1024 * 1024` bytes) with clean HTTP 413. Checked before and during stream read.
3. **Extension Whitelist**: Allowed: `.jpg`, `.jpeg`, `.png`, `.webp`. Strictly reject `.svg`, `.html`, `.htm`, `.js`, `.exe`, `.pdf`, `.zip`, etc.
4. **Declared MIME Whitelist**: Allowed: `image/jpeg`, `image/png`, `image/webp`.
5. **Magic Byte / Signature Inspection**:
   - JPEG: starts with `FF D8 FF`
   - PNG: starts with `89 50 4E 47 0D 0A 1A 0A`
   - WebP: starts with `RIFF....WEBP`
6. **Decoded Image Structure Validation via Pillow**:
   - Image stream is parsed with `PIL.Image.open()`.
   - `image.verify()` validates integrity.
   - Re-open image and inspect `format` (`JPEG`, `PNG`, `WEBP`), `size` (width, height), and mode.
   - Reject corrupt or malformed files with HTTP 400.
7. **Decompression Bomb Protection**:
   - Set `Image.MAX_IMAGE_PIXELS = 16_000_000` (16 Megapixels).
   - Reject images where width > 4096, height > 4096, or width * height > 16,000,000 pixels.
8. **Filename Sanitization & Path Traversal Prevention**:
   - The stored filename is generated using a secure UUID4 (`uuid.uuid4().hex + ".webp"`).
   - The client-provided filename is strictly sanitized (stripping directory separators, null bytes, special characters) and stored only as metadata `original_filename`.
   - Uploaded files are written strictly inside `MEDIA_ROOT`.

## 6. Storage Architecture
- Abstraction: `MediaStorage` in `apps/api/app/services/media_storage.py` handling `save()`, `delete()`, `exists()`, `get_absolute_path()`.
- Directory structure: `storage/media/blog/{YYYY}/{MM}/{uuid}.{ext}`.
- Configurable via `Settings`:
  - `MEDIA_ROOT`: default `./storage/media`
  - `MEDIA_PUBLIC_URL_PREFIX`: default `/api/v1/media`
- Controlled Media Serving:
  - Endpoint `GET /api/v1/media/{path:path}`
  - Resolves path strictly relative to `MEDIA_ROOT`. Verifies resolved path starts with `MEDIA_ROOT` (preventing `../` directory traversal).
  - Verifies file exists on disk.
  - Serves with strict response headers:
    - `Content-Type`: verified image MIME
    - `Content-Disposition: inline`
    - `X-Content-Type-Options: nosniff`
    - `Cache-Control: public, max-age=31536000, immutable`

## 7. API Design
### Admin Media Management (Requires `require_admin`):
- `POST /api/v1/admin/blog/media`: Multipart upload (`file`, optional `alt_text`, optional `caption`). Returns 201 with `MediaAssetResponse`.
- `GET /api/v1/admin/blog/media`: Lists media with pagination (`page`, `page_size`) and optional search filter (`search`). Returns 200 with `MediaAssetListResponse`.
- `GET /api/v1/admin/blog/media/{media_id}`: Returns 200 with `MediaAssetResponse`.
- `PATCH /api/v1/admin/blog/media/{media_id}`: Updates `alt_text` and/or `caption`. Returns 200 with `MediaAssetResponse`.
- `DELETE /api/v1/admin/blog/media/{media_id}`: Checks if media is referenced as `featured_media_id` in `blog_posts` or referenced by storage key in `BlogPost.content`. If referenced, returns HTTP 409 Conflict. If unreferenced, deletes file from disk and deletes DB record. Returns 200 with `{ "detail": "Media asset deleted successfully." }`.

### Public Media Serving:
- `GET /api/v1/media/{path:path}`: Controlled public streaming of stored images.

## 8. Admin Media Library Design
- Integrated Tab in `/admin/blog`: Alongside "Articles" and "Categories", add a "Media Library" tab.
- Media Grid: Responsive grid displaying uploaded image cards with preview thumbnails, dimensions, file size, upload date.
- Search Input: Real-time search by filename.
- Upload Button & Dialog: Drag-and-drop or click-to-upload with client-side format/size hint.
- Media Details & Edit Drawer/Modal: Shows full image preview, dimensions, file size, MIME type, upload timestamp, editable Alt Text and Caption with Save action, and Delete button with confirmation.

## 9. Featured Image Architecture
- Admin article editor includes a dedicated "Featured Image" block:
  - If set: displays current preview, dimensions/info, `[Change Image]` and `[Remove]` buttons.
  - If unset: displays clean empty state with `[Select from Media Library]` and `[Upload Image]` buttons.
- On selection: Sets `featured_media_id` on the post and pre-fills `featured_image` with the asset's `public_url`.
- Public rendering: In `/blog` (card thumbnail) and `/blog/[slug]` (header banner), renders `post.featured_media?.public_url || post.featured_image`.

## 10. Inline Image Architecture
- Markdown is the canonical content format in `BlogPost.content`.
- Toolbar in `MarkdownEditorField` gets an `[Image]` button.
- Clicking `[Image]` opens the Media Picker dialog.
- Admin selects an existing image or uploads a new one, reviews/customizes Alt Text and optional Caption, and clicks `[Insert Image]`.
- Inserts standard Markdown at cursor:
  ```markdown
  ![Security Headers Dashboard](/api/v1/media/blog/2026/09/abcdef.webp)
  *Figure: Content Security Policy configuration view*
  ```
- Textarea cursor position and undo stack are preserved.

## 11. Alt Text Architecture
- Alt text is stored in `media_assets.alt_text`.
- Editable when managing media and pre-filled when inserting inline images.
- Rendered in `<img alt="...">` attributes on both public articles and preview panes.
- Plain text only; no HTML tags.

## 12. Image Rendering Architecture
- In `apps/web/src/components/MarkdownRenderer.tsx`:
  - `img` component uses `isSafeUrl(src)`.
  - Blocks `javascript:`, `vbscript:`, `data:` URLs.
  - Resolves `/api/v1/media/...` paths cleanly against API base when necessary.
  - Renders responsive styling: `rounded-xl border border-slate-200 shadow-sm max-w-full h-auto`.
  - Lazy loading: `loading="lazy"`.
  - No `dangerouslySetInnerHTML`.

## 13. Optimization Strategy
- Using Pillow in `apps/api/app/services/image_processing.py`:
  - EXIF orientation transposition (`PIL.ImageOps.exif_transpose`) so mobile camera photos render right-side up.
  - Strip all EXIF metadata (GPS location, camera serials, timestamps) before saving.
  - Save as optimized WebP or JPEG with quality 85.
  - Reduces file size by 30-70% while maintaining sharp visual quality.

## 14. Migration Requirements
- Migration file: `apps/api/alembic/versions/007_add_media_assets.py`.
- Parent revision: `006_blog_posts_publishing_index`.
- Creates `media_assets` table with indexes on `storage_key` and `checksum`.
- Adds `featured_media_id` column to `blog_posts` with foreign key referencing `media_assets.id` (ON DELETE SET NULL).
- Fully non-destructive and downgrade-safe.

## 15. Test Strategy
1. **Frontend Test Suite** (`apps/web/scripts/test_media_security.mjs`):
   - Markdown image URL protocol sanitization (`javascript:`, `vbscript:`, `data:` blocked).
   - Safe rendering of relative media URLs (`/api/v1/media/...`).
   - Image attribute safety (no raw HTML injection).
2. **Backend Test Suite** (`tests/test_cms_phase_e3.py`):
   - Admin upload of valid JPEG, PNG, WebP (201).
   - Non-admin upload blocked (403), unauthenticated upload blocked (401).
   - MIME spoofing blocked (declared image/jpeg, but binary is script/HTML).
   - Magic bytes validation (reject fake headers).
   - SVG upload rejected (400).
   - Executable, PDF, ZIP uploads rejected (400).
   - Oversized file (>5MB) rejected (413).
   - Extreme dimensions (>4096px or >16MP) rejected (400).
   - Path traversal in filename and media serving endpoint blocked (400/404).
   - Media list, pagination, and filename search.
   - Media update (alt text, caption).
   - Safe deletion: unused deleted successfully; referenced media returns 409 Conflict.
   - Featured media relationship attached to BlogPost.
   - Backward compatibility: legacy `featured_image` URL still renders.
   - Audit logging for `BLOG_MEDIA_UPLOADED`, `BLOG_MEDIA_UPDATED`, `BLOG_MEDIA_DELETED`.
3. **Regression Tests**:
   - `pytest tests/test_cms_phase_e1.py` (22 tests)
   - `pytest tests/test_cms_phase_e2.py` (8 tests)
   - `pytest tests/test_admin_control_center.py` (16 tests)
   - `pytest tests/test_api_endpoints.py tests/test_auth_audit_transaction.py tests/test_phase_b_security.py` (39 tests)
4. **Build Verification**:
   - `npm.cmd run build` in `apps/web`.

## 16. Backward Compatibility Strategy
- `BlogPost.featured_image` column is retained.
- Existing articles with string URLs continue to display without breakage.
- If `post.featured_media` is present, it is prioritized; otherwise `post.featured_image` is used.
- Existing Markdown syntax without images continues to render identically.

## 17. Deferred Features
- **Phase E4 (SEO Engine)**: OpenGraph image tags, Twitter/X cards, JSON-LD ImageObject schemas, dynamic sitemap image entries.
- **Phase E5 (Taxonomy & Discovery)**: Media tags, media categories, author avatars.
- **Phase E6 (Premium Public Blog UX)**: Lightbox zoom modal, image carousels, hero article layouts.
- **Phase E7 (Conversion & Content Ecosystem)**: Contextual scanner CTAs inside image figures.
