from __future__ import annotations

import os
from typing import Optional

from gtts import gTTS

def generate_speech(text: str, output_path: str) -> None:
    if text is None or not str(text).strip():
        raise ValueError("TTS input text is empty")
    if not output_path:
        raise ValueError("Output path is empty")

    out_dir = os.path.dirname(os.path.abspath(output_path))
    if out_dir and not os.path.exists(out_dir):
        os.makedirs(out_dir, exist_ok=True)

    try:
        tts = gTTS(text=text, lang='en')
        tts.save(output_path)
    except Exception as e:
        raise RuntimeError(f"TTS failure: {e}") from e

    if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
        raise RuntimeError("TTS failure: Output file empty")
