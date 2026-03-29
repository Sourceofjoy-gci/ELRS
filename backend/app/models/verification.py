import os
import asyncio
import logging
import time
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Callable, AsyncIterator
from datetime import datetime
from enum import Enum
from pathlib import Path
import httpx

from app.models.registry import (
    MODEL_REGISTRY,
    ModelMetadata,
    ModelStatus,
    ModelType,
    calculate_file_hash,
)

logger = logging.getLogger(__name__)


@dataclass
class DownloadProgress:
    model_key: str
    model_name: str
    status: ModelStatus
    bytes_downloaded: int = 0
    total_bytes: int = 0
    progress_percent: float = 0.0
    download_speed_mbps: float = 0.0
    eta_seconds: Optional[float] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    file_checksum_valid: bool = False
    file_size_valid: bool = False

    def to_dict(self) -> dict:
        return {
            "model_key": self.model_key,
            "model_name": self.model_name,
            "status": self.status.value,
            "progress_percent": round(self.progress_percent, 2),
            "bytes_downloaded": self.bytes_downloaded,
            "total_bytes": self.total_bytes,
            "download_speed_mbps": round(self.download_speed_mbps, 2) if self.download_speed_mbps else None,
            "eta_seconds": round(self.eta_seconds, 1) if self.eta_seconds else None,
            "error_message": self.error_message,
            "retry_count": self.retry_count,
            "file_checksum_valid": self.file_checksum_valid,
            "file_size_valid": self.file_size_valid,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


@dataclass
class VerificationResult:
    model_key: str
    model_name: str
    status: ModelStatus
    file_exists: bool = False
    file_size_bytes: int = 0
    expected_size_bytes: int = 0
    size_valid: bool = False
    checksum_valid: bool = False
    checksum_algorithm: Optional[str] = None
    expected_checksum: Optional[str] = None
    actual_checksum: Optional[str] = None
    error_message: Optional[str] = None
    verified_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "model_key": self.model_key,
            "model_name": self.model_name,
            "status": self.status.value,
            "file_exists": self.file_exists,
            "file_size_bytes": self.file_size_bytes,
            "expected_size_bytes": self.expected_size_bytes,
            "size_valid": self.size_valid,
            "checksum_valid": self.checksum_valid,
            "checksum_algorithm": self.checksum_algorithm,
            "error_message": self.error_message,
            "verified_at": self.verified_at.isoformat(),
        }


@dataclass
class PreflightCheckResult:
    overall_passed: bool
    checks: List[dict]
    blocked_features: List[str]
    timestamp: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "overall_passed": self.overall_passed,
            "checks": self.checks,
            "blocked_features": self.blocked_features,
            "timestamp": self.timestamp.isoformat(),
        }


class ModelVerificationService:
    MAX_RETRIES = 3
    RETRY_DELAY_SECONDS = 5
    CHUNK_SIZE = 8192

    def __init__(self, ollama_base_url: str = "http://ollama:11434"):
        self.ollama_base_url = ollama_base_url
        self._download_progress: Dict[str, DownloadProgress] = {}
        self._verification_cache: Dict[str, VerificationResult] = {}
        self._cache_ttl_seconds = 300

    async def check_ollama_health(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.ollama_base_url}/api/tags")
                return response.status_code == 200
        except Exception as e:
            logger.error(f"Ollama health check failed: {e}")
            return False

    async def get_ollama_models(self) -> List[str]:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.ollama_base_url}/api/tags")
                if response.status_code == 200:
                    data = response.json()
                    return [m.get("name", "") for m in data.get("models", [])]
                return []
        except Exception as e:
            logger.error(f"Failed to get Ollama models: {e}")
            return []

    async def verify_model_file(
        self,
        model_key: str,
        check_checksum: bool = True,
    ) -> VerificationResult:
        if model_key not in MODEL_REGISTRY:
            return VerificationResult(
                model_key=model_key,
                model_name="Unknown",
                status=ModelStatus.NOT_DOWNLOADED,
                error_message=f"Model '{model_key}' not found in registry",
            )

        model_meta = MODEL_REGISTRY[model_key]
        cache_key = f"{model_key}_{int(time.time() / self._cache_ttl_seconds)}"

        if cache_key in self._verification_cache:
            cached = self._verification_cache[cache_key]
            if (datetime.utcnow() - cached.verified_at).total_seconds() < self._cache_ttl_seconds:
                return cached

        try:
            available_models = await self.get_ollama_models()

            if model_meta.ollama_name not in available_models:
                return VerificationResult(
                    model_key=model_key,
                    model_name=model_meta.name,
                    status=ModelStatus.NOT_DOWNLOADED,
                    expected_size_bytes=model_meta.expected_size_bytes,
                    error_message=f"Model '{model_meta.ollama_name}' not found in Ollama",
                )

            model_size = await self._get_ollama_model_size(model_meta.ollama_name)
            size_valid = model_size >= model_meta.expected_size_bytes * 0.95

            checksum_valid = False
            actual_checksum = None
            checksum_algorithm = None
            expected_checksum = None

            if check_checksum and model_meta.files:
                for file_info in model_meta.files:
                    if file_info.sha256_hash:
                        checksum_algorithm = "sha256"
                        expected_checksum = file_info.sha256_hash
                        break

            result = VerificationResult(
                model_key=model_key,
                model_name=model_meta.name,
                status=ModelStatus.VALID if (size_valid and checksum_valid) else ModelStatus.CORRUPTED,
                file_exists=True,
                file_size_bytes=model_size,
                expected_size_bytes=model_meta.expected_size_bytes,
                size_valid=size_valid,
                checksum_valid=checksum_valid,
                checksum_algorithm=checksum_algorithm,
                expected_checksum=expected_checksum,
                actual_checksum=actual_checksum,
            )

            self._verification_cache[cache_key] = result
            return result

        except Exception as e:
            logger.error(f"Verification failed for {model_key}: {e}")
            return VerificationResult(
                model_key=model_key,
                model_name=model_meta.name,
                status=ModelStatus.FAILED,
                error_message=str(e),
            )

    async def _get_ollama_model_size(self, ollama_name: str) -> int:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.ollama_base_url}/api/tags")
                if response.status_code == 200:
                    data = response.json()
                    for model in data.get("models", []):
                        if model.get("name") == ollama_name:
                            return model.get("size", 0)
                return 0
        except Exception:
            return 0

    async def verify_all_models(self, check_checksum: bool = False) -> List[VerificationResult]:
        results = []
        for model_key in MODEL_REGISTRY.keys():
            result = await self.verify_model_file(model_key, check_checksum)
            results.append(result)
        return results

    async def pull_model(
        self,
        model_key: str,
        progress_callback: Optional[Callable[[DownloadProgress], None]] = None,
    ) -> bool:
        if model_key not in MODEL_REGISTRY:
            logger.error(f"Unknown model key: {model_key}")
            return False

        model_meta = MODEL_REGISTRY[model_key]
        progress = DownloadProgress(
            model_key=model_key,
            model_name=model_meta.name,
            status=ModelStatus.DOWNLOADING,
            total_bytes=model_meta.expected_size_bytes,
            started_at=datetime.utcnow(),
        )
        self._download_progress[model_key] = progress

        for attempt in range(self.MAX_RETRIES):
            try:
                progress.retry_count = attempt
                progress.status = ModelStatus.DOWNLOADING
                if progress_callback:
                    progress_callback(progress)

                async with httpx.AsyncClient(timeout=600.0) as client:
                    async with client.stream(
                        "POST",
                        f"{self.ollama_base_url}/api/pull",
                        json={"name": model_meta.ollama_name},
                    ) as response:
                        if response.status_code != 200:
                            raise Exception(f"Pull failed with status {response.status_code}")

                        async for line in response.aiter_lines():
                            if line.strip():
                                import json
                                try:
                                    data = json.loads(line)
                                    progress = self._parse_progress(model_key, data, progress)
                                    if progress_callback:
                                        progress_callback(progress)
                                except json.JSONDecodeError:
                                    continue

                progress.status = ModelStatus.VERIFYING
                if progress_callback:
                    progress_callback(progress)

                verification = await self.verify_model_file(model_key, check_checksum=True)
                if verification.status == ModelStatus.VALID:
                    progress.status = ModelStatus.VALID
                    progress.file_size_valid = verification.size_valid
                    progress.file_checksum_valid = verification.checksum_valid
                    progress.completed_at = datetime.utcnow()
                else:
                    progress.status = ModelStatus.CORRUPTED
                    progress.error_message = "Verification failed after download"

                if progress_callback:
                    progress_callback(progress)

                return verification.status == ModelStatus.VALID

            except Exception as e:
                logger.error(f"Pull attempt {attempt + 1} failed for {model_key}: {e}")
                progress.error_message = str(e)
                progress.retry_count = attempt + 1

                if attempt < self.MAX_RETRIES - 1:
                    await asyncio.sleep(self.RETRY_DELAY_SECONDS * (attempt + 1))

        progress.status = ModelStatus.FAILED
        if progress_callback:
            progress_callback(progress)
        return False

    def _parse_progress(
        self,
        model_key: str,
        data: dict,
        progress: DownloadProgress,
    ) -> DownloadProgress:
        status = data.get("status", "")
        if "total" in data:
            progress.total_bytes = data["total"]
        if "completed" in data:
            progress.bytes_downloaded = data["completed"]

        if progress.total_bytes > 0:
            progress.progress_percent = (progress.bytes_downloaded / progress.total_bytes) * 100

        if "speed" in data:
            progress.download_speed_mbps = data["speed"] / (1024 * 1024)

        if "eta" in data and data["eta"]:
            progress.eta_seconds = data["eta"]

        if "error" in data:
            progress.error_message = data["error"]

        progress.status = ModelStatus.DOWNLOADING
        return progress

    def get_download_progress(self, model_key: str) -> Optional[DownloadProgress]:
        return self._download_progress.get(model_key)

    def get_all_progress(self) -> List[DownloadProgress]:
        return list(self._download_progress.values())

    async def preflight_check(self) -> PreflightCheckResult:
        checks = []

        ollama_healthy = await self.check_ollama_health()
        checks.append({
            "name": "Ollama Service",
            "passed": ollama_healthy,
            "message": "Ollama service is running" if ollama_healthy else "Ollama service is not accessible",
        })

        available_models = await self.get_ollama_models()
        missing_models = []
        corrupted_models = []

        for model_key, model_meta in MODEL_REGISTRY.items():
            if model_meta.ollama_name not in available_models:
                missing_models.append(model_meta.name)
            else:
                verification = await self.verify_model_file(model_key, check_checksum=True)
                if verification.status != ModelStatus.VALID:
                    corrupted_models.append(model_meta.name)

        llm_models_valid = len(missing_models) == 0 and len(corrupted_models) == 0
        checks.append({
            "name": "Required Models",
            "passed": llm_models_valid,
            "message": f"All {len(MODEL_REGISTRY)} models are available and valid" if llm_models_valid else f"Missing: {missing_models}, Corrupted: {corrupted_models}",
            "details": {
                "missing": missing_models,
                "corrupted": corrupted_models,
            },
        })

        blocked_features = []
        if not ollama_healthy:
            blocked_features.extend(["chat", "search", "document_ingestion", "model_management"])
        elif missing_models or corrupted_models:
            blocked_features.extend(["chat", "search"])

        overall_passed = ollama_healthy and llm_models_valid

        return PreflightCheckResult(
            overall_passed=overall_passed,
            checks=checks,
            blocked_features=blocked_features,
        )

    def can_access_feature(self, feature: str, preflight: Optional[PreflightCheckResult] = None) -> tuple[bool, str]:
        if preflight is None:
            return False, "Pre-flight check not performed"

        if feature in preflight.blocked_features:
            return False, f"Feature '{feature}' is blocked: {'; '.join(preflight.checks)}"

        return True, "Feature accessible"


_verification_service: Optional[ModelVerificationService] = None


def get_verification_service() -> ModelVerificationService:
    global _verification_service
    if _verification_service is None:
        _verification_service = ModelVerificationService()
    return _verification_service
