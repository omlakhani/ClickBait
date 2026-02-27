import json
import os
import sys
import traceback
import shutil

import whisper
from ollama import Client
from gtts import gTTS


def _safe_header_text(s: str, limit: int = 800) -> str:
    s = (s or "").replace("\r", " ").replace("\n", " ").strip()
    if len(s) > limit:
        return s[: limit - 3] + "..."
    return s


def process_audio(file_path: str, session_id: str = "default") -> dict:
    """End-to-end local voice pipeline:

    input audio -> Whisper STT -> Ollama (LLaMA3) -> gTTS/Coqui -> response.wav

    Side effects:
    - writes ai/response.wav
    - writes ai/response.json
    """
    out_dir = os.path.dirname(__file__)
    output_wav = os.path.join(out_dir, "response.wav")
    output_json = os.path.join(out_dir, "response.json")

    # Load history for context
    history = []
    # Fetch from shared backend state if available
    try:
        from backend.main import _CHAT_SESSIONS
        history = _CHAT_SESSIONS.get(session_id, [])[-5:]
    except ImportError:
        pass

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
        print("DEBUG: Loading Whisper model...", file=sys.stderr)
        stt_model = whisper.load_model("base")
        print(f"DEBUG: Transcribing {file_path}...", file=sys.stderr)
        
        # Check if ffmpeg is available in this process
        import subprocess
        try:
            subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
            print("DEBUG: ffmpeg found by subprocess", file=sys.stderr)
        except Exception as fe:
            print(f"DEBUG: ffmpeg NOT found by subprocess: {fe}", file=sys.stderr)
            # Try to manually add it to PATH if it's in the known location
            ffmpeg_path = r"C:\Users\Admin\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-essentials_build\bin"
            if ffmpeg_path not in os.environ["PATH"]:
                os.environ["PATH"] = ffmpeg_path + os.pathsep + os.environ["PATH"]
                print(f"DEBUG: Manually added {ffmpeg_path} to os.environ['PATH']", file=sys.stderr)

        stt = stt_model.transcribe(file_path)
        transcript = (stt.get("text") or "").strip()
        result_payload["transcript"] = transcript

        # 2) Ollama LLaMA 3 (local)
        print("DEBUG: Connecting to Ollama...", file=sys.stderr)
        client = Client(host="http://localhost:11434")
        print("DEBUG: Querying LLaMA 3...", file=sys.stderr)
        
        # Prepare messages with history
        messages = [
            {
                "role": "system",
                "content": "You are a helpful, concise customer support agent. If the user asks a riddle, solve it creatively. Use the provided conversation history for context.",
            }
        ]
        for m in history:
            messages.append({"role": m.get("role", "user"), "content": m.get("content", "")})
        
        messages.append({
            "role": "user",
            "content": transcript or "(No speech detected)",
        })

        llm = client.chat(
            model="llama3",
            messages=messages,
        )
        reply = ((llm.get("message") or {}).get("content") or "").strip()
        result_payload["reply"] = reply

        # 3) TTS (Try Coqui, fallback to gTTS)
        try:
            try:
                from TTS.api import TTS  # type: ignore
                tts_model_name = "tts_models/en/ljspeech/tacotron2-DDC"
                result_payload["tts_model"] = tts_model_name
                tts = TTS(model_name=tts_model_name, progress_bar=False)
                tts.tts_to_file(text=reply or "", file_path=output_wav)
            except ImportError:
                # Fallback to gTTS if Coqui is not installed
                result_payload["tts_model"] = "gTTS"
                tts = gTTS(text=reply or "I didn't get that.", lang='en')
                tts.save(output_wav)
        except Exception as e:
            result_payload["errors"].append(f"TTS failed: {type(e).__name__}: {e}")
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
    try:
        summary = json.dumps(
            {
                "ok": result_payload["ok"],
                "transcript": _safe_header_text(result_payload.get("transcript", "")),
                "reply": _safe_header_text(result_payload.get("reply", "")),
                "errors": result_payload.get("errors", [])[:1],
            },
            ensure_ascii=True,  # Force ASCII to avoid encoding issues on Windows stdout
        )
        print(summary)
    except Exception:
        pass
    return result_payload


if __name__ == "__main__":
    if len(sys.argv) <= 1:
        print("No audio file provided")
        raise SystemExit(2)
    
    file_path = sys.argv[1]
    session_id = sys.argv[2] if len(sys.argv) > 2 else "default"
    process_audio(file_path, session_id)
