from fastapi import APIRouter

from app.api.v1 import applications, audit, auth, permissions, roles, tenants, users

api_router = APIRouter()

# Include all route modules
api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["Authentication"],
)

api_router.include_router(
    tenants.router,
    prefix="/tenants",
    tags=["Tenants"],
)

api_router.include_router(
    applications.router,
    prefix="/applications",
    tags=["Applications"],
)

api_router.include_router(
    roles.router,
    prefix="/tenants/{tenant_id}/roles",
    tags=["Roles"],
)

api_router.include_router(
    permissions.router,
    prefix="/tenants/{tenant_id}/roles/{role_id}/permissions",
    tags=["Permissions"],
)

api_router.include_router(
    users.router,
    prefix="/tenants/{tenant_id}/users",
    tags=["Users"],
)

api_router.include_router(
    audit.router,
    prefix="/tenants/{tenant_id}/audit-logs",
    tags=["Audit"],
)
