import json
import os
import sys
import traceback

import whisper
from ollama import Client


def _safe_header_text(s: str, limit: int = 800) -> str:
    s = (s or "").replace("\r", " ").replace("\n", " ").strip()
    if len(s) > limit:
        return s[: limit - 3] + "..."
    return s


def process_audio(file_path: str) -> dict:
    """End-to-end local voice pipeline:

    input audio -> Whisper STT -> Ollama (LLaMA3) -> Coqui TTS -> response.wav

    Side effects:
    - writes ai/response.wav
    - writes ai/response.json
    """
    out_dir = os.path.dirname(__file__)
    output_wav = os.path.join(out_dir, "response.wav")
    output_json = os.path.join(out_dir, "response.json")

    result_payload: dict = {
        "ok": False,
        "input_audio": file_path,
        "transcript": "",
        "reply": "",
        "errors": [],
        "tts_model": "",
    }

    try:
        # 1) Whisper STT (local)
        stt_model = whisper.load_model("base")
        stt = stt_model.transcribe(file_path)
        transcript = (stt.get("text") or "").strip()
        result_payload["transcript"] = transcript

        # 2) Ollama LLaMA 3 (local)
        client = Client(host="http://localhost:11434")
        llm = client.chat(
            model="llama3",
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful, concise customer support agent.",
                },
                {
                    "role": "user",
                    "content": transcript or "(No speech detected)",
                },
            ],
        )
        reply = ((llm.get("message") or {}).get("content") or "").strip()
        result_payload["reply"] = reply

        # 3) Coqui TTS (local)
        # Requires: pip install TTS
        try:
            from TTS.api import TTS  # type: ignore

            # A solid English model; change later for multilingual.
            # First run will download the model locally.
            tts_model_name = "tts_models/en/ljspeech/tacotron2-DDC"
            result_payload["tts_model"] = tts_model_name

            tts = TTS(model_name=tts_model_name, progress_bar=False)
            tts.tts_to_file(text=reply or "", file_path=output_wav)
        except Exception as e:
            # If Coqui fails, we still produce a wav so the backend can respond.
            result_payload["errors"].append(f"TTS failed: {type(e).__name__}: {e}")
            import shutil

            shutil.copy(file_path, output_wav)

        result_payload["ok"] = True

    except Exception as e:
        result_payload["errors"].append(f"Pipeline failed: {type(e).__name__}: {e}")
        result_payload["errors"].append(traceback.format_exc())

        # Last-resort output wav (copy input)
        try:
            import shutil

            shutil.copy(file_path, output_wav)
        except Exception:
            pass

    # Always write debug JSON for the backend/dashboard
    try:
        with open(output_json, "w", encoding="utf-8") as f:
            json.dump(result_payload, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

    # Also print a single-line summary (captured by backend if needed)
    print(
        json.dumps(
            {
                "ok": result_payload["ok"],
                "transcript": _safe_header_text(result_payload.get("transcript", "")),
                "reply": _safe_header_text(result_payload.get("reply", "")),
                "errors": result_payload.get("errors", [])[:1],
            },
            ensure_ascii=False,
        )
    )
    return result_payload


if __name__ == "__main__":
    if len(sys.argv) <= 1:
        print("No audio file provided")
        raise SystemExit(2)
    process_audio(sys.argv[1])
