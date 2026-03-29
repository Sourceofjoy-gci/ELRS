#!/bin/bash
# ELRI Ollama Model Bootstrap Script
# Pulls required LLM models for the Eswatini Legal Research Intelligence system
# Usage: ./pull_models.sh

set -e

OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"
MODELS=(
    "mistral:7b-instruct-q4_K_M"
    "llama3.1:8b-instruct-q4_K_M"
    "phi3:mini-instruct-q4"
)

echo "=========================================="
echo "ELRI Ollama Model Bootstrap"
echo "=========================================="
echo "Ollama Host: $OLLAMA_HOST"
echo ""

check_ollama() {
    echo "Checking Ollama service..."
    if curl -s -f "$OLLAMA_HOST/api/tags" > /dev/null 2>&1; then
        echo "✓ Ollama is reachable"
        return 0
    else
        echo "✗ Ollama is not reachable at $OLLAMA_HOST"
        echo "  Please ensure Ollama is running with: docker compose up ollama"
        return 1
    fi
}

pull_model() {
    local model=$1
    echo ""
    echo "Pulling model: $model"
    echo "-------------------------------------------"

    if ollama pull "$model" 2>&1 | tee /dev/stderr | grep -q "pulling manifest\|verifying sha256\|success"; then
        echo "✓ Model $model pulled successfully"
        return 0
    else
        echo "✗ Failed to pull model $model"
        return 1
    fi
}

verify_models() {
    echo ""
    echo "=========================================="
    echo "Verifying Models"
    echo "=========================================="

    local available_models=$(curl -s "$OLLAMA_HOST/api/tags" | grep -o '"name":"[^"]*"' | sed 's/"name":"//g;s/"//g')
    local all_found=true

    for model in "${MODELS[@]}"; do
        if echo "$available_models" | grep -q "$model"; then
            echo "✓ $model"
        else
            echo "✗ $model (NOT FOUND)"
            all_found=false
        fi
    done

    if $all_found; then
        echo ""
        echo "=========================================="
        echo "All models verified successfully!"
        echo "=========================================="
        return 0
    else
        echo ""
        echo "=========================================="
        echo "Some models are missing!"
        echo "=========================================="
        return 1
    fi
}

main() {
    if ! check_ollama; then
        exit 1
    fi

    for model in "${MODELS[@]}"; do
        if ! pull_model "$model"; then
            echo "Failed to pull $model"
            exit 1
        fi
    done

    if ! verify_models; then
        exit 1
    fi

    exit 0
}

main "$@"
