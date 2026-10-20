"""
Scanly Scanner Engine - Safe HTTP Client
Enforces DNS rebinding protection, SSRF-validated redirects, streaming response limits, and bounded timeouts.
"""
import socket
import time
from typing import Dict, List, Optional, Tuple, Any
from urllib.parse import urljoin, urlparse
import httpcore
import httpx

from .models import SafeNetworkConfig, SafeResponse
from .safety import validate_url_target, is_safe_ip, SSRFValidationError, ALLOWED_SCHEMES
from .resolver import BaseResolver, SafeResolver


class SafeSyncBackend(httpcore._backends.sync.SyncBackend):
    """
    Custom httpcore network backend that enforces DNS pinning.
    Ensures TCP connection connects strictly to an approved IP resolved by SafeResolver,
    while passing server_hostname to TLS for full SNI and certificate verification.
    """

    def __init__(self, resolver: BaseResolver):
        super().__init__()
        self.resolver = resolver
        self.last_connected_ip: Optional[str] = None

    def connect_tcp(
        self,
        host: str,
        port: int,
        timeout: Optional[float] = None,
        local_address: Optional[str] = None,
        socket_options: Any = None,
    ) -> httpcore.NetworkStream:
        if socket_options is None:
            socket_options = []

        # Resolve host via safe resolver
        approved_ips = self.resolver.resolve(host, port)
        if not approved_ips:
            raise SSRFValidationError(f"No valid public IP addresses found for '{host}'.")

        # Pin to first approved IP
        target_ip = approved_ips[0]
        self.last_connected_ip = target_ip

        exc_map = {
            socket.timeout: httpcore.ConnectTimeout,
            OSError: httpcore.ConnectError,
        }

        source_address = None if local_address is None else (local_address, 0)

        with httpcore._backends.sync.map_exceptions(exc_map):
            sock = socket.create_connection(
                (target_ip, port),
                timeout=timeout,
                source_address=source_address,
            )
            for option in socket_options:
                sock.setsockopt(*option)
            sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)

        return httpcore._backends.sync.SyncStream(sock)


class SafeHttpClient:
    """
    Production-grade safe HTTP client for scanning targets.
    - Pins TCP connections to validated public IPs (DNS rebinding prevention).
    - Preserves TLS SNI and certificate verification.
    - Manually executes redirects, validating every hop against SSRF rules.
    - Enforces strict redirect limits and detects redirect loops.
    - Streams response bodies with physical size caps to prevent unbounded memory growth.
    - Applies granular connection, read, write, and pool timeouts.
    """

    def __init__(
        self,
        config: Optional[SafeNetworkConfig] = None,
        resolver: Optional[BaseResolver] = None,
        transport: Optional[httpx.BaseTransport] = None,
    ):
        self.config = config or SafeNetworkConfig()
        self.resolver = resolver or SafeResolver(timeout=self.config.connect_timeout)
        self._custom_transport = transport
        self._backend = SafeSyncBackend(self.resolver)

    def _build_transport(self) -> httpx.BaseTransport:
        if self._custom_transport is not None:
            return self._custom_transport

        pool = httpcore.ConnectionPool(
            network_backend=self._backend,
            max_connections=10,
            max_keepalive_connections=0,  # Do not keep connections alive across scans
        )
        transport = httpx.HTTPTransport()
        transport._pool = pool
        return transport

    def get(
        self,
        url: str,
        max_redirects: Optional[int] = None,
        max_response_bytes: Optional[int] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> SafeResponse:
        """Executes a safe GET request with SSRF redirect validation and bounded streaming."""
        return self.request(
            method="GET",
            url=url,
            max_redirects=max_redirects,
            max_response_bytes=max_response_bytes,
            headers=headers,
        )

    def options(
        self,
        url: str,
        max_redirects: Optional[int] = None,
        max_response_bytes: Optional[int] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> SafeResponse:
        """Executes a safe OPTIONS request with SSRF redirect validation and bounded streaming."""
        return self.request(
            method="OPTIONS",
            url=url,
            max_redirects=max_redirects,
            max_response_bytes=max_response_bytes,
            headers=headers,
        )

    def head(
        self,
        url: str,
        max_redirects: Optional[int] = None,
        max_response_bytes: Optional[int] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> SafeResponse:
        """Executes a safe HEAD request with SSRF redirect validation and bounded streaming."""
        return self.request(
            method="HEAD",
            url=url,
            max_redirects=max_redirects,
            max_response_bytes=max_response_bytes,
            headers=headers,
        )

    def request(
        self,
        method: str,
        url: str,
        max_redirects: Optional[int] = None,
        max_response_bytes: Optional[int] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> SafeResponse:
        """
        Executes outbound HTTP request with comprehensive safety controls.
        """
        req_headers = {"User-Agent": self.config.user_agent}
        if headers:
            req_headers.update(headers)

        limit_redirects = max_redirects if max_redirects is not None else self.config.max_redirects
        limit_bytes = max_response_bytes if max_response_bytes is not None else self.config.max_response_bytes

        timeout_config = httpx.Timeout(
            connect=self.config.connect_timeout,
            read=self.config.read_timeout,
            write=self.config.write_timeout,
            pool=self.config.pool_timeout,
        )

        redirect_chain: List[str] = [url]
        current_url = url
        redirect_count = 0
        t0 = time.time()

        # Pre-validate initial target URL
        scheme, host, port = validate_url_target(current_url)
        # Pre-resolve to catch SSRF before connecting
        approved_ips = self.resolver.resolve(host, port)
        resolved_ip = approved_ips[0] if approved_ips else None

        transport = self._build_transport()

        with httpx.Client(
            transport=transport,
            timeout=timeout_config,
            follow_redirects=False,
            headers=req_headers,
        ) as client:
            while True:
                # Validate current URL before request
                scheme, host, port = validate_url_target(current_url)

                try:
                    req = client.build_request(method, current_url)
                    resp = client._send_single_request(req)
                except httpx.TimeoutException as exc:
                    duration_ms = int((time.time() - t0) * 1000)
                    return SafeResponse(
                        url=url,
                        final_url=current_url,
                        redirect_chain=redirect_chain,
                        elapsed_ms=duration_ms,
                        resolved_ip=resolved_ip,
                        error=f"Target did not respond within the scanner timeout: {str(exc)}",
                    )
                except (httpx.InvalidURL, SSRFValidationError) as exc:
                    duration_ms = int((time.time() - t0) * 1000)
                    raise SSRFValidationError(f"Invalid or prohibited URL target: {str(exc)}")
                except Exception as exc:
                    duration_ms = int((time.time() - t0) * 1000)
                    return SafeResponse(
                        url=url,
                        final_url=current_url,
                        redirect_chain=redirect_chain,
                        elapsed_ms=duration_ms,
                        resolved_ip=resolved_ip,
                        error=f"Connection failure: {str(exc)}",
                    )

                # Check if response is a redirect
                if resp.status_code in (301, 302, 303, 307, 308):
                    location = resp.headers.get("location")
                    resp.close()

                    if not location:
                        # Redirect without Location header; stop
                        break

                    redirect_count += 1
                    if redirect_count > limit_redirects:
                        duration_ms = int((time.time() - t0) * 1000)
                        return SafeResponse(
                            status_code=None,
                            url=url,
                            final_url=current_url,
                            redirect_chain=redirect_chain,
                            elapsed_ms=duration_ms,
                            resolved_ip=resolved_ip,
                            error="Maximum redirect limit reached.",
                        )

                    # Safely join relative redirect
                    next_url = urljoin(current_url, location)

                    # Check for redirect loop
                    if next_url in redirect_chain:
                        redirect_chain.append(next_url)
                        duration_ms = int((time.time() - t0) * 1000)
                        return SafeResponse(
                            status_code=None,
                            url=url,
                            final_url=next_url,
                            redirect_chain=redirect_chain,
                            elapsed_ms=duration_ms,
                            resolved_ip=resolved_ip,
                            error="Redirect loop detected.",
                        )

                    # Validate new redirect target scheme & hostname
                    try:
                        next_scheme, next_host, next_port = validate_url_target(next_url)
                    except SSRFValidationError as e:
                        duration_ms = int((time.time() - t0) * 1000)
                        raise SSRFValidationError(
                            f"Redirect to unsafe target '{next_url}': {str(e)}"
                        )

                    # Validate new target DNS against SSRF
                    try:
                        next_approved_ips = self.resolver.resolve(next_host, next_port)
                        resolved_ip = next_approved_ips[0] if next_approved_ips else None
                    except SSRFValidationError as e:
                        duration_ms = int((time.time() - t0) * 1000)
                        raise SSRFValidationError(
                            f"Redirect target '{next_host}' resolved to restricted network address: {str(e)}"
                        )

                    current_url = next_url
                    redirect_chain.append(current_url)
                    continue

                # Final destination reached - read response body with bounded streaming
                try:
                    content_length_hdr = resp.headers.get("content-length")
                    is_oversized = False
                    if content_length_hdr and content_length_hdr.isdigit():
                        if int(content_length_hdr) > limit_bytes:
                            is_oversized = True

                    # Stream body up to limit_bytes
                    body_chunks = []
                    bytes_read = 0
                    is_truncated = is_oversized

                    for chunk in resp.iter_bytes(chunk_size=8192):
                        remaining = limit_bytes - bytes_read
                        if remaining <= 0:
                            is_truncated = True
                            break
                        if len(chunk) > remaining:
                            body_chunks.append(chunk[:remaining])
                            bytes_read += remaining
                            is_truncated = True
                            break
                        else:
                            body_chunks.append(chunk)
                            bytes_read += len(chunk)

                    raw_body = b"".join(body_chunks)
                    text = raw_body.decode("utf-8", errors="replace")

                    # Extract all Set-Cookie headers
                    set_cookie_headers = resp.headers.get_list("set-cookie")

                    # Extract cookies dictionary
                    cookies_dict = {c.name: c.value for c in resp.cookies.jar}

                    # Headers dictionary
                    headers_dict = dict(resp.headers)
                    raw_headers_list = list(resp.headers.raw)
                    # Convert byte tuples to str tuples
                    str_raw_headers = [
                        (k.decode("latin-1", errors="ignore"), v.decode("latin-1", errors="ignore"))
                        for k, v in raw_headers_list
                    ]

                    duration_ms = int((time.time() - t0) * 1000)
                    connected_ip = self._backend.last_connected_ip or resolved_ip

                    return SafeResponse(
                        status_code=resp.status_code,
                        url=url,
                        final_url=current_url,
                        headers=headers_dict,
                        raw_headers=str_raw_headers,
                        cookies=cookies_dict,
                        set_cookie_headers=set_cookie_headers,
                        text=text,
                        bytes_read=bytes_read,
                        is_truncated=is_truncated,
                        redirect_chain=redirect_chain,
                        elapsed_ms=duration_ms,
                        resolved_ip=connected_ip,
                        error=None,
                    )
                finally:
                    resp.close()
