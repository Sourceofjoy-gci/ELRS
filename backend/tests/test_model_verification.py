import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from backend.app.models.registry import (
    MODEL_REGISTRY,
    ModelMetadata,
    ModelStatus,
    get_model_metadata,
    get_all_models,
    calculate_file_hash,
)


def test_model_registry_contains_all_required_models():
    required_models = ["mistral-7b", "llama-3.1-8b", "phi-3-mini", "nomic-embed-text", "ms-marco-minilm"]

    for model_key in required_models:
        assert model_key in MODEL_REGISTRY, f"Model {model_key} should be in registry"


def test_model_metadata_has_required_fields():
    for model_key, model_meta in MODEL_REGISTRY.items():
        assert model_meta.name, f"{model_key} should have a name"
        assert model_meta.ollama_name, f"{model_key} should have an ollama_name"
        assert model_meta.description, f"{model_key} should have a description"
        assert model_meta.expected_size_mb > 0, f"{model_key} should have positive size"
        assert model_meta.min_vram_gb >= 0, f"{model_key} should have valid min_vram"


def test_mistral_7b_metadata():
    mistral = MODEL_REGISTRY["mistral-7b"]
    assert mistral.name == "Mistral 7B Instruct"
    assert "mistral:7b" in mistral.ollama_name
    assert mistral.model_type.value == "llm"
    assert "legal" in mistral.tags


def test_llama_3_1_metadata():
    llama = MODEL_REGISTRY["llama-3.1-8b"]
    assert llama.name == "Llama 3.1 8B Instruct"
    assert "llama3.1:8b" in llama.ollama_name
    assert llama.min_vram_gb == 8


def test_phi_3_mini_metadata():
    phi = MODEL_REGISTRY["phi-3-mini"]
    assert phi.name == "Phi-3 Mini Instruct"
    assert phi.min_vram_gb == 3
    assert "routing" in phi.tags


def test_nomic_embed_metadata():
    nomic = MODEL_REGISTRY["nomic-embed-text"]
    assert nomic.model_type.value == "embedding"
    assert nomic.min_vram_gb == 0


def test_ms_marco_metadata():
    reranker = MODEL_REGISTRY["ms-marco-minilm"]
    assert reranker.model_type.value == "reranker"


def test_get_model_metadata():
    result = get_model_metadata("mistral-7b")
    assert result is not None
    assert result.name == "Mistral 7B Instruct"

    result = get_model_metadata("nonexistent")
    assert result is None


def test_get_all_models():
    models = get_all_models()
    assert len(models) >= 5
    assert all(isinstance(m, ModelMetadata) for m in models)


def test_model_status_enum():
    assert ModelStatus.NOT_DOWNLOADED.value == "not_downloaded"
    assert ModelStatus.VALID.value == "valid"
    assert ModelStatus.CORRUPTED.value == "corrupted"


def test_expected_size_bytes():
    for model_key, model_meta in MODEL_REGISTRY.items():
        expected_bytes = model_meta.expected_size_bytes
        assert expected_bytes > 0
        assert expected_bytes == int(model_meta.expected_size_mb * 1024 * 1024)


def test_checksum_validation_not_required():
    for model_key, model_meta in MODEL_REGISTRY.items():
        for file_info in model_meta.files:
            assert file_info.sha256_hash is not None or file_info.sha512_hash is not None
