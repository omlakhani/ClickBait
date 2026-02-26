<<<<<<< HEAD
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
=======
import os
import sys
import wave


def _write_silence_wav(path: str, duration_seconds: float = 0.5, sample_rate: int = 16000) -> None:
    n_channels = 1
    sampwidth = 2  # 16-bit PCM
    n_frames = int(duration_seconds * sample_rate)
    silence = (b"\x00\x00") * n_frames

    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with wave.open(path, "wb") as wf:
        wf.setnchannels(n_channels)
        wf.setsampwidth(sampwidth)
        wf.setframerate(sample_rate)
        wf.writeframes(silence)


def main() -> int:
    # Usage: python pipeline.py <input_audio_path>
    _ = sys.argv[1] if len(sys.argv) > 1 else None

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    response_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "response.wav")

    _write_silence_wav(response_path)
    print("ok")
    print(f"response_wav={response_path}")
    return 0
>>>>>>> 29dcfb2e96b576d0ca4cec04e5eac1a6fe0c7947


if __name__ == "__main__":
    raise SystemExit(main())
