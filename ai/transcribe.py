from __future__ import annotations

import os
from typing import Optional

import whisper

from .config import WHISPER_MODEL

_whisper_model: Optional[object] = None


def _get_model():
    global _whisper_model
    if _whisper_model is None:
        import torch
        device = "cuda" if torch.cuda.is_available() else "cpu"
        _whisper_model = whisper.load_model(WHISPER_MODEL, device=device)
    return _whisper_model


def transcribe(audio_path: str) -> str:
    if not audio_path or not os.path.exists(audio_path):
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    if os.path.getsize(audio_path) == 0:
        raise ValueError("Empty audio")

    model = _get_model()
    try:
        result = model.transcribe(audio_path)
    except Exception as e:
        raise RuntimeError(f"Transcription failed: {e}") from e

    text = (result.get("text") or "").strip()
    if not text:
        raise ValueError("Empty audio")

    return text
