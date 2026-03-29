from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.core.security import get_current_user, require_role
from app.models.registry import MODEL_REGISTRY, get_model_metadata, get_all_models, ModelStatus
from app.models.verification import get_verification_service, ModelVerificationService

router = APIRouter()


class ModelStatusResponse(BaseModel):
    model_key: str
    model_name: str
    display_name: str
    model_type: str
    status: str
    status_display: str
    expected_size_mb: float
    file_size_bytes: int
    expected_size_bytes: int
    size_valid: bool
    checksum_valid: bool
    description: str
    tags: List[str]
    min_vram_gb: float
    recommended_vram_gb: float
    verified_at: Optional[str] = None
    error_message: Optional[str] = None

    @classmethod
    def from_verification(cls, model_key: str, model_meta, verification_result, status: ModelStatus):
        status_messages = {
            ModelStatus.NOT_DOWNLOADED: "Not Downloaded",
            ModelStatus.DOWNLOADING: "Downloading...",
            ModelStatus.VERIFYING: "Verifying...",
            ModelStatus.VALID: "Ready",
            ModelStatus.CORRUPTED: "Corrupted",
            ModelStatus.PARTIAL: "Partial Download",
            ModelStatus.FAILED: "Failed",
        }

        return cls(
            model_key=model_key,
            model_name=model_meta.name,
            display_name=model_meta.name,
            model_type=model_meta.model_type.value,
            status=status.value,
            status_display=status_messages.get(status, "Unknown"),
            expected_size_mb=model_meta.expected_size_mb,
            file_size_bytes=verification_result.file_size_bytes if verification_result else 0,
            expected_size_bytes=model_meta.expected_size_bytes,
            size_valid=verification_result.size_valid if verification_result else False,
            checksum_valid=verification_result.checksum_valid if verification_result else False,
            description=model_meta.description,
            tags=model_meta.tags,
            min_vram_gb=model_meta.min_vram_gb,
            recommended_vram_gb=model_meta.recommended_vram_gb,
            verified_at=verification_result.verified_at.isoformat() if verification_result else None,
            error_message=verification_result.error_message if verification_result else None,
        )


class ModelsDashboardResponse(BaseModel):
    total_models: int
    ready_models: int
    missing_models: int
    corrupted_models: int
    downloading_models: int
    overall_status: str
    models: List[ModelStatusResponse]
    last_updated: str


class PullModelRequest(BaseModel):
    model_key: str


class PullModelResponse(BaseModel):
    model_key: str
    model_name: str
    status: str
    message: str


class PreflightCheckResponse(BaseModel):
    overall_passed: bool
    checks: List[Dict[str, Any]]
    blocked_features: List[str]
    timestamp: str


@router.get("/status", response_model=ModelsDashboardResponse)
async def get_models_status(
    current_user: dict = Depends(get_current_user),
    verification_service: ModelVerificationService = Depends(get_verification_service),
):
    all_models = get_all_models()
    results = await verification_service.verify_all_models(check_checksum=False)

    verification_map = {r.model_key: r for r in results}
    progress_map = {p.model_key: p for p in verification_service.get_all_progress()}

    model_responses = []
    ready = 0
    missing = 0
    corrupted = 0
    downloading = 0

    for model_key, model_meta in MODEL_REGISTRY.items():
        verification = verification_map.get(model_key)
        progress = progress_map.get(model_key)

        if progress and progress.status in [ModelStatus.DOWNLOADING, ModelStatus.VERIFYING]:
            status = progress.status
            downloading += 1
        elif verification:
            status = verification.status
            if status == ModelStatus.VALID:
                ready += 1
            elif status == ModelStatus.NOT_DOWNLOADED:
                missing += 1
            else:
                corrupted += 1
        else:
            status = ModelStatus.NOT_DOWNLOADED
            missing += 1

        model_responses.append(
            ModelStatusResponse.from_verification(model_key, model_meta, verification, status)
        )

    overall_status = "ready" if missing == 0 and corrupted == 0 else "degraded"

    return ModelsDashboardResponse(
        total_models=len(all_models),
        ready_models=ready,
        missing_models=missing,
        corrupted_models=corrupted,
        downloading_models=downloading,
        overall_status=overall_status,
        models=model_responses,
        last_updated=datetime.utcnow().isoformat(),
    )


@router.get("/status/{model_key}", response_model=ModelStatusResponse)
async def get_model_status(
    model_key: str,
    current_user: dict = Depends(get_current_user),
    verification_service: ModelVerificationService = Depends(get_verification_service),
):
    model_meta = get_model_metadata(model_key)
    if not model_meta:
        raise HTTPException(status_code=404, detail=f"Model '{model_key}' not found in registry")

    verification = await verification_service.verify_model_file(model_key, check_checksum=True)
    progress = verification_service.get_download_progress(model_key)

    if progress and progress.status in [ModelStatus.DOWNLOADING, ModelStatus.VERIFYING]:
        status = progress.status
    else:
        status = verification.status if verification else ModelStatus.NOT_DOWNLOADED

    return ModelStatusResponse.from_verification(model_key, model_meta, verification, status)


@router.post("/pull", response_model=PullModelResponse)
async def pull_model(
    request: PullModelRequest,
    current_user: dict = Depends(require_role("admin")),
    verification_service: ModelVerificationService = Depends(get_verification_service),
):
    model_meta = get_model_metadata(request.model_key)
    if not model_meta:
        raise HTTPException(status_code=404, detail=f"Model '{request.model_key}' not found")

    async def progress_callback(progress):
        pass

    try:
        success = await verification_service.pull_model(
            request.model_key,
            progress_callback=progress_callback,
        )

        if success:
            return PullModelResponse(
                model_key=request.model_key,
                model_name=model_meta.name,
                status="success",
                message=f"Model '{model_meta.name}' pulled and verified successfully",
            )
        else:
            return PullModelResponse(
                model_key=request.model_key,
                model_name=model_meta.name,
                status="failed",
                message="Download failed after multiple retries",
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/progress/{model_key}")
async def get_download_progress(
    model_key: str,
    current_user: dict = Depends(get_current_user),
    verification_service: ModelVerificationService = Depends(get_verification_service),
):
    progress = verification_service.get_download_progress(model_key)

    if not progress:
        model_meta = get_model_metadata(model_key)
        if not model_meta:
            raise HTTPException(status_code=404, detail=f"Model '{model_key}' not found")

        return {
            "model_key": model_key,
            "model_name": model_meta.name,
            "status": "not_started",
            "progress_percent": 0,
        }

    return progress.to_dict()


@router.get("/progress")
async def get_all_progress(
    current_user: dict = Depends(get_current_user),
    verification_service: ModelVerificationService = Depends(get_verification_service),
):
    progress_list = verification_service.get_all_progress()
    return {
        "downloads": [p.to_dict() for p in progress_list],
        "last_updated": datetime.utcnow().isoformat(),
    }


@router.post("/preflight", response_model=PreflightCheckResponse)
async def run_preflight_check(
    current_user: dict = Depends(get_current_user),
    verification_service: ModelVerificationService = Depends(get_verification_service),
):
    result = await verification_service.preflight_check()
    return PreflightCheckResponse(
        overall_passed=result.overall_passed,
        checks=result.checks,
        blocked_features=result.blocked_features,
        timestamp=result.timestamp.isoformat(),
    )


@router.get("/registry")
async def get_model_registry(
    current_user: dict = Depends(get_current_user),
):
    models = []
    for model_key, model_meta in MODEL_REGISTRY.items():
        models.append({
            "key": model_key,
            "name": model_meta.name,
            "ollama_name": model_meta.ollama_name,
            "description": model_meta.description,
            "model_type": model_meta.model_type.value,
            "expected_size_mb": model_meta.expected_size_mb,
            "min_vram_gb": model_meta.min_vram_gb,
            "recommended_vram_gb": model_meta.recommended_vram_gb,
            "tags": model_meta.tags,
        })

    return {
        "models": models,
        "total": len(models),
    }


def get_verification_service() -> ModelVerificationService:
    from app.models.verification import get_verification_service as _get
    return _get()
