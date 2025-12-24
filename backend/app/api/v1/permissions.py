from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUserId, DbSession, get_token_payload
from app.core.exceptions import BadRequestError, ForbiddenError, NotFoundError
from app.core.security import TokenPayload
from app.models.app_feature import AppFeature
from app.models.application import Application, TenantApplication
from app.models.external_permission import ExternalPermission
from app.models.role import Role, RolePermission
from app.schemas.app_feature import (
    ApplicationFeatures,
    FeatureAction,
    FeaturePermissionBatchUpdate,
    FeaturePermissionMatrixRead,
    FeatureWithActions,
    ModuleFeatures,
)
from app.schemas.permission import (
    ApplicationPermissions,
    ModulePermissions,
    PermissionMatrixRead,
    RolePermissionBatchUpdate,
    RolePermissionCreate,
    RolePermissionRead,
)

router = APIRouter()


@router.get("", response_model=list[RolePermissionRead])
async def list_role_permissions(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    tenant_id: UUID,
    role_id: UUID,
    application_id: str | None = None,
):
    """List all permissions granted to a role."""
    # Verify role exists and belongs to tenant
    role = await db.get(Role, role_id)
    if not role or role.deleted_at or role.tenant_id != tenant_id:
        raise NotFoundError(detail=f"Role {role_id} not found")

    query = select(RolePermission).where(RolePermission.role_id == role_id)

    if application_id:
        query = query.where(RolePermission.application_id == application_id)

    query = query.order_by(RolePermission.application_id, RolePermission.permission_key)

    result = await db.execute(query)
    permissions = result.scalars().all()

    return [RolePermissionRead.model_validate(p) for p in permissions]


@router.get("/matrix", response_model=PermissionMatrixRead)
async def get_permission_matrix(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    tenant_id: UUID,
    role_id: UUID,
):
    """
    Get the full permission matrix for a role.
    Returns all available permissions grouped by application and module,
    with indication of which are granted to this role.
    """
    # Verify role exists and belongs to tenant
    role = await db.get(Role, role_id)
    if not role or role.deleted_at or role.tenant_id != tenant_id:
        raise NotFoundError(detail=f"Role {role_id} not found")

    # Get enabled applications for this tenant
    tenant_apps_query = select(TenantApplication).where(
        TenantApplication.tenant_id == tenant_id
    )
    tenant_apps_result = await db.execute(tenant_apps_query)
    tenant_apps = tenant_apps_result.scalars().all()
    enabled_app_ids = [ta.application_id for ta in tenant_apps]

    # Get all applications
    apps_query = select(Application).where(Application.id.in_(enabled_app_ids))
    apps_result = await db.execute(apps_query)
    applications = {app.id: app for app in apps_result.scalars().all()}

    # Get all external permissions for enabled apps
    perms_query = select(ExternalPermission).where(
        ExternalPermission.application_id.in_(enabled_app_ids)
    ).order_by(
        ExternalPermission.application_id,
        ExternalPermission.module_key,
        ExternalPermission.permission_key,
    )
    perms_result = await db.execute(perms_query)
    all_permissions = perms_result.scalars().all()

    # Get granted permissions for this role
    granted_query = select(RolePermission.permission_key).where(
        RolePermission.role_id == role_id
    )
    granted_result = await db.execute(granted_query)
    granted_keys = set(granted_result.scalars().all())

    # Build matrix structure
    app_permissions: dict[str, dict[str, list]] = {}

    for perm in all_permissions:
        if perm.application_id not in app_permissions:
            app_permissions[perm.application_id] = {}

        if perm.module_key not in app_permissions[perm.application_id]:
            app_permissions[perm.application_id][perm.module_key] = []

        from app.schemas.permission import ExternalPermissionRead

        perm_read = ExternalPermissionRead.model_validate(perm)
        perm_read.is_new = False  # TODO: check if recently discovered
        app_permissions[perm.application_id][perm.module_key].append(perm_read)

    # Convert to response structure
    app_list = []
    for app_id, modules in app_permissions.items():
        app = applications.get(app_id)
        if not app:
            continue

        module_list = []
        for module_key, permissions in modules.items():
            module_name = permissions[0].module_name if permissions else module_key
            module_list.append(
                ModulePermissions(
                    module_key=module_key,
                    module_name=module_name,
                    permissions=permissions,
                )
            )

        app_list.append(
            ApplicationPermissions(
                application_id=app_id,
                application_name=app.name,
                modules=module_list,
            )
        )

    return PermissionMatrixRead(
        role_id=role_id,
        role_name=role.name,
        tenant_id=tenant_id,
        applications=app_list,
        granted_permissions=list(granted_keys),
    )


@router.get("/feature-matrix", response_model=FeaturePermissionMatrixRead)
async def get_feature_permission_matrix(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    tenant_id: UUID,
    role_id: UUID,
):
    """
    Get the feature-based permission matrix for a role.
    Returns all available features grouped by application and module,
    with actions expanded as individual permission checkboxes.
    Permission key format: feature_id:action (e.g., "orchestrator.projects:read")
    """
    # Verify role exists and belongs to tenant
    role = await db.get(Role, role_id)
    if not role or role.deleted_at or role.tenant_id != tenant_id:
        raise NotFoundError(detail=f"Role {role_id} not found")

    # Get enabled applications for this tenant
    tenant_apps_query = select(TenantApplication).where(
        TenantApplication.tenant_id == tenant_id
    )
    tenant_apps_result = await db.execute(tenant_apps_query)
    tenant_apps = tenant_apps_result.scalars().all()
    enabled_app_ids = [ta.application_id for ta in tenant_apps]

    # Get all applications
    apps_query = select(Application).where(Application.id.in_(enabled_app_ids))
    apps_result = await db.execute(apps_query)
    applications = {app.id: app for app in apps_result.scalars().all()}

    # Get all app features for enabled apps
    features_query = (
        select(AppFeature)
        .where(
            AppFeature.application_id.in_(enabled_app_ids),
            AppFeature.is_active == True,
        )
        .order_by(
            AppFeature.application_id,
            AppFeature.module,
            AppFeature.display_order,
            AppFeature.name,
        )
    )
    features_result = await db.execute(features_query)
    all_features = features_result.scalars().all()

    # Get granted permissions for this role (format: feature_id:action)
    granted_query = select(RolePermission.permission_key).where(
        RolePermission.role_id == role_id
    )
    granted_result = await db.execute(granted_query)
    granted_keys = set(granted_result.scalars().all())

    # Build matrix structure grouped by app > module > feature
    app_features: dict[str, dict[str, list]] = {}

    for feature in all_features:
        if feature.application_id not in app_features:
            app_features[feature.application_id] = {}

        if feature.module not in app_features[feature.application_id]:
            app_features[feature.application_id][feature.module] = []

        # Create FeatureWithActions with expanded actions
        feature_actions = []
        for action in feature.actions:
            permission_key = f"{feature.id}:{action}"
            feature_actions.append(
                FeatureAction(
                    action=action,
                    permission_key=permission_key,
                    granted=permission_key in granted_keys,
                )
            )

        feature_with_actions = FeatureWithActions(
            id=feature.id,
            name=feature.name,
            description=feature.description,
            path=feature.path,
            icon=feature.icon,
            is_public=feature.is_public,
            requires_org=feature.requires_org,
            lifecycle=feature.lifecycle,
            actions=feature_actions,
        )
        app_features[feature.application_id][feature.module].append(feature_with_actions)

    # Convert to response structure
    app_list = []
    for app_id, modules in app_features.items():
        app = applications.get(app_id)
        if not app:
            continue

        module_list = []
        for module_key, features in modules.items():
            # Get module_name from first feature
            module_name = module_key
            if features and hasattr(features[0], "module_name"):
                # Get from the original feature object
                for f in all_features:
                    if f.module == module_key and f.module_name:
                        module_name = f.module_name
                        break

            module_list.append(
                ModuleFeatures(
                    module_key=module_key,
                    module_name=module_name,
                    features=features,
                )
            )

        app_list.append(
            ApplicationFeatures(
                application_id=app_id,
                application_name=app.name,
                modules=module_list,
            )
        )

    return FeaturePermissionMatrixRead(
        role_id=role_id,
        role_name=role.name,
        tenant_id=tenant_id,
        applications=app_list,
        granted_permissions=list(granted_keys),
    )


@router.put("/features", response_model=list[RolePermissionRead])
async def update_feature_permissions(
    db: DbSession,
    token: Annotated[TokenPayload, Depends(get_token_payload)],
    tenant_id: UUID,
    role_id: UUID,
    data: FeaturePermissionBatchUpdate,
):
    """
    Batch update role permissions using feature-action format.
    Permission keys should be in format: feature_id:action
    """
    # Verify role exists and belongs to tenant
    role = await db.get(Role, role_id)
    if not role or role.deleted_at or role.tenant_id != tenant_id:
        raise NotFoundError(detail=f"Role {role_id} not found")

    # Cannot modify system roles
    if role.is_system:
        raise ForbiddenError(detail="Cannot modify permissions of system roles")

    user_id = UUID(token.user_id) if token.user_id else None

    # Process revokes first
    for perm_key in data.revoke:
        # Parse feature_id:action format
        if ":" not in perm_key:
            raise BadRequestError(
                detail=f"Invalid permission key format: {perm_key}. Expected 'feature_id:action'"
            )
        feature_id, action = perm_key.rsplit(":", 1)

        # Get application_id from feature
        feature = await db.get(AppFeature, feature_id)
        if feature:
            await db.execute(
                delete(RolePermission).where(
                    RolePermission.role_id == role_id,
                    RolePermission.application_id == feature.application_id,
                    RolePermission.permission_key == perm_key,
                )
            )

    # Process grants
    for perm_key in data.grant:
        # Parse feature_id:action format
        if ":" not in perm_key:
            raise BadRequestError(
                detail=f"Invalid permission key format: {perm_key}. Expected 'feature_id:action'"
            )
        feature_id, action = perm_key.rsplit(":", 1)

        # Verify feature exists and action is valid
        feature = await db.get(AppFeature, feature_id)
        if not feature:
            raise BadRequestError(detail=f"Feature '{feature_id}' not found")

        if action not in feature.actions:
            raise BadRequestError(
                detail=f"Action '{action}' not valid for feature '{feature_id}'. Valid actions: {feature.actions}"
            )

        # Check if already granted
        existing = await db.scalar(
            select(RolePermission).where(
                RolePermission.role_id == role_id,
                RolePermission.application_id == feature.application_id,
                RolePermission.permission_key == perm_key,
            )
        )

        if not existing:
            new_perm = RolePermission(
                tenant_id=tenant_id,
                role_id=role_id,
                application_id=feature.application_id,
                permission_key=perm_key,
                granted_by=user_id,
            )
            db.add(new_perm)

    await db.flush()

    # Return updated list
    query = select(RolePermission).where(RolePermission.role_id == role_id)
    result = await db.execute(query)
    permissions = result.scalars().all()

    return [RolePermissionRead.model_validate(p) for p in permissions]


@router.put("", response_model=list[RolePermissionRead])
async def update_role_permissions(
    db: DbSession,
    token: Annotated[TokenPayload, Depends(get_token_payload)],
    tenant_id: UUID,
    role_id: UUID,
    data: RolePermissionBatchUpdate,
):
    """
    Batch update role permissions.
    Grants and revokes permissions in a single transaction.
    """
    # Verify role exists and belongs to tenant
    role = await db.get(Role, role_id)
    if not role or role.deleted_at or role.tenant_id != tenant_id:
        raise NotFoundError(detail=f"Role {role_id} not found")

    # Cannot modify system roles
    if role.is_system:
        raise ForbiddenError(detail="Cannot modify permissions of system roles")

    # Process revokes first
    for perm in data.revoke:
        await db.execute(
            delete(RolePermission).where(
                RolePermission.role_id == role_id,
                RolePermission.application_id == perm.application_id,
                RolePermission.permission_key == perm.permission_key,
            )
        )

    # Process grants
    user_id = UUID(token.user_id) if token.user_id else None

    for perm in data.grant:
        # Check if permission exists in external_permissions
        exists = await db.scalar(
            select(ExternalPermission).where(
                ExternalPermission.application_id == perm.application_id,
                ExternalPermission.permission_key == perm.permission_key,
            )
        )
        if not exists:
            raise BadRequestError(
                detail=f"Permission '{perm.permission_key}' not found for app '{perm.application_id}'"
            )

        # Check if already granted
        existing = await db.scalar(
            select(RolePermission).where(
                RolePermission.role_id == role_id,
                RolePermission.application_id == perm.application_id,
                RolePermission.permission_key == perm.permission_key,
            )
        )

        if not existing:
            new_perm = RolePermission(
                tenant_id=tenant_id,
                role_id=role_id,
                application_id=perm.application_id,
                permission_key=perm.permission_key,
                granted_by=user_id,
            )
            db.add(new_perm)

    await db.flush()

    # Return updated list
    query = select(RolePermission).where(RolePermission.role_id == role_id)
    result = await db.execute(query)
    permissions = result.scalars().all()

    return [RolePermissionRead.model_validate(p) for p in permissions]


@router.post("/batch", response_model=list[RolePermissionRead])
async def batch_grant_permissions(
    db: DbSession,
    token: Annotated[TokenPayload, Depends(get_token_payload)],
    tenant_id: UUID,
    role_id: UUID,
    permissions: list[RolePermissionCreate],
):
    """Grant multiple permissions to a role."""
    data = RolePermissionBatchUpdate(grant=permissions, revoke=[])
    return await update_role_permissions(db, token, tenant_id, role_id, data)


@router.delete("/{permission_key}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_permission(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    tenant_id: UUID,
    role_id: UUID,
    permission_key: str,
    application_id: str,
):
    """Revoke a single permission from a role."""
    # Verify role exists and belongs to tenant
    role = await db.get(Role, role_id)
    if not role or role.deleted_at or role.tenant_id != tenant_id:
        raise NotFoundError(detail=f"Role {role_id} not found")

    # Cannot modify system roles
    if role.is_system:
        raise ForbiddenError(detail="Cannot modify permissions of system roles")

    # Delete the permission
    result = await db.execute(
        delete(RolePermission).where(
            RolePermission.role_id == role_id,
            RolePermission.application_id == application_id,
            RolePermission.permission_key == permission_key,
        )
    )

    if result.rowcount == 0:
        raise NotFoundError(detail=f"Permission '{permission_key}' not found for role")

    await db.flush()
