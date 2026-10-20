"""
Scanly API - Slug Normalization & Validation Utility
"""
import re
from typing import Optional


def normalize_slug(text: Optional[str]) -> str:
    """
    Normalizes arbitrary text into a URL-safe slug:
    - Converts to lowercase
    - Replaces non-alphanumeric characters with hyphens
    - Collapses multiple consecutive hyphens into a single hyphen
    - Strips leading and trailing hyphens
    - Trims whitespace
    """
    if not text:
        return ""
    slug = text.strip().lower()
    # Replace non-alphanumeric chars with hyphens
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    # Collapse multiple consecutive hyphens
    slug = re.sub(r"-+", "-", slug)
    # Strip leading and trailing hyphens
    slug = slug.strip("-")
    return slug


def is_valid_slug(slug: Optional[str]) -> bool:
    """
    Validates whether a slug contains only lowercase alphanumeric characters and single hyphens,
    does not start or end with a hyphen, and is between 1 and 255 characters long.
    """
    if not slug or len(slug) > 255:
        return False
    return bool(re.match(r"^[a-z0-9]+(?:-[a-z0-9]+)*$", slug))
