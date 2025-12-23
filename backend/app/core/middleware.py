import time
from typing import Callable
from uuid import uuid4

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Middleware to add request context (request_id, timing)."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate request ID
        request_id = str(uuid4())
        request.state.request_id = request_id

        # Track request timing
        start_time = time.time()

        # Process request
        response = await call_next(request)

        # Add headers
        process_time = time.time() - start_time
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = str(process_time)

        return response


class TenantContextMiddleware(BaseHTTPMiddleware):
    """Middleware to extract and validate tenant context from JWT."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Tenant context will be extracted by the auth dependency
        # This middleware can be used for additional tenant-level processing

        # Initialize tenant_id in request state
        request.state.tenant_id = None

        response = await call_next(request)
        return response


class CORSHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware to handle CORS headers."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Handle preflight requests
        if request.method == "OPTIONS":
            response = Response()
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = (
                "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            )
            response.headers["Access-Control-Allow-Headers"] = (
                "Authorization, Content-Type, X-Tenant-ID"
            )
            response.headers["Access-Control-Max-Age"] = "600"
            return response

        response = await call_next(request)

        # Add CORS headers to response
        origin = request.headers.get("origin", "")
        if origin in settings.cors_origins or settings.is_development:
            response.headers["Access-Control-Allow-Origin"] = (
                origin if origin else settings.cors_origins[0]
            )
            response.headers["Access-Control-Allow-Credentials"] = "true"

        return response
