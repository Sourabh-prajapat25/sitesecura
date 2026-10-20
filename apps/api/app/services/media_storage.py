"""
SiteSecura - Media Storage Service
Handles persistent filesystem storage of media assets with strict path traversal defenses.
"""
import os
import logging
from pathlib import Path
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


class MediaStorage:
    def __init__(self, root_dir: Optional[str] = None):
        self.root_dir = os.path.abspath(root_dir or settings.MEDIA_ROOT)
        os.makedirs(self.root_dir, exist_ok=True)

    def _safe_resolve(self, relative_path: str) -> str:
        """
        Safely resolves a relative storage key against MEDIA_ROOT.
        Raises ValueError if path attempts to escape the root directory via traversal.
        """
        if not relative_path:
            raise ValueError("Empty media path.")

        # Clean null bytes and separators
        clean_rel = relative_path.replace("\0", "").replace("\\", "/").strip("/")
        parts = Path(clean_rel).parts
        if any(part in ("..", ".", "") for part in parts):
            raise ValueError(f"Path traversal detected in media key: {relative_path}")

        target_path = os.path.abspath(os.path.join(self.root_dir, clean_rel))
        
        # Verify target is strictly within root_dir
        if not target_path.startswith(self.root_dir):
            raise ValueError(f"Path traversal attempt beyond media root: {relative_path}")

        return target_path

    def save(self, file_bytes: bytes, storage_key: str) -> str:
        """
        Saves binary image data to disk under the specified storage key.
        Creates parent directories as needed.
        """
        target_path = self._safe_resolve(storage_key)
        os.makedirs(os.path.dirname(target_path), exist_ok=True)

        with open(target_path, "wb") as f:
            f.write(file_bytes)

        logger.info(f"Saved media asset: {storage_key} ({len(file_bytes)} bytes)")
        return target_path

    def delete(self, storage_key: str) -> bool:
        """
        Safely removes a file from disk.
        Returns True if deleted, False if file did not exist.
        """
        try:
            target_path = self._safe_resolve(storage_key)
            if os.path.isfile(target_path):
                os.remove(target_path)
                logger.info(f"Deleted media asset from disk: {storage_key}")
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to delete media file {storage_key}: {e}")
            return False

    def exists(self, storage_key: str) -> bool:
        """Checks if a media file exists on disk."""
        try:
            target_path = self._safe_resolve(storage_key)
            return os.path.isfile(target_path)
        except Exception:
            return False

    def get_path(self, storage_key: str) -> Optional[str]:
        """Returns the safe absolute path if the file exists, otherwise None."""
        try:
            target_path = self._safe_resolve(storage_key)
            if os.path.isfile(target_path):
                return target_path
            return None
        except Exception:
            return None


# Global singleton instance
media_storage = MediaStorage()
