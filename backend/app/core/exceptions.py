from typing import Any


class BaseAPIException(Exception):
    """Base exception for all API errors."""

    status_code: int = 500
    detail: str = "Internal server error"
    headers: dict[str, str] | None = None

    def __init__(
        self,
        detail: str | None = None,
        headers: dict[str, str] | None = None,
        **kwargs: Any,
    ) -> None:
        self.detail = detail or self.detail
        self.headers = headers or self.headers
        self.extra = kwargs
        super().__init__(self.detail)


class BadRequestError(BaseAPIException):
    """400 Bad Request - Invalid input or request."""

    status_code = 400
    detail = "Bad request"


class UnauthorizedError(BaseAPIException):
    """401 Unauthorized - Authentication required."""

    status_code = 401
    detail = "Not authenticated"
    headers = {"WWW-Authenticate": "Bearer"}


class ForbiddenError(BaseAPIException):
    """403 Forbidden - Insufficient permissions."""

    status_code = 403
    detail = "Permission denied"


class NotFoundError(BaseAPIException):
    """404 Not Found - Resource not found."""

    status_code = 404
    detail = "Resource not found"


class ConflictError(BaseAPIException):
    """409 Conflict - Resource already exists or state conflict."""

    status_code = 409
    detail = "Resource conflict"


class UnprocessableEntityError(BaseAPIException):
    """422 Unprocessable Entity - Validation error."""

    status_code = 422
    detail = "Validation error"


class TooManyRequestsError(BaseAPIException):
    """429 Too Many Requests - Rate limit exceeded."""

    status_code = 429
    detail = "Too many requests"
    headers = {"Retry-After": "60"}


class InternalServerError(BaseAPIException):
    """500 Internal Server Error."""

    status_code = 500
    detail = "Internal server error"


class ServiceUnavailableError(BaseAPIException):
    """503 Service Unavailable - External service unavailable."""

    status_code = 503
    detail = "Service temporarily unavailable"
