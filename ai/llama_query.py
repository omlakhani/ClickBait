from __future__ import annotations

from typing import Any, Dict

import requests

from .config import MODEL_NAME, OLLAMA_URL


def query_llama(prompt: str) -> str:
    if prompt is None or not str(prompt).strip():
        raise ValueError("Prompt is empty")

    payload: Dict[str, Any] = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
    }

    try:
        resp = requests.post(OLLAMA_URL, json=payload, timeout=120)
    except requests.RequestException as e:
        raise RuntimeError("LLaMA not responding") from e

    if resp.status_code != 200:
        raise RuntimeError(f"LLaMA not responding")

    try:
        data = resp.json()
    except ValueError as e:
        raise RuntimeError("LLaMA not responding") from e

    text = (data.get("response") or "").strip()
    if not text:
        raise RuntimeError("LLaMA returned empty response")

    return text
