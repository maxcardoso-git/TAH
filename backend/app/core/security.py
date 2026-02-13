from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings
from app.core.exceptions import UnauthorizedError

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Generate password hash."""
    return pwd_context.hash(password)


def create_access_token(
    subject: str | UUID,
    tenant_id: str | UUID | None = None,
    roles: list[str] | None = None,
    permissions: list[str] | None = None,
    expires_delta: timedelta | None = None,
    additional_claims: dict[str, Any] | None = None,
) -> str:
    """
    Create a JWT access token.

    Args:
        subject: The subject of the token (usually user_id)
        tenant_id: The tenant context for the token
        roles: List of role names
        permissions: List of permission keys
        expires_delta: Optional custom expiration time
        additional_claims: Additional claims to include in the token

    Returns:
        Encoded JWT token string
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)

    to_encode: dict[str, Any] = {
        "sub": str(subject),
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "access",
    }

    if tenant_id:
        to_encode["tenant_id"] = str(tenant_id)

    if roles:
        to_encode["roles"] = roles

    if permissions:
        to_encode["permissions"] = permissions

    if additional_claims:
        to_encode.update(additional_claims)

    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def create_refresh_token(
    subject: str | UUID,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a JWT refresh token."""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days)

    to_encode = {
        "sub": str(subject),
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "refresh",
    }

    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def create_app_token(
    subject: str | UUID,
    email: str,
    name: str,
    tenant_id: str | UUID,
    org_id: str,
    roles: list[str] | None,
    permissions: list[str] | None,
    audience: str,
    expires_delta: timedelta | None = None,
) -> str:
    """Create an application-scoped JWT used by TAH app launcher callbacks."""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)

    to_encode: dict[str, Any] = {
        "sub": str(subject),
        "email": email,
        "name": name,
        "tenant_id": str(tenant_id),
        "org_id": org_id,
        "roles": roles or [],
        "permissions": permissions or [],
        "aud": audience,
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "app_access",
    }

    issuer = getattr(settings, "jwt_issuer", None)
    if issuer:
        to_encode["iss"] = issuer

    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> dict[str, Any]:
    """
    Decode and validate a JWT token.

    Args:
        token: The JWT token to decode

    Returns:
        Token payload as dictionary

    Raises:
        UnauthorizedError: If token is invalid or expired
    """
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return payload
    except JWTError as e:
        raise UnauthorizedError(detail=f"Invalid token: {str(e)}")


class TokenPayload:
    """Parsed token payload with typed attributes."""

    def __init__(self, payload: dict[str, Any]) -> None:
        self.sub: str = payload.get("sub", "")
        self.tenant_id: str | None = payload.get("tenant_id")
        self.roles: list[str] = payload.get("roles", [])
        self.permissions: list[str] = payload.get("permissions", [])
        self.exp: datetime | None = None
        self.token_type: str = payload.get("type", "access")

        if "exp" in payload:
            self.exp = datetime.fromtimestamp(payload["exp"])

    @property
    def user_id(self) -> str:
        """Alias for subject."""
        return self.sub

    def has_permission(self, permission: str) -> bool:
        """Check if token has a specific permission."""
        return permission in self.permissions

    def has_role(self, role: str) -> bool:
        """Check if token has a specific role."""
        return role in self.roles

    def has_any_permission(self, permissions: list[str]) -> bool:
        """Check if token has any of the specified permissions."""
        return any(p in self.permissions for p in permissions)

    def has_all_permissions(self, permissions: list[str]) -> bool:
        """Check if token has all of the specified permissions."""
        return all(p in self.permissions for p in permissions)
