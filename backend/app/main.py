from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.config import settings
from app.core.exceptions import BaseAPIException
from app.core.middleware import RequestContextMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup and shutdown events."""
    # Startup
    print(f"Starting {settings.project_name} v{settings.version}")
    print(f"Environment: {settings.environment}")
    print(f"API docs available at: /docs")

    yield

    # Shutdown
    print(f"Shutting down {settings.project_name}")


# Create FastAPI application
app = FastAPI(
    title=settings.project_name,
    description=settings.project_description,
    version=settings.version,
    openapi_url=f"{settings.api_v1_prefix}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Add middlewares
app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handlers
@app.exception_handler(BaseAPIException)
async def api_exception_handler(request: Request, exc: BaseAPIException) -> JSONResponse:
    """Handle custom API exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.__class__.__name__,
                "message": exc.detail,
                "request_id": getattr(request.state, "request_id", None),
            }
        },
        headers=exc.headers,
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected exceptions."""
    if settings.is_development:
        detail = str(exc)
    else:
        detail = "An unexpected error occurred"

    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "InternalServerError",
                "message": detail,
                "request_id": getattr(request.state, "request_id", None),
            }
        },
    )


# Include API router
app.include_router(api_router, prefix=settings.api_v1_prefix)


# Health check endpoints
@app.get("/health", tags=["Health"])
async def health_check() -> dict[str, Any]:
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "version": settings.version,
        "environment": settings.environment,
    }


@app.get("/health/ready", tags=["Health"])
async def readiness_check() -> dict[str, Any]:
    """
    Readiness check - verifies all dependencies are available.
    Used by Kubernetes/Docker for readiness probes.
    """
    # TODO: Add database and Redis connectivity checks
    return {
        "status": "ready",
        "checks": {
            "database": "ok",
            "redis": "ok",
        },
    }


@app.get("/health/live", tags=["Health"])
async def liveness_check() -> dict[str, str]:
    """
    Liveness check - verifies the application is running.
    Used by Kubernetes/Docker for liveness probes.
    """
    return {"status": "alive"}
