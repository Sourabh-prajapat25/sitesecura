"""
Scanly Scanner Engine - Phase F7 Public Document & Export Exposure Analyzer
Audits public document links (PDF, CSV, SQL, LOG) for metadata leakage, data exports, and database dumps.
Guarantees: Strict bounded requests (max 5), 512 KB response streaming limit; zero raw file storage.
"""
import re
from typing import List, Dict, Any, Tuple, Set, Optional
from urllib.parse import urlparse

from scanner.models import Finding, Severity, CheckStatus
from .models import CrawledPage
from .data_classification import (
    DataCategory,
    Confidence,
    mask_token,
)
from .data_security_finding_helper import make_data_finding
from scanner.network.http_client import SafeHttpClient

# Document extensions of interest
DOC_EXTENSIONS = {".pdf", ".docx", ".doc", ".xlsx", ".xls", ".csv", ".tsv", ".sql", ".log"}

# PDF Metadata patterns in binary/ASCII text stream
PDF_INFO_REGEX = re.compile(rb"/(Author|Creator|Producer|Title|CreationDate)\s*\((.*?)\)", re.DOTALL)
INTERNAL_PATH_REGEX = re.compile(r"(?:[a-zA-Z]:\\(?:Users|Documents and Settings|home|var|tmp|opt)\\[^\r\n<>\"']+)|(?:/(?:home|Users|var|tmp|opt)/[^\r\n<>\"']+)")

# SQL Dump indicators
SQL_DUMP_REGEX = re.compile(r"(?i)(CREATE\s+TABLE\s+[`\"']?[a-zA-Z0-9_]+[`\"']?|INSERT\s+INTO\s+[`\"']?[a-zA-Z0-9_]+[`\"']?\s+VALUES)")

# Log file indicators
LOG_FILE_REGEX = re.compile(r"(?i)(\[\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\]|(?:INFO|DEBUG|WARN|ERROR|FATAL)\s+\[[a-zA-Z0-9_.]+\])")


def _extract_pdf_metadata(content_bytes: bytes) -> Dict[str, str]:
    """Passively parses standard PDF Info dictionary tags from raw byte stream."""
    meta: Dict[str, str] = {}
    for match in PDF_INFO_REGEX.finditer(content_bytes[:32768]):
        tag = match.group(1).decode("ascii", errors="ignore")
        raw_val = match.group(2).decode("latin-1", errors="ignore").strip()
        if raw_val and len(raw_val) < 200:
            meta[tag] = raw_val
    return meta


def analyze_documents(
    crawled_pages: List[CrawledPage],
    client: Optional[SafeHttpClient] = None,
    can_request_fn: Optional[Any] = None,
    max_probes: int = 5,
    max_doc_bytes: int = 524_288,
) -> Tuple[Dict[str, Any], List[Finding], int]:
    """
    Passively audits discovered document links and performs bounded verification
    for internal metadata, public data exports, database dumps, and exposed log files.
    """
    findings: List[Finding] = []
    requests_executed = 0

    discovered_doc_links: List[str] = []
    for page in crawled_pages:
        for link in getattr(page, "discovered_links", [])[:50]:
            try:
                parsed = urlparse(link)
                path_lower = parsed.path.lower()
                for ext in DOC_EXTENSIONS:
                    if path_lower.endswith(ext):
                        if link not in discovered_doc_links:
                            discovered_doc_links.append(link)
                        break
            except Exception:
                continue

    probes_to_run: List[str] = list(discovered_doc_links)
    # If no document links discovered from crawling, probe standard backup paths
    if not probes_to_run:
        first_url = crawled_pages[0].url if crawled_pages else ""
        if first_url:
            try:
                parsed_root = urlparse(first_url)
                base_origin = f"{parsed_root.scheme}://{parsed_root.netloc}"
                for probe_path in ("/backup.sql", "/dump.sql", "/database.sql", "/users.csv", "/export.csv"):
                    full_probe = f"{base_origin}{probe_path}"
                    if full_probe not in probes_to_run:
                        probes_to_run.append(full_probe)
            except Exception:
                pass

    analyzed_documents: List[Dict[str, Any]] = []
    internal_metadata_docs: List[Dict[str, Any]] = []
    data_exports: List[Dict[str, Any]] = []
    db_dumps: List[Dict[str, Any]] = []
    log_files: List[Dict[str, Any]] = []

    probes_done = 0
    if client and probes_to_run:
        for doc_url in probes_to_run:
            if probes_done >= max_probes:
                break
            if can_request_fn and not can_request_fn():
                break

            probes_done += 1
            requests_executed += 1

            try:
                resp = client.get(doc_url, max_redirects=2, max_response_bytes=max_doc_bytes)
                if not resp or resp.status_code != 200:
                    continue

                content_text = resp.text or ""
                content_bytes = content_text.encode("utf-8", errors="ignore")
                parsed = urlparse(doc_url)
                path_lower = parsed.path.lower()

                doc_entry: Dict[str, Any] = {
                    "url": doc_url,
                    "status_code": resp.status_code,
                    "content_length": len(content_text),
                }

                # 1. PDF Analysis
                if path_lower.endswith(".pdf"):
                    pdf_meta = _extract_pdf_metadata(content_bytes)
                    doc_entry["pdf_metadata"] = pdf_meta

                    # Internal path check
                    internal_paths = INTERNAL_PATH_REGEX.findall(content_text[:32768])
                    if internal_paths:
                        doc_entry["internal_paths"] = internal_paths[:3]
                        internal_metadata_docs.append({
                            "url": doc_url,
                            "type": "PDF Internal Path Leak",
                            "evidence": internal_paths[0],
                        })
                    elif "Author" in pdf_meta:
                        internal_metadata_docs.append({
                            "url": doc_url,
                            "type": "PDF Author Metadata",
                            "evidence": f"Author: {pdf_meta['Author']}",
                        })

                # 2. CSV / Data Export Analysis
                elif path_lower.endswith((".csv", ".tsv", ".xlsx", ".xls")):
                    first_lines = "\n".join(content_text.splitlines()[:5]).lower()
                    if any(k in first_lines for k in ("email", "phone", "password", "customer", "user_id", "salary", "order")):
                        data_exports.append({
                            "url": doc_url,
                            "sample": first_lines[:150],
                        })

                # 3. SQL Database Dump Analysis
                elif path_lower.endswith((".sql", ".dump")) or SQL_DUMP_REGEX.search(content_text[:4096]):
                    db_dumps.append({
                        "url": doc_url,
                        "sample": content_text[:120].strip(),
                    })

                # 4. Log File Analysis
                elif path_lower.endswith(".log") or LOG_FILE_REGEX.search(content_text[:2048]):
                    log_files.append({
                        "url": doc_url,
                        "sample": content_text[:120].strip(),
                    })

                analyzed_documents.append(doc_entry)

            except Exception:
                pass

    exposed_files = (db_dumps + data_exports + log_files)[:5]
    document_telemetry = {
        "candidate_urls_count": len(probes_to_run),
        "analyzed_documents_count": len(analyzed_documents),
        "analyzed_documents": analyzed_documents[:5],
        "documents": analyzed_documents[:5],
        "internal_metadata_count": len(internal_metadata_docs),
        "documents_with_internal_metadata_count": len(internal_metadata_docs),
        "internal_metadata": internal_metadata_docs[:5],
        "data_exports_count": len(data_exports),
        "data_exports": data_exports[:5],
        "database_dumps_count": len(db_dumps),
        "database_dumps": db_dumps[:5],
        "log_files_count": len(log_files),
        "log_files": log_files[:5],
        "exposed_data_files_count": len(db_dumps) + len(data_exports) + len(log_files),
        "exposed_files": exposed_files,
    }

    # Findings Generation
    if db_dumps:
        findings.append(make_data_finding(
            check_type="deep_public_database_data",
            title="Public Database Dump File Discovered",
            description=(
                "A public SQL database dump file was discovered accessible over HTTP. "
                "Database dump files routinely disclose schema architecture, table structures, and sensitive records."
            ),
            severity=Severity.CRITICAL,
            status=CheckStatus.CRITICAL,
            evidence=f"Exposed database dump: {db_dumps[0]['url']}",
            how_to_fix="Immediately delete database backup dumps from web server root directories and revoke any compromised credentials.",
            data_category=DataCategory.CONFIDENTIAL,
        ))

    if data_exports:
        findings.append(make_data_finding(
            check_type="deep_public_data_export",
            title="Public Data Export (CSV/Spreadsheet) Discovered",
            description=(
                "A publicly accessible spreadsheet or CSV data export file containing user or customer records "
                f"was discovered at {data_exports[0]['url']}."
            ),
            severity=Severity.HIGH,
            status=CheckStatus.HIGH,
            evidence=f"File: {data_exports[0]['url']} with headers: '{data_exports[0]['sample'][:80]}'",
            how_to_fix="Ensure all report and data export files are stored in access-controlled storage buckets requiring user authentication.",
            data_category=DataCategory.PERSONAL,
        ))

    if log_files:
        findings.append(make_data_finding(
            check_type="deep_public_log_data",
            title="Public Application Log File Accessible",
            description=(
                f"An unauthenticated application log file ({log_files[0]['url']}) is publicly readable. "
                "Log files commonly disclose system stack traces, customer IDs, and runtime execution errors."
            ),
            severity=Severity.HIGH,
            status=CheckStatus.HIGH,
            evidence=f"Log URL: {log_files[0]['url']}",
            how_to_fix="Configure web server rules to deny HTTP access to files with .log extensions.",
            data_category=DataCategory.INTERNAL,
        ))

    if internal_metadata_docs:
        sample = internal_metadata_docs[0]
        findings.append(make_data_finding(
            check_type="deep_document_internal_metadata",
            title="Internal Paths or Author Metadata Exposed in Public Documents",
            description=(
                "Public PDF documents contain embedded metadata such as local filesystem paths or author "
                "usernames, assisting attackers in reconnaissance."
            ),
            severity=Severity.LOW,
            status=CheckStatus.WARNING,
            evidence=f"Document {sample['url']} discloses: {sample['evidence']}",
            how_to_fix="Sanitize document metadata and strip author and creator properties prior to public publication.",
            data_category=DataCategory.INTERNAL,
        ))

    return document_telemetry, findings, requests_executed


# Functional alias for orchestrator and tests
analyze_documents_and_exports = analyze_documents
