from __future__ import annotations

import os
import sys
from typing import Optional

# Allow running as: python ai/pipeline.py
if __package__ is None or __package__ == "":
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ai.transcribe import transcribe
from ai.llama_query import query_llama
from ai.tts_generate import generate_speech


def _require_imports() -> Optional[str]:
    try:
        import whisper  # noqa: F401
    except Exception:
        return (
            "Missing dependency: openai-whisper. Install with: "
            "python -m pip install openai-whisper"
        )

    try:
        from gtts import gTTS  # noqa: F401
    except Exception:
        return (
            "Missing dependency: gTTS. Install with: "
            "python -m pip install gTTS"
        )

    try:
        import requests  # noqa: F401
    except Exception:
        return "Missing dependency: requests. Install with: python -m pip install requests"

    return None


def _preflight(input_path: str) -> None:
    print(f"Python: {sys.executable}")

    missing = _require_imports()
    if missing:
        raise RuntimeError(missing)

    if not os.path.exists(input_path):
        raise FileNotFoundError(
            f"Audio file not found: {input_path}. Place input.wav in the project root."
        )
    if os.path.getsize(input_path) == 0:
        raise ValueError("Empty audio")

    # Optional Ollama connectivity check (query_llama will still handle failures)
    try:
        import requests

        r = requests.get("http://localhost:11434/api/tags", timeout=3)
        if r.status_code != 200:
            raise RuntimeError()
    except Exception:
        raise RuntimeError(
            "LLaMA not responding. Ensure Ollama is running at http://localhost:11434 "
            "and the model is available (e.g. ollama run llama3)."
        )


def main() -> int:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(base_dir)

    input_path = os.path.join(project_root, "input.wav")
    output_path = os.path.join(project_root, "response.wav")

    try:
        _preflight(input_path)

        print("Transcribing...")
        transcript = transcribe(input_path)

        print("Sending to LLaMA...")
        reply = query_llama(transcript)

        print("Generating speech...")
        generate_speech(reply, output_path)

        return 0
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
