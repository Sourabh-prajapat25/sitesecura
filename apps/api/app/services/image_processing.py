"""
SiteSecura - Image Processing & Validation Service
Validates file size, magic bytes, Pillow decoding, dimensions, decompression bombs,
strips sensitive EXIF metadata, and corrects orientation.
"""
import io
import re
import hashlib
from typing import Tuple, Dict, Any
from fastapi import HTTPException, status
from PIL import Image, ImageOps, UnidentifiedImageError
from app.core.config import settings

# Enforce maximum pixel threshold against decompression bombs
Image.MAX_IMAGE_PIXELS = settings.MAX_IMAGE_PIXELS

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_MIME_TYPES = {
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WEBP",
}

# Signatures / Magic bytes
MAGIC_SIGNATURES = [
    (b"\xff\xd8\xff", "image/jpeg", "JPEG"),
    (b"\x89PNG\r\n\x1a\n", "image/png", "PNG"),
]


def validate_magic_bytes(header: bytes) -> Tuple[str, str]:
    """
    Validates binary header against known image magic bytes.
    Returns (mime_type, pillow_format).
    Raises HTTPException 400 on failure.
    """
    # Check JPEG and PNG
    for sig, mime, fmt in MAGIC_SIGNATURES:
        if header.startswith(sig):
            return mime, fmt

    # Check WebP (RIFF....WEBP)
    if len(header) >= 12 and header.startswith(b"RIFF") and header[8:12] == b"WEBP":
        return "image/webp", "WEBP"

    # SVG / XML / HTML active script detection
    lowered = header[:1024].lower()
    if (
        b"<svg" in lowered
        or b"<?xml" in lowered
        or b"<html" in lowered
        or b"<script" in lowered
        or b"<!doctype html" in lowered
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SVG, HTML, and script-bearing vector formats are strictly prohibited for security.",
        )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="The uploaded file signature does not match any allowed image format (JPEG, PNG, WebP).",
    )


def sanitize_filename(filename: str) -> str:
    """
    Sanitizes user-provided filename: removes path components, null bytes,
    and non-standard characters, leaving a clean human-readable original name.
    """
    if not filename:
        return "image.jpg"
    # Remove null bytes and path separators
    name = filename.replace("\0", "").replace("/", " ").replace("\\", " ").strip()
    # Strip any directory traversal
    name = re.sub(r"\.\.+", ".", name)
    # Remove control characters and quotes
    name = re.sub(r'[<>:"/\\|?*]', "", name)
    return name[:120].strip() or "image.jpg"


def process_and_validate_image(
    raw_bytes: bytes,
    original_filename: str,
    declared_content_type: str,
) -> Dict[str, Any]:
    """
    Complete multi-tier image validation & optimization pipeline:
    1. Size limit
    2. SVG / script block
    3. Magic byte signature verification
    4. Pillow integrity validation (verify + re-open)
    5. Dimension & pixel count validation
    6. EXIF orientation correction
    7. Sensitive EXIF stripping (GPS, camera device info)
    8. Optimized re-encoding
    9. SHA256 checksum generation

    Returns dict with:
        processed_bytes: bytes
        width: int
        height: int
        file_size: int
        mime_type: str
        format: str
        checksum: str
        extension: str
    """
    # 1. Size limit check
    if len(raw_bytes) > settings.MAX_IMAGE_SIZE_BYTES:
        max_mb = settings.MAX_IMAGE_SIZE_BYTES / (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"Image exceeds the maximum allowed size of {max_mb:.0f} MB.",
        )

    if len(raw_bytes) < 16:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty or corrupted.",
        )

    # 2. Extension check
    sanitized_name = sanitize_filename(original_filename)
    dot_idx = sanitized_name.rfind(".")
    ext = sanitized_name[dot_idx:].lower() if dot_idx != -1 else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file extension. Allowed extensions: .jpg, .jpeg, .png, .webp.",
        )

    # 3. Magic bytes check
    verified_mime, expected_format = validate_magic_bytes(raw_bytes)

    # 4. Pillow decoding & integrity verification
    try:
        with Image.open(io.BytesIO(raw_bytes)) as test_img:
            test_img.verify()
    except (UnidentifiedImageError, SyntaxError, ValueError, Exception) as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The file could not be parsed as a valid image. The data is malformed or corrupted.",
        )

    # Re-open for actual processing (Pillow design requires reopen after verify)
    try:
        img = Image.open(io.BytesIO(raw_bytes))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to decode image data.",
        )

    actual_format = img.format
    if actual_format != expected_format:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image header format ({actual_format}) does not match detected format ({expected_format}).",
        )

    # 5. Dimensions validation
    width, height = img.size
    if width <= 0 or height <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image dimensions.",
        )

    if width > settings.MAX_IMAGE_DIMENSION or height > settings.MAX_IMAGE_DIMENSION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image dimensions ({width}x{height}) exceed maximum allowed dimension ({settings.MAX_IMAGE_DIMENSION}px).",
        )

    if (width * height) > settings.MAX_IMAGE_PIXELS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image pixel volume exceeds maximum allowed safety threshold.",
        )

    # 6. EXIF orientation correction
    try:
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass

    # Update dimensions after orientation
    width, height = img.size

    # 7 & 8. Strip EXIF and save optimized
    out_buffer = io.BytesIO()
    out_format = actual_format
    out_mime = verified_mime

    if actual_format == "JPEG":
        if img.mode != "RGB":
            img = img.convert("RGB")
        img.save(out_buffer, format="JPEG", quality=85, optimize=True, progressive=True)
        target_ext = ".jpg"
    elif actual_format == "PNG":
        img.save(out_buffer, format="PNG", optimize=True)
        target_ext = ".png"
    elif actual_format == "WEBP":
        img.save(out_buffer, format="WEBP", quality=85, method=4)
        target_ext = ".webp"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported image format for processing.",
        )

    processed_bytes = out_buffer.getvalue()
    checksum = hashlib.sha256(processed_bytes).hexdigest()

    return {
        "processed_bytes": processed_bytes,
        "width": width,
        "height": height,
        "file_size": len(processed_bytes),
        "mime_type": out_mime,
        "format": out_format,
        "checksum": checksum,
        "extension": target_ext,
        "sanitized_filename": sanitized_name,
    }
