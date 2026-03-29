import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime
from backend.app.models.verification import (
    ModelVerificationService,
    DownloadProgress,
    VerificationResult,
    PreflightCheckResult,
    ModelStatus,
)


@pytest.fixture
def verification_service():
    return ModelVerificationService(ollama_base_url="http://localhost:11434")


@pytest.mark.asyncio
async def test_check_ollama_health_success(verification_service):
    with patch("httpx.AsyncClient") as mock_client:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"models": []}

        mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)

        result = await verification_service.check_ollama_health()

        assert result is True


@pytest.mark.asyncio
async def test_check_ollama_health_failure(verification_service):
    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(side_effect=Exception("Connection refused"))

        result = await verification_service.check_ollama_health()

        assert result is False


@pytest.mark.asyncio
async def test_get_ollama_models(verification_service):
    expected_models = [
        "mistral:7b-instruct-q4_K_M",
        "llama3.1:8b-instruct-q4_K_M",
    ]

    with patch("httpx.AsyncClient") as mock_client:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "models": [{"name": m} for m in expected_models]
        }

        mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)

        result = await verification_service.get_ollama_models()

        assert len(result) == 2
        assert all(m in result for m in expected_models)


@pytest.mark.asyncio
async def test_verify_unknown_model(verification_service):
    result = await verification_service.verify_model_file("nonexistent-model")

    assert result.model_key == "nonexistent-model"
    assert result.status == ModelStatus.NOT_DOWNLOADED
    assert "not found in registry" in result.error_message


@pytest.mark.asyncio
async def test_verify_model_not_downloaded(verification_service):
    with patch.object(verification_service, "get_ollama_models", return_value=[]):
        result = await verification_service.verify_model_file("mistral-7b")

        assert result.status == ModelStatus.NOT_DOWNLOADED
        assert result.file_exists is False


@pytest.mark.asyncio
async def test_verify_model_downloaded(verification_service):
    with patch.object(verification_service, "get_ollama_models", return_value=["mistral:7b-instruct-q4_K_M"]):
        with patch.object(verification_service, "_get_ollama_model_size", return_value=4509219840):
            result = await verification_service.verify_model_file("mistral-7b", check_checksum=False)

            assert result.status == ModelStatus.VALID
            assert result.file_exists is True
            assert result.size_valid is True


def test_download_progress_to_dict():
    progress = DownloadProgress(
        model_key="mistral-7b",
        model_name="Mistral 7B",
        status=ModelStatus.DOWNLOADING,
        bytes_downloaded=1024000,
        total_bytes=4509219840,
        progress_percent=0.023,
        download_speed_mbps=5.2,
        eta_seconds=120.0,
        retry_count=0,
        started_at=datetime.utcnow(),
    )

    result = progress.to_dict()

    assert result["model_key"] == "mistral-7b"
    assert result["status"] == "downloading"
    assert result["progress_percent"] == 0.02
    assert result["download_speed_mbps"] == 5.2


def test_verification_result_to_dict():
    result = VerificationResult(
        model_key="mistral-7b",
        model_name="Mistral 7B",
        status=ModelStatus.VALID,
        file_exists=True,
        file_size_bytes=4509219840,
        expected_size_bytes=4300000000,
        size_valid=True,
        checksum_valid=True,
        checksum_algorithm="sha256",
    )

    result_dict = result.to_dict()

    assert result_dict["status"] == "valid"
    assert result_dict["size_valid"] is True
    assert result_dict["checksum_valid"] is True


def test_preflight_check_result():
    result = PreflightCheckResult(
        overall_passed=True,
        checks=[
            {"name": "Ollama", "passed": True},
            {"name": "Models", "passed": True},
        ],
        blocked_features=[],
    )

    result_dict = result.to_dict()

    assert result_dict["overall_passed"] is True
    assert len(result_dict["checks"]) == 2
    assert len(result_dict["blocked_features"]) == 0


@pytest.mark.asyncio
async def test_preflight_check_all_passed(verification_service):
    with patch.object(verification_service, "check_ollama_health", return_value=True):
        with patch.object(verification_service, "get_ollama_models", return_value=[
            "mistral:7b-instruct-q4_K_M",
            "llama3.1:8b-instruct-q4_K_M",
            "phi3:mini-instruct-q4",
        ]):
            with patch.object(verification_service, "verify_model_file", new_callable=AsyncMock) as mock_verify:
                mock_verify.return_value = VerificationResult(
                    model_key="test",
                    model_name="Test",
                    status=ModelStatus.VALID,
                    file_exists=True,
                    size_valid=True,
                )

                result = await verification_service.preflight_check()

                assert result.overall_passed is True
                assert len(result.blocked_features) == 0


@pytest.mark.asyncio
async def test_preflight_check_ollama_down(verification_service):
    with patch.object(verification_service, "check_ollama_health", return_value=False):
        result = await verification_service.preflight_check()

        assert result.overall_passed is False
        assert "chat" in result.blocked_features


def test_can_access_feature():
    service = ModelVerificationService()

    preflight = PreflightCheckResult(
        overall_passed=False,
        checks=[{"name": "test", "passed": False}],
        blocked_features=["chat", "search"],
    )

    can_access, message = service.can_access_feature("chat", preflight)

    assert can_access is False
    assert "blocked" in message.lower()


def test_can_access_feature_no_preflight():
    service = ModelVerificationService()

    can_access, message = service.can_access_feature("chat", None)

    assert can_access is False
    assert "not performed" in message.lower()
