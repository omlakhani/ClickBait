# backend/main.py
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import FileResponse
import shutil, os, uuid, subprocess
import json

app = FastAPI()
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AI_DIR = os.path.join(ROOT, "ai")
UPLOAD_DIR = os.path.join(ROOT, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/upload")
async def upload_audio(file: UploadFile = File(...)):
    # Save the incoming file
    uid = str(uuid.uuid4())[:8]
    file_path = os.path.join(UPLOAD_DIR, f"{uid}_{file.filename}")
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Call the ai pipeline script (synchronous)
    # Note: we run pipeline.py which outputs response.wav in ai folder
    pipeline_script = os.path.join(AI_DIR, "pipeline.py")
    if not os.path.exists(pipeline_script):
        return {
            "error": "AI pipeline script not found",
            "expected_path": pipeline_script,
        }
    proc = subprocess.run(["python", pipeline_script, file_path], capture_output=True, text=True)

    if proc.returncode != 0:
        return {"error": "AI pipeline failed", "stdout": proc.stdout, "stderr": proc.stderr}

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