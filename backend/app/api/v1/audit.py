from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DbSession, get_token_payload
from app.core.security import TokenPayload
from app.models.audit_log import AuditAction, AuditLog
from app.schemas.audit import AuditLogFilter, AuditLogRead
from app.schemas.common import PaginatedResponse

router = APIRouter()


@router.get("", response_model=PaginatedResponse[AuditLogRead])
async def list_audit_logs(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    tenant_id: UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    action: AuditAction | None = Query(default=None),
    entity_type: str | None = Query(default=None),
    entity_id: str | None = Query(default=None),
    actor_user_id: UUID | None = Query(default=None),
    start_date: datetime | None = Query(default=None),
    end_date: datetime | None = Query(default=None),
):
    """
    List audit logs for a tenant with filtering.
    Supports filtering by action, entity, actor, and date range.
    """
    query = select(AuditLog).where(AuditLog.tenant_id == tenant_id)

    # Apply filters
    if action:
        query = query.where(AuditLog.action == action)

    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)

    if entity_id:
        query = query.where(AuditLog.entity_id == entity_id)

    if actor_user_id:
        query = query.where(AuditLog.actor_user_id == actor_user_id)

    if start_date:
        query = query.where(AuditLog.created_at >= start_date)

    if end_date:
        query = query.where(AuditLog.created_at <= end_date)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0

    # Apply pagination and ordering
    query = query.order_by(AuditLog.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    logs = result.scalars().all()

    # Convert to response
    items = [AuditLogRead.model_validate(log) for log in logs]

    return PaginatedResponse.create(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{entity_type}/{entity_id}", response_model=list[AuditLogRead])
async def get_entity_audit_history(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    tenant_id: UUID,
    entity_type: str,
    entity_id: str,
    limit: int = Query(default=100, ge=1, le=500),
):
    """
    Get audit history for a specific entity.
    Useful for viewing the complete history of changes to a role, user, etc.
    """
    query = (
        select(AuditLog)
        .where(
            AuditLog.tenant_id == tenant_id,
            AuditLog.entity_type == entity_type,
            AuditLog.entity_id == entity_id,
        )
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )

    result = await db.execute(query)
    logs = result.scalars().all()

    return [AuditLogRead.model_validate(log) for log in logs]
