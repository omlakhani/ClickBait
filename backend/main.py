# backend/main.py
from fastapi import FastAPI, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import shutil, os, uuid, subprocess, sys
import json
import re
from datetime import datetime
import urllib.request
import urllib.error
import urllib.parse

app = FastAPI()
API_VERSION = "v2"
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"] ,
    allow_headers=["*"],
)

# Templates and Static Files
templates = Jinja2Templates(directory=os.path.join(ROOT, "backend", "templates"))
app.mount("/recordings", StaticFiles(directory=UPLOAD_DIR), name="recordings")

_CHAT_SESSIONS: dict[str, list[dict[str, str]]] = {}
_SESSION_STATE: dict[str, dict] = {}
_APPOINTMENTS: list[dict] = []

_SITE_ALIASES: dict[str, str] = {
    "amazon": "https://www.amazon.com",
    "amazon.in": "https://www.amazon.in",
    "google": "https://www.google.com",
    "gmail": "https://mail.google.com",
    "youtube": "https://www.youtube.com",
    "facebook": "https://www.facebook.com",
    "instagram": "https://www.instagram.com",
    "twitter": "https://x.com",
    "x": "https://x.com",
    "linkedin": "https://www.linkedin.com",
    "whatsapp": "https://web.whatsapp.com",
    "netflix": "https://www.netflix.com",
    "spotify": "https://open.spotify.com",
    "github": "https://github.com",
    "stackoverflow": "https://stackoverflow.com",
}

_SITE_SEARCH_TEMPLATES: dict[str, str] = {
    "youtube": "https://www.youtube.com/results?search_query={q}",
    "google": "https://www.google.com/search?q={q}",
    "amazon": "https://www.amazon.com/s?k={q}",
    "amazon.in": "https://www.amazon.in/s?k={q}",
    "spotify": "https://open.spotify.com/search/{q}",
}

def _safe_http_url(url: str) -> str | None:
    u = (url or "").strip()
    if not u:
        return None
    if u.startswith("http://") or u.startswith("https://"):
        return u
    alias = _SITE_ALIASES.get(u.lower())
    if alias:
        return alias
    if re.match(r"^[a-z0-9-]+(\.[a-z0-9-]+)+(/.*)?$", u, flags=re.IGNORECASE):
        return f"https://{u}"
    return None

def _extract_entities(text: str) -> dict:
    t = (text or "").strip()
    low = t.lower()

    url = None
    site = None
    query = None

    # Natural language: "play shape of you on youtube" / "search headphones on amazon".
    sqm = re.search(
        r"\b(?:play|search|find|look\s*up)\s+(.+?)\s+on\s+([a-z0-9.-]+)\b",
        low,
        flags=re.IGNORECASE,
    )
    if sqm:
        query = sqm.group(1).strip(" \t\r\n\"'.,")
        site = sqm.group(2).strip(" \t\r\n\"'.,")
    else:
        # Natural language: "open amazon website" / "go to youtube".
        # Capture the token after open/go to/visit.
        nm = re.search(r"\b(?:open|visit|go\s+to)\s+([a-z0-9.-]+)", low)
        if nm:
            cand = nm.group(1).strip(" .,")
            if cand:
                url = cand
        m2 = re.search(r"\b([a-z0-9-]+(\.[a-z0-9-]+)+)(/[^\s]*)?\b", t, flags=re.IGNORECASE)
        if m2 and any(k in low for k in ["open", "go to", "visit", "website", "site"]):
            url = m2.group(0)

    date = None
    time = None
    tz = None
    reason = None

    dm = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", t)
    if dm:
        date = dm.group(1)

    tm = re.search(r"\b(\d{1,2}:\d{2})\b", t)
    if tm:
        time = tm.group(1)
    else:
        tm2 = re.search(r"\b(\d{1,2})\s*(am|pm)\b", low)
        if tm2:
            time = f"{tm2.group(1)}{tm2.group(2)}"

    tzm = re.search(r"\b(ist|pst|est|cst|mst|utc|gmt)\b", low)
    if tzm:
        tz = tzm.group(1).upper()

    rm = re.search(r"\bfor\s+(.+)$", t, flags=re.IGNORECASE)
    if rm and any(k in low for k in ["appointment", "book", "booking", "schedule"]):
        reason = rm.group(1).strip()[:120]

    return {
        "url": url,
        "site": site,
        "query": query,
        "date": date,
        "time": time,
        "timezone": tz,
        "reason": reason,
    }

def _detect_intent(text: str) -> tuple[str, float]:
    t = (text or "").strip().lower()
    if not t:
        return "empty", 1.0

    if re.search(r"\b(?:play|search|find|look\s*up)\b", t) and re.search(r"\bon\s+[a-z0-9.-]+\b", t):
        return "open_url", 0.8

    if any(k in t for k in ["open ", "go to ", "visit ", "website", "site"]):
        # Allow both explicit domains/URLs and common site names.
        if re.search(r"\bhttps?://", t) or re.search(r"\b([a-z0-9-]+(\.[a-z0-9-]+)+)(/[^\s]*)?\b", t):
            return "open_url", 0.85
        if re.search(r"\b(?:open|visit|go\s+to)\s+[a-z0-9.-]+", t):
            return "open_url", 0.75

    if any(k in t for k in ["book", "booking", "schedule", "appointment"]):
        return "book_appointment", 0.85

    if any(k in t for k in ["price", "pricing", "cost", "plan"]):
        return "pricing", 0.8

    if any(k in t for k in ["refund", "cancel", "cancellation", "return"]):
        return "refund", 0.8

    if any(k in t for k in ["login", "sign in", "password", "otp", "verify"]):
        return "login_help", 0.8

    if any(k in t for k in ["angry", "frustrated", "upset", "bad service"]):
        return "complaint", 0.75

    return "general_help", 0.6

def _generate_response(text: str, history: list[dict[str, str]], state: dict) -> dict:
    entities = _extract_entities(text)
    intent, confidence = _detect_intent(text)

    followups: list[str] = []
    candidates: list[str] = []
    action = None

    if intent == "empty":
        candidates = [
            "I didn’t catch that—could you repeat your request in one sentence?",
            "Say that again for me—what do you want to do?",
        ]

    elif intent == "open_url":
        site = (entities.get("site") or "").strip().lower()
        query = (entities.get("query") or "").strip()

        safe = _safe_http_url(entities.get("url") or "")

        if site and query:
            templ = _SITE_SEARCH_TEMPLATES.get(site)
            if not templ:
                templ = _SITE_SEARCH_TEMPLATES.get(site.replace("www.", ""))
            if not templ:
                # If the site is an alias key (e.g. amazon.in) treat it as supported.
                templ = _SITE_SEARCH_TEMPLATES.get(site)
            if templ:
                q = urllib.parse.quote_plus(query)
                safe = templ.format(q=q)

        if not safe:
            followups = [
                "Which website should I open? You can say something like: open example.com",
            ]
            candidates = [
                "Tell me the website name (example.com) and I’ll open it.",
                "Which URL should I open for you?",
            ]
        else:
            action = {"type": "OPEN_URL", "url": safe, "confirmation_required": True}
            candidates = [
                f"I can open {safe}. Want me to open it now?",
                f"Ready when you are—should I open {safe}?",
            ]

    elif intent == "book_appointment":
        pending = state.get("pending_booking") or {}
        merged = {
            "date": entities.get("date") or pending.get("date"),
            "time": entities.get("time") or pending.get("time"),
            "timezone": entities.get("timezone") or pending.get("timezone"),
            "reason": entities.get("reason") or pending.get("reason"),
        }
        state["pending_booking"] = merged

        missing = [k for k in ["date", "time"] if not merged.get(k)]
        if missing:
            if not merged.get("date"):
                followups.append("What date should I book it for? (e.g. 2026-02-27)")
            if not merged.get("time"):
                followups.append("What time should I book it for? (e.g. 14:30 or 2pm)")
            if not merged.get("reason"):
                followups.append("What’s the reason for the appointment?")

            candidates = [
                "I can book that. Tell me the date and time you prefer.",
                "Sure—what date/time should I schedule it for?",
            ]
        else:
            action = {"type": "BOOK_APPOINTMENT", "details": merged, "confirmation_required": False}
            candidates = [
                f"Booked. I scheduled it for {merged.get('date')} at {merged.get('time')}.",
                f"Done—your appointment is set for {merged.get('date')} {merged.get('time')}.",
            ]

    elif intent == "pricing":
        candidates = [
            "Sure—are you asking about pricing for personal use or for a business/team?",
            "I can help with pricing. Is this for an individual or a team?",
        ]

    elif intent == "refund":
        candidates = [
            "I can help with that. What’s your order ID (or the email used) so I can check your eligibility?",
            "Sure—share your order ID or account email and I’ll guide you through the refund steps.",
        ]

    elif intent == "login_help":
        candidates = [
            "Let’s get you back in. Are you seeing an error message, or are you not receiving the OTP/reset email?",
            "Login issues—got it. Do you see an error, or is the OTP/reset email not arriving?",
        ]

    elif intent == "complaint":
        candidates = [
            "I’m sorry about that. Tell me what happened and what outcome you want—I’ll help you resolve it.",
            "That sounds frustrating. Tell me what happened and what you want as the resolution.",
        ]

    else:
        candidates = [
            "Got it. What’s the main goal you want to achieve, and what’s stopping you right now?",
            "Understood—what outcome do you want, and what have you tried so far?",
        ]

    reply = candidates[0] if candidates else "How can I help?"
    return {
        "reply": reply,
        "analysis": {
            "intent": intent,
            "confidence": confidence,
            "entities": entities,
            "followups": followups,
        },
        "candidates": candidates,
        "action": action,
        "state": {"pending_booking": state.get("pending_booking")},
    }

def _env_bool(name: str, default: bool = False) -> bool:
    v = os.getenv(name)
    if v is None:
        return default
    return v.strip().lower() in {"1", "true", "yes", "y", "on"}

def _ollama_chat_generate(
    *,
    text: str,
    history: list[dict[str, str]],
    analysis: dict,
    action: dict | None,
    fallback_candidates: list[str],
) -> tuple[str | None, list[str] | None]:
    if not _env_bool("USE_OLLAMA_CHAT", False):
        return None, None

    base_url = (os.getenv("OLLAMA_URL") or "http://127.0.0.1:11434").rstrip("/")
    model = os.getenv("OLLAMA_MODEL") or "llama3"
    try:
        timeout_s = float(os.getenv("OLLAMA_TIMEOUT_S") or "4.5")
    except Exception:
        timeout_s = 4.5

    def _fmt_action(a: dict | None) -> str:
        if not a:
            return "none"
        t = str(a.get("type") or "")
        if t == "OPEN_URL":
            return f"OPEN_URL({a.get('url')})"
        if t == "BOOK_APPOINTMENT":
            return f"BOOK_APPOINTMENT({a.get('details')})"
        return json.dumps(a, ensure_ascii=False)

    short_hist = []
    for m in (history or [])[-8:]:
        role = (m.get("role") or "")
        content = (m.get("content") or "")
        if role and content:
            short_hist.append({"role": role, "content": content})

    system = (
        "You are a helpful voice assistant. "
        "You must follow the provided intent/entities/action. "
        "Do not invent actions or URLs. "
        "Return a JSON object with keys: reply (string), candidates (array of 2-4 strings)."
    )

    user = {
        "user_text": text,
        "intent": (analysis or {}).get("intent"),
        "entities": (analysis or {}).get("entities"),
        "confidence": (analysis or {}).get("confidence"),
        "followups": (analysis or {}).get("followups"),
        "action": _fmt_action(action),
        "fallback_candidates": (fallback_candidates or [])[:3],
    }

    messages = [{"role": "system", "content": system}]
    messages.extend(short_hist)
    messages.append({"role": "user", "content": json.dumps(user, ensure_ascii=False)})

    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.6},
    }

    req = urllib.request.Request(
        f"{base_url}/api/chat",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
    except Exception:
        return None, None

    try:
        outer = json.loads(raw)
        content = (((outer or {}).get("message") or {}).get("content") or "").strip()
        if not content:
            return None, None
        parsed = json.loads(content)
        reply = str(parsed.get("reply") or "").strip() or None
        candidates = parsed.get("candidates")
        if isinstance(candidates, list):
            candidates = [str(x).strip() for x in candidates if str(x).strip()]
        else:
            candidates = None
        if reply and candidates:
            return reply, candidates
        if reply:
            return reply, None
        return None, candidates
    except Exception:
        return None, None

@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    recordings = []
    if os.path.exists(UPLOAD_DIR):
        for f in os.listdir(UPLOAD_DIR):
            if f.endswith(".wav"):
                recordings.append({"name": f})
    
    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "recordings": recordings[::-1] # Newest first
    })

@app.get("/api-info")
async def api_info():
    return {"message": f"Audio Backend API ({API_VERSION})", "endpoints": ["/", "/health", "/upload", "/api-info", "/chat", "/chat/sessions", "/chat/session/{session_id}", "/appointments", "/appointments/book"]}

@app.post("/chat")
async def chat(payload: dict):
    session_id = str(payload.get("session_id") or "default")
    text = str(payload.get("text") or "")

    history = _CHAT_SESSIONS.get(session_id, [])
    state = _SESSION_STATE.get(session_id, {})
    enriched = _generate_response(text, history=history, state=state)
    reply = str(enriched.get("reply") or "")

    llm_reply, llm_candidates = _ollama_chat_generate(
        text=text,
        history=history,
        analysis=enriched.get("analysis") or {},
        action=enriched.get("action"),
        fallback_candidates=enriched.get("candidates") or [],
    )
    if llm_reply:
        reply = llm_reply
    if llm_candidates:
        enriched["candidates"] = llm_candidates

    history = history + [
        {"role": "user", "content": text},
        {"role": "assistant", "content": reply},
    ]
    _CHAT_SESSIONS[session_id] = history[-20:]
    _SESSION_STATE[session_id] = state

    if (enriched.get("action") or {}).get("type") == "BOOK_APPOINTMENT":
        details = ((enriched.get("action") or {}).get("details") or {})
        appt = {
            "id": str(uuid.uuid4())[:8],
            "session_id": session_id,
            "created_at": datetime.utcnow().isoformat() + "Z",
            "date": details.get("date"),
            "time": details.get("time"),
            "timezone": details.get("timezone"),
            "reason": details.get("reason"),
        }
        _APPOINTMENTS.append(appt)
        try:
            state.pop("pending_booking", None)
        except Exception:
            pass

    return {
        "session_id": session_id,
        "text": text,
        "reply": reply,
        "analysis": enriched.get("analysis"),
        "candidates": enriched.get("candidates"),
        "action": enriched.get("action"),
    }

@app.get("/appointments")
async def list_appointments():
    return {"appointments": list(reversed(_APPOINTMENTS[-50:]))}

@app.post("/appointments/book")
async def book_appointment(payload: dict):
    session_id = str(payload.get("session_id") or "default")
    date = str(payload.get("date") or "").strip() or None
    time = str(payload.get("time") or "").strip() or None
    timezone = str(payload.get("timezone") or "").strip() or None
    reason = str(payload.get("reason") or "").strip() or None

    if not date or not time:
        return {"ok": False, "error": "date and time are required"}

    appt = {
        "id": str(uuid.uuid4())[:8],
        "session_id": session_id,
        "created_at": datetime.utcnow().isoformat() + "Z",
        "date": date,
        "time": time,
        "timezone": timezone,
        "reason": reason,
    }
    _APPOINTMENTS.append(appt)
    try:
        (_SESSION_STATE.get(session_id) or {}).pop("pending_booking", None)
    except Exception:
        pass
    return {"ok": True, "appointment": appt}

@app.get("/chat/sessions")
async def chat_sessions():
    sessions = []
    for sid, msgs in _CHAT_SESSIONS.items():
        sessions.append(
            {
                "session_id": sid,
                "messages": len(msgs),
                "last_user": next((m["content"] for m in reversed(msgs) if m.get("role") == "user"), ""),
            }
        )
    sessions.sort(key=lambda x: x["messages"], reverse=True)
    return {"sessions": sessions}

@app.get("/chat/session/{session_id}")
async def chat_session(session_id: str):
    msgs = _CHAT_SESSIONS.get(session_id, [])
    user_msgs = [m.get("content", "") for m in msgs if m.get("role") == "user"]
    assistant_msgs = [m.get("content", "") for m in msgs if m.get("role") == "assistant"]
    return {
        "session_id": session_id,
        "messages": msgs,
        "analytics": {
            "turns": min(len(user_msgs), len(assistant_msgs)),
            "user_chars": sum(len(x) for x in user_msgs),
            "assistant_chars": sum(len(x) for x in assistant_msgs),
        },
    }

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/upload")
async def upload_audio(audio: UploadFile = File(None), file: UploadFile = File(None)):
    incoming = audio or file
    if incoming is None:
        return {"error": "No audio file provided. Use multipart field name 'audio'."}

    # Save the incoming file
    uid = str(uuid.uuid4())[:8]
    filename = incoming.filename or "audio.wav"
    file_path = os.path.join(UPLOAD_DIR, f"{uid}_{filename}")
    with open(file_path, "wb") as f:
        shutil.copyfileobj(incoming.file, f)

<<<<<<< HEAD
    try:
        # 1. Transcribe
        transcript = transcribe(input_path)
=======
    # Call the ai pipeline script (synchronous)
    # Note: we run pipeline.py which outputs response.wav in ai folder
    pipeline_script = os.path.join(AI_DIR, "pipeline.py")
    proc = subprocess.run([sys.executable, pipeline_script, file_path], capture_output=True, text=True)

        # 2. Query LLaMA
        reply_text = query_llama(transcript)

    # Assume ai/pipeline.py produced ai/response.wav (+ ai/response.json)
    audio_out = os.path.join(AI_DIR, "response.wav")
    meta_path = os.path.join(AI_DIR, "response.json")

    transcript = ""
    reply = ""
    try:
        if os.path.exists(meta_path):
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
            transcript = (meta.get("transcript") or "").strip()
            reply = (meta.get("reply") or "").strip()
    except Exception:
        pass

    headers = {
        "X-Transcript": transcript[:800],
        "X-Reply": reply[:800],
    }
    return FileResponse(audio_out, media_type="audio/wav", filename="response.wav", headers=headers)