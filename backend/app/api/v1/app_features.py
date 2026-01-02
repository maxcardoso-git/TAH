import re
from datetime import datetime, timezone
from typing import Annotated, Any

import httpx
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DbSession, get_token_payload
from app.core.exceptions import BadRequestError, ConflictError, NotFoundError
from app.core.security import TokenPayload
from app.models.app_feature import AppFeature, FeatureLifecycle
from app.models.application import Application
from app.models.external_permission import PermissionSyncRun
from app.schemas.app_feature import (
    AppSyncResult,
    BulkDeleteRequest,
    BulkDeleteResponse,
    BulkSyncRequest,
    BulkSyncResponse,
    AppFeatureCreate,
    AppFeatureRead,
    AppFeatureUpdate,
    AppFeaturesManifest,
    FeatureSyncRequest,
    FeatureSyncResponse,
    FeatureSyncSummary,
)

router = APIRouter()


def _camel_to_snake(name: str) -> str:
    """Convert camelCase to snake_case."""
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()


def _convert_keys_to_snake_case(data: Any) -> Any:
    """Recursively convert all dictionary keys from camelCase to snake_case."""
    if isinstance(data, dict):
        return {_camel_to_snake(k): _convert_keys_to_snake_case(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [_convert_keys_to_snake_case(item) for item in data]
    return data


@router.get("", response_model=list[AppFeatureRead])
async def list_app_features(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    application_id: str,
    module: str | None = Query(default=None),
    active_only: bool = Query(default=True),
):
    """List all features for an application."""
    application = await db.get(Application, application_id)
    if not application:
        raise NotFoundError(detail=f"Application '{application_id}' not found")

    query = select(AppFeature).where(AppFeature.application_id == application_id)

    if module:
        query = query.where(AppFeature.module == module)

    if active_only:
        query = query.where(AppFeature.is_active == True)

    query = query.order_by(AppFeature.module, AppFeature.display_order, AppFeature.name)

    result = await db.execute(query)
    features = result.scalars().all()

    items = []
    for feature in features:
        # Count children
        children_count = await db.scalar(
            select(AppFeature).where(AppFeature.parent_id == feature.id)
        )

        item = AppFeatureRead(
            id=feature.id,
            application_id=feature.application_id,
            name=feature.name,
            description=feature.description,
            module=feature.module,
            module_name=feature.module_name,
            subcategory=feature.subcategory,
            parent_id=feature.parent_id,
            path=feature.path,
            icon=feature.icon,
            actions=feature.actions,
            display_order=feature.display_order,
            is_active=feature.is_active,
            is_public=feature.is_public,
            requires_org=feature.requires_org,
            lifecycle=feature.lifecycle,
            first_seen_version=feature.first_seen_version,
            last_seen_version=feature.last_seen_version,
            discovered_at=feature.discovered_at,
            last_seen_at=feature.last_seen_at,
            permission_keys=feature.get_permission_keys(),
            children_count=1 if children_count else 0,
        )
        items.append(item)

    return items


@router.get("/{feature_id}", response_model=AppFeatureRead)
async def get_app_feature(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    application_id: str,
    feature_id: str,
):
    """Get a specific feature by ID."""
    feature = await db.get(AppFeature, feature_id)

    if not feature or feature.application_id != application_id:
        raise NotFoundError(detail=f"Feature '{feature_id}' not found")

    # Count children
    children_count = await db.scalar(
        select(AppFeature).where(AppFeature.parent_id == feature.id)
    )

    return AppFeatureRead(
        id=feature.id,
        application_id=feature.application_id,
        name=feature.name,
        description=feature.description,
        module=feature.module,
        module_name=feature.module_name,
        subcategory=feature.subcategory,
        parent_id=feature.parent_id,
        path=feature.path,
        icon=feature.icon,
        actions=feature.actions,
        display_order=feature.display_order,
        is_active=feature.is_active,
        is_public=feature.is_public,
        requires_org=feature.requires_org,
        lifecycle=feature.lifecycle,
        first_seen_version=feature.first_seen_version,
        last_seen_version=feature.last_seen_version,
        discovered_at=feature.discovered_at,
        last_seen_at=feature.last_seen_at,
        permission_keys=feature.get_permission_keys(),
        children_count=1 if children_count else 0,
    )


@router.post("", response_model=AppFeatureRead, status_code=status.HTTP_201_CREATED)
async def create_app_feature(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    application_id: str,
    data: AppFeatureCreate,
):
    """Manually create a feature (for apps without manifest endpoint)."""
    application = await db.get(Application, application_id)
    if not application:
        raise NotFoundError(detail=f"Application '{application_id}' not found")

    # Validate feature ID format
    if not data.id.startswith(f"{application_id}."):
        raise BadRequestError(
            detail=f"Feature ID must start with '{application_id}.'"
        )

    # Check for existing
    existing = await db.get(AppFeature, data.id)
    if existing:
        raise ConflictError(detail=f"Feature '{data.id}' already exists")

    feature = AppFeature(
        id=data.id,
        application_id=application_id,
        name=data.name,
        description=data.description,
        module=data.module,
        module_name=data.module_name,
        subcategory=data.subcategory,
        parent_id=data.parent_id,
        path=data.path,
        icon=data.icon,
        actions=data.actions,
        display_order=data.display_order,
        is_public=data.is_public,
        requires_org=data.requires_org,
        is_active=True,
        lifecycle=FeatureLifecycle.ACTIVE.value,
    )
    db.add(feature)
    await db.flush()
    await db.refresh(feature)

    return AppFeatureRead(
        id=feature.id,
        application_id=feature.application_id,
        name=feature.name,
        description=feature.description,
        module=feature.module,
        module_name=feature.module_name,
        subcategory=feature.subcategory,
        parent_id=feature.parent_id,
        path=feature.path,
        icon=feature.icon,
        actions=feature.actions,
        display_order=feature.display_order,
        is_active=feature.is_active,
        is_public=feature.is_public,
        requires_org=feature.requires_org,
        lifecycle=feature.lifecycle,
        first_seen_version=feature.first_seen_version,
        last_seen_version=feature.last_seen_version,
        discovered_at=feature.discovered_at,
        last_seen_at=feature.last_seen_at,
        permission_keys=feature.get_permission_keys(),
        children_count=0,
    )


@router.patch("/{feature_id}", response_model=AppFeatureRead)
async def update_app_feature(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    application_id: str,
    feature_id: str,
    data: AppFeatureUpdate,
):
    """Update a feature."""
    feature = await db.get(AppFeature, feature_id)

    if not feature or feature.application_id != application_id:
        raise NotFoundError(detail=f"Feature '{feature_id}' not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(feature, field, value)

    await db.flush()
    await db.refresh(feature)

    # Count children
    children_count = await db.scalar(
        select(AppFeature).where(AppFeature.parent_id == feature.id)
    )

    return AppFeatureRead(
        id=feature.id,
        application_id=feature.application_id,
        name=feature.name,
        description=feature.description,
        module=feature.module,
        module_name=feature.module_name,
        subcategory=feature.subcategory,
        parent_id=feature.parent_id,
        path=feature.path,
        icon=feature.icon,
        actions=feature.actions,
        display_order=feature.display_order,
        is_active=feature.is_active,
        is_public=feature.is_public,
        requires_org=feature.requires_org,
        lifecycle=feature.lifecycle,
        first_seen_version=feature.first_seen_version,
        last_seen_version=feature.last_seen_version,
        discovered_at=feature.discovered_at,
        last_seen_at=feature.last_seen_at,
        permission_keys=feature.get_permission_keys(),
        children_count=1 if children_count else 0,
    )


@router.delete("/{feature_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_app_feature(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    application_id: str,
    feature_id: str,
):
    """Delete a feature."""
    feature = await db.get(AppFeature, feature_id)

    if not feature or feature.application_id != application_id:
        raise NotFoundError(detail=f"Feature '{feature_id}' not found")

    await db.delete(feature)
    await db.flush()


@router.post("/sync", response_model=FeatureSyncResponse)
async def sync_app_features(
    db: DbSession,
    token: Annotated[TokenPayload, Depends(get_token_payload)],
    application_id: str,
    request: FeatureSyncRequest | None = None,
):
    """
    Sync features from the application's manifest endpoint.
    Calls GET {app.base_url}/api/v1/app-features/manifest
    """
    application = await db.get(Application, application_id)
    if not application:
        raise NotFoundError(detail=f"Application '{application_id}' not found")

    # Create sync run record
    user_id = token.user_id if token.user_id else None
    sync_run = PermissionSyncRun(
        application_id=application_id,
        run_type="feature_sync",
        requested_by=user_id,
        status="in_progress",
        summary={},
        started_at=datetime.now(timezone.utc),
    )
    db.add(sync_run)
    await db.flush()

    try:
        # Fetch manifest from application
        # Use custom URL if configured, otherwise default to standard path
        if application.features_manifest_url:
            manifest_url = application.features_manifest_url
        else:
            # Remove trailing slash from base_url if present
            base = application.base_url.rstrip("/")
            manifest_url = f"{base}/api/v1/app-features/manifest"

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(manifest_url)
            response.raise_for_status()
            manifest_data = response.json()

        # Handle wrapped responses (e.g., {"success": true, "data": {...}})
        if isinstance(manifest_data, dict) and "data" in manifest_data:
            manifest_data = manifest_data["data"]

        # Convert camelCase keys to snake_case
        manifest_data = _convert_keys_to_snake_case(manifest_data)

        manifest = AppFeaturesManifest(**manifest_data)

        # Process features
        summary = await _process_manifest(db, application, manifest)

        # Update sync run
        sync_run.status = "success"
        sync_run.app_version = manifest.version
        sync_run.summary = summary.model_dump()
        sync_run.finished_at = datetime.now(timezone.utc)

        # Update application version
        application.current_version = manifest.version

        await db.flush()

        return FeatureSyncResponse(
            status="success",
            app_version=manifest.version,
            summary=summary,
        )

    except httpx.HTTPError as e:
        sync_run.status = "error"
        sync_run.error_message = str(e)
        sync_run.finished_at = datetime.now(timezone.utc)
        await db.flush()

        return FeatureSyncResponse(
            status="error",
            error_message=f"Failed to fetch manifest: {str(e)}",
            summary=FeatureSyncSummary(),
        )
    except Exception as e:
        sync_run.status = "error"
        sync_run.error_message = str(e)
        sync_run.finished_at = datetime.now(timezone.utc)
        await db.flush()

        return FeatureSyncResponse(
            status="error",
            error_message=f"Error processing manifest: {str(e)}",
            summary=FeatureSyncSummary(),
        )


async def _process_manifest(
    db: AsyncSession,
    application: Application,
    manifest: AppFeaturesManifest,
) -> FeatureSyncSummary:
    """Process manifest and sync features."""
    summary = FeatureSyncSummary()

    # Build module name lookup from manifest
    module_names = {m.id: m.name for m in manifest.modules}

    # Get existing features
    result = await db.execute(
        select(AppFeature).where(AppFeature.application_id == application.id)
    )
    existing_features = {f.id: f for f in result.scalars().all()}
    seen_ids = set()

    # Process each feature from manifest
    for mf in manifest.features:
        seen_ids.add(mf.id)

        if mf.id in existing_features:
            # Update existing feature
            feature = existing_features[mf.id]
            feature.name = mf.name
            feature.description = mf.description
            feature.module = mf.module
            feature.module_name = module_names.get(mf.module)
            feature.subcategory = mf.subcategory
            feature.parent_id = mf.parent_id
            feature.path = mf.path
            feature.icon = mf.icon
            feature.actions = mf.actions
            feature.display_order = mf.display_order
            feature.is_public = mf.is_public
            feature.requires_org = mf.requires_org
            feature.last_seen_version = manifest.version
            feature.last_seen_at = datetime.now(timezone.utc)
            feature.lifecycle = FeatureLifecycle.ACTIVE.value
            feature.is_active = True
            summary.updated += 1
        else:
            # Create new feature
            feature = AppFeature(
                id=mf.id,
                application_id=application.id,
                name=mf.name,
                description=mf.description,
                module=mf.module,
                module_name=module_names.get(mf.module),
                subcategory=mf.subcategory,
                parent_id=mf.parent_id,
                path=mf.path,
                icon=mf.icon,
                actions=mf.actions,
                display_order=mf.display_order,
                is_public=mf.is_public,
                requires_org=mf.requires_org,
                is_active=True,
                lifecycle=FeatureLifecycle.ACTIVE.value,
                first_seen_version=manifest.version,
                last_seen_version=manifest.version,
            )
            db.add(feature)
            summary.added += 1

    # Mark features not in manifest as deprecated
    for feature_id, feature in existing_features.items():
        if feature_id not in seen_ids:
            if feature.lifecycle == FeatureLifecycle.ACTIVE.value:
                feature.lifecycle = FeatureLifecycle.DEPRECATED.value
                summary.deprecated += 1

    return summary


@router.post("/bulk-sync", response_model=BulkSyncResponse)
async def bulk_sync_app_features(
    db: DbSession,
    token: Annotated[TokenPayload, Depends(get_token_payload)],
    application_id: str,
    request: BulkSyncRequest,
):
    """
    Sync features from multiple applications at once.
    If application_ids is empty, syncs all active applications.
    """
    from app.models.application import AppStatus
    
    # Get applications to sync
    if request.application_ids:
        query = select(Application).where(Application.id.in_(request.application_ids))
    else:
        query = select(Application).where(Application.status == AppStatus.ACTIVE)
    
    result = await db.execute(query)
    applications = result.scalars().all()
    
    results: list[AppSyncResult] = []
    successful = 0
    failed = 0
    skipped = 0
    
    for app in applications:
        try:
            # Check if app has manifest URL
            if not app.features_manifest_url and not app.base_url:
                results.append(AppSyncResult(
                    application_id=app.id,
                    application_name=app.name,
                    status="skipped",
                    error_message="No manifest URL or base URL configured"
                ))
                skipped += 1
                continue
            
            # Fetch manifest
            if app.features_manifest_url:
                manifest_url = app.features_manifest_url
            else:
                base = app.base_url.rstrip("/")
                manifest_url = f"{base}/api/v1/app-features/manifest"
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(manifest_url)
                response.raise_for_status()
                manifest_data = response.json()
            
            # Handle wrapped responses
            if isinstance(manifest_data, dict) and "data" in manifest_data:
                manifest_data = manifest_data["data"]
            
            # Convert camelCase to snake_case
            manifest_data = _convert_keys_to_snake_case(manifest_data)
            
            manifest = AppFeaturesManifest(**manifest_data)
            
            # Process features
            summary = await _process_manifest(db, app, manifest)
            
            # Update application version
            app.current_version = manifest.version
            
            results.append(AppSyncResult(
                application_id=app.id,
                application_name=app.name,
                status="success",
                app_version=manifest.version,
                summary=summary
            ))
            successful += 1
            
        except httpx.HTTPError as e:
            results.append(AppSyncResult(
                application_id=app.id,
                application_name=app.name,
                status="error",
                error_message=f"HTTP error: {str(e)}"
            ))
            failed += 1
        except Exception as e:
            results.append(AppSyncResult(
                application_id=app.id,
                application_name=app.name,
                status="error",
                error_message=str(e)
            ))
            failed += 1
    
    await db.flush()
    
    return BulkSyncResponse(
        total_apps=len(applications),
        successful=successful,
        failed=failed,
        skipped=skipped,
        results=results
    )


@router.delete("/bulk", response_model=BulkDeleteResponse)
async def bulk_delete_app_features(
    db: DbSession,
    _: Annotated[TokenPayload, Depends(get_token_payload)],
    application_id: str,
    request: BulkDeleteRequest,
):
    """
    Delete multiple features at once.
    Only deletes features that belong to the specified application.
    """
    
    deleted = 0
    not_found = 0
    errors: list[str] = []
    
    for feature_id in request.feature_ids:
        try:
            feature = await db.get(AppFeature, feature_id)
            
            if not feature:
                not_found += 1
                errors.append(f"Feature '{feature_id}' not found")
                continue
            
            if feature.application_id != application_id:
                errors.append(f"Feature '{feature_id}' belongs to different application")
                continue
            
            await db.delete(feature)
            deleted += 1
            
        except Exception as e:
            errors.append(f"Error deleting '{feature_id}': {str(e)}")
    
    await db.flush()
    
    return BulkDeleteResponse(
        total_requested=len(request.feature_ids),
        deleted=deleted,
        not_found=not_found,
        errors=errors
    )
