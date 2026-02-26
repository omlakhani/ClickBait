# backend/main.py
import sys
import os

# Ensure the project root is in sys.path BEFORE any local imports
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import uuid
import json
import shutil
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, Header, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

# Import AI modules directly
from ai.transcribe import transcribe
from ai.llama_query import query_llama
from ai.tts_generate import generate_speech
from ai.config import MODEL_NAME, WHISPER_MODEL

app = FastAPI()

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(ROOT, "uploads")
RESPONSES_DIR = os.path.join(UPLOAD_DIR, "responses")
HISTORY_FILE = os.path.join(UPLOAD_DIR, "history.jsonl")

# Admin configuration
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "admin")

os.makedirs(RESPONSES_DIR, exist_ok=True)

# Mount uploads for direct audio serving
app.mount("/static/audio", StaticFiles(directory=RESPONSES_DIR), name="audio")

def save_history(entry: dict):
    with open(HISTORY_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")

@app.get("/", response_class=HTMLResponse)
async def get_index():
    index_path = os.path.join(os.path.dirname(__file__), "index.html")
    if not os.path.exists(index_path):
        return "index.html not found"
    with open(index_path, "r") as f:
        return f.read()

@app.get("/admin", response_class=HTMLResponse)
async def get_admin():
    admin_path = os.path.join(os.path.dirname(__file__), "admin.html")
    if not os.path.exists(admin_path):
        return "admin.html not found"
    with open(admin_path, "r") as f:
        return f.read()

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/api/voice-chat")
async def voice_chat(file: UploadFile = File(...)):
    uid = str(uuid.uuid4())[:8]
    input_filename = f"{uid}_input.wav"
    input_path = os.path.join(UPLOAD_DIR, input_filename)
    
    # Save incoming audio
    with open(input_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

<<<<<<< HEAD
    try:
        # 1. Transcribe
        transcript = transcribe(input_path)
=======
    # Call the ai pipeline script (synchronous)
    # Note: we run pipeline.py which outputs response.wav in ai folder
    pipeline_script = os.path.join(AI_DIR, "pipeline.py")
    if not os.path.exists(pipeline_script):
        return {
            "error": "AI pipeline script not found",
            "expected_path": pipeline_script,
        }
    proc = subprocess.run(["python", pipeline_script, file_path], capture_output=True, text=True)
>>>>>>> 29dcfb2e96b576d0ca4cec04e5eac1a6fe0c7947

        # 2. Query LLaMA
        reply_text = query_llama(transcript)

<<<<<<< HEAD
        # 3. Generate Speech
        output_filename = f"{uid}_response.wav"
        output_path = os.path.join(RESPONSES_DIR, output_filename)
        generate_speech(reply_text, output_path)

        # Prepare response
        reply_audio_url = f"/static/audio/{output_filename}"
        
        # Save to history
        history_entry = {
            "timestamp": datetime.now().isoformat(),
            "transcript": transcript,
            "reply_text": reply_text,
            "reply_audio_url": reply_audio_url,
            "provenance": {
                "stt": f"Whisper {WHISPER_MODEL}",
                "llm": MODEL_NAME,
                "tts": "gTTS"
            }
        }
        save_history(history_entry)

        return {
            "transcript": transcript,
            "reply_text": reply_text,
            "reply_audio_url": reply_audio_url
        }

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
    finally:
        # Cleanup input file to save space
        if os.path.exists(input_path):
            os.remove(input_path)

@app.get("/admin/history")
async def get_history(x_admin_token: Optional[str] = Header(None)):
    if x_admin_token != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    history = []
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    history.append(json.loads(line))
    
    return {"history": history}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
=======
    # Assume ai/pipeline.py produced ai/response.wav
    audio_out = os.path.join(AI_DIR, "response.wav")
    if not os.path.exists(audio_out):
        return {
            "error": "AI pipeline did not produce response.wav",
            "expected_path": audio_out,
            "stdout": proc.stdout,
            "stderr": proc.stderr,
        }
    # Read JSON-like output from pipeline or we can return static
    # For now, we'll return the transcript & reply captured by pipeline stdout
    return FileResponse(audio_out, media_type="audio/wav", filename="response.wav")
>>>>>>> 29dcfb2e96b576d0ca4cec04e5eac1a6fe0c7947
