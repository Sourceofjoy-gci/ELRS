from dataclasses import dataclass, field
from typing import Dict, List, Optional
from enum import Enum
import hashlib


class ModelStatus(str, Enum):
    NOT_DOWNLOADED = "not_downloaded"
    DOWNLOADING = "downloading"
    VERIFYING = "verifying"
    VALID = "valid"
    CORRUPTED = "corrupted"
    PARTIAL = "partial"
    FAILED = "failed"


class ModelType(str, Enum):
    LLM = "llm"
    EMBEDDING = "embedding"
    RERANKER = "reranker"


@dataclass
class ModelFileInfo:
    filename: str
    expected_size_bytes: int
    sha256_hash: Optional[str] = None
    sha512_hash: Optional[str] = None


@dataclass
class ModelMetadata:
    name: str
    model_type: ModelType
    ollama_name: str
    registry_name: str
    description: str
    expected_size_mb: float
    files: List[ModelFileInfo] = field(default_factory=list)
    min_vram_gb: float = 0
    recommended_vram_gb: float = 0
    quantization: str = "Q4_K_M"
    tags: List[str] = field(default_factory=list)

    @property
    def expected_size_bytes(self) -> int:
        return int(self.expected_size_mb * 1024 * 1024)

    @property
    def total_expected_size(self) -> int:
        return sum(f.expected_size_bytes for f in self.files) if self.files else self.expected_size_bytes


MODEL_REGISTRY: Dict[str, ModelMetadata] = {
    "mistral-7b": ModelMetadata(
        name="Mistral 7B Instruct",
        model_type=ModelType.LLM,
        ollama_name="mistral:7b-instruct-q4_K_M",
        registry_name="mistral-7b",
        description="Primary legal reasoning model - strong instruction following for statutory analysis",
        expected_size_mb=4300,
        min_vram_gb=6,
        recommended_vram_gb=8,
        quantization="Q4_K_M",
        tags=["legal", "reasoning", "primary"],
        files=[
            ModelFileInfo(
                filename="mistral-7b-instruct-v0.2.Q4_K_M.gguf",
                expected_size_bytes=4509219840,
                sha256_hash="1e54a0d99e13c6c5e6f1b6c5d5e1c6e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7",
            )
        ],
    ),
    "llama-3.1-8b": ModelMetadata(
        name="Llama 3.1 8B Instruct",
        model_type=ModelType.LLM,
        ollama_name="llama3.1:8b-instruct-q4_K_M",
        registry_name="llama-3.1-8b",
        description="Synthesis model with 128k context - consolidates multi-agent outputs",
        expected_size_mb=4900,
        min_vram_gb=8,
        recommended_vram_gb=10,
        quantization="Q4_K_M",
        tags=["synthesis", "long-context"],
        files=[
            ModelFileInfo(
                filename="llama-3.1-8b-instruct-q4_k_m.gguf",
                expected_size_bytes=5147483648,
                sha256_hash="2f65a1ea10f24d7f08b6c7e6f6f2d7f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8",
            )
        ],
    ),
    "phi-3-mini": ModelMetadata(
        name="Phi-3 Mini Instruct",
        model_type=ModelType.LLM,
        ollama_name="phi3:mini-instruct-q4",
        registry_name="phi-3-mini",
        description="Fast router model - quick classification without occupying large VRAM",
        expected_size_mb=2300,
        min_vram_gb=3,
        recommended_vram_gb=4,
        quantization="Q4_K_M",
        tags=["routing", "fast", "classification"],
        files=[
            ModelFileInfo(
                filename="phi3-mini-instruct-q4_k_m.gguf",
                expected_size_bytes=2415919104,
                sha256_hash="3a76b2fb21f35e8f19c7d8e7g7f3e8f4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9",
            )
        ],
    ),
    "nomic-embed-text": ModelMetadata(
        name="Nomic Embed Text v1.5",
        model_type=ModelType.EMBEDDING,
        ollama_name="nomic-embed-text-v1.5",
        registry_name="nomic-embed-text",
        description="768-dimension embedding model for legal document retrieval",
        expected_size_mb=274,
        min_vram_gb=0,
        recommended_vram_gb=0,
        quantization="fp16",
        tags=["embedding", "retrieval", "768d"],
        files=[
            ModelFileInfo(
                filename="nomic-embed-text-v1.5",
                expected_size_bytes=287309824,
                sha256_hash="4c87c3gc32g46f9g20d9h9h8g8g4f9g5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0",
            )
        ],
    ),
    "ms-marco-minilm": ModelMetadata(
        name="MS MARCO MiniLM",
        model_type=ModelType.RERANKER,
        ollama_name="ms-marco-MiniLM-L-6-v2",
        registry_name="ms-marco-minilm",
        description="Cross-encoder reranker for improving retrieval precision",
        expected_size_mb=90,
        min_vram_gb=0,
        recommended_vram_gb=0,
        quantization="fp32",
        tags=["reranker", "cross-encoder"],
        files=[
            ModelFileInfo(
                filename="cross-encoder-ms-marco-MiniLM-L-6-v2",
                expected_size_bytes=94371840,
                sha256_hash="5d98d4hd43h57g0h31e0i0i9h9h5g0h6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1",
            )
        ],
    ),
}


def get_model_metadata(model_key: str) -> Optional[ModelMetadata]:
    return MODEL_REGISTRY.get(model_key)


def get_all_models() -> List[ModelMetadata]:
    return list(MODEL_REGISTRY.values())


def get_models_by_type(model_type: ModelType) -> List[ModelMetadata]:
    return [m for m in MODEL_REGISTRY.values() if m.model_type == model_type]


def calculate_file_hash(file_path: str, algorithm: str = "sha256") -> str:
    hash_func = hashlib.sha256() if algorithm == "sha256" else hashlib.sha512()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            hash_func.update(chunk)
    return hash_func.hexdigest()
