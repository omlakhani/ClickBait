import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Send, Square, Settings } from 'lucide-react';
import { useChat } from '../state/ChatContext';

const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8001').replace(/\/$/, '');

export default function VoiceAgentPage() {
  const { sessionId, pushEvent } = useChat();

  const [status, setStatus] = useState('idle');
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [analysis, setAnalysis] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [action, setAction] = useState(null);
  const [error, setError] = useState('');
  const [textDraft, setTextDraft] = useState('');
  const [ttsEnabled, setTtsEnabled] = useState(true);

  const recognitionRef = useRef(null);
  const finalTextRef = useRef('');
  const autoSentRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const isSpeechApiAvailable = useMemo(() => {
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }, []);

  useEffect(() => {
    if (!isSpeechApiAvailable) return;

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new Recognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.maxAlternatives = 3;

    rec.onstart = () => {
      setError('');
      setStatus('listening');
      finalTextRef.current = '';
      autoSentRef.current = false;
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    };

    rec.onresult = (event) => {
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const res = event.results[i];
        const txt = res[0]?.transcript || '';
        if (res.isFinal) finalTextRef.current += `${txt} `;
        else interimText += txt;
      }

      const combined = `${finalTextRef.current} ${interimText}`.trim();
      setTranscript(combined);

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        try {
          recognitionRef.current?.stop();
        } catch {
          // ignore
        }
      }, 500);
    };

    rec.onerror = (e) => {
      setStatus('idle');
      setError(e?.error ? `Speech error: ${e.error}` : 'Speech recognition error');
    };

    rec.onend = () => {
      setStatus((s) => (s === 'listening' ? 'idle' : s));
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      const finalT = (finalTextRef.current || '').trim();
      if (finalT && !autoSentRef.current) {
        autoSentRef.current = true;
        setTranscript(finalT);
        // Execute the async call in a safe wrapper
        const triggerBackend = async () => {
          try {
            await sendToBackend(finalT, { auto: true });
          } catch (err) {
            console.error('Async send error:', err);
          }
        };
        triggerBackend();
      }
    };

    recognitionRef.current = rec;
  }, [isSpeechApiAvailable]);

  const speak = (text) => {
    if (!ttsEnabled) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.02;
      u.pitch = 1.0;
      u.onstart = () => setStatus('speaking');
      u.onend = () => setStatus('idle');
      window.speechSynthesis.speak(u);
    } catch (e) {
      setStatus('idle');
      setError('TTS failed in this browser');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await uploadAudio(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setStatus('listening');
    } catch (err) {
      setError('Microphone access denied or not available.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setStatus('thinking');
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const uploadAudio = async (blob) => {
    setIsProcessing(true);
    setStatus('thinking');
    const formData = new FormData();
    formData.append('file', blob, 'recording.webm');
    formData.append('session_id', sessionId);

    try {
      const res = await fetch(`${BACKEND_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const transcript = res.headers.get('X-Transcript') || '';
      const replyText = res.headers.get('X-Reply') || '';
      
      setTranscript(transcript);
      setReply(replyText);
      setIsProcessing(false);
      setStatus('idle');
      
      const audioBlob = await res.blob();
      if (audioBlob.size > 0) {
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio();
        audio.src = audioUrl;
        audio.type = "audio/wav";
        
        audio.oncanplaythrough = () => {
          audio.play()
            .then(() => console.log("Audio playing..."))
            .catch(e => {
              console.error("Audio play blocked/failed:", e);
              setError("Click to enable audio playback.");
            });
        };

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
        };

        audio.onerror = (e) => {
          console.error("Audio loading error:", e);
          setError("Generated audio failed to load.");
          URL.revokeObjectURL(audioUrl);
        };
      }
    } catch (err) {
      setIsProcessing(false);
      setStatus('idle');
      setError('Failed to process voice input.');
    }
  };

  const startListening = async () => {
    await startRecording();
  };

  const stopListening = () => {
    stopRecording();
  };

  const cleanTranscript = (text) => {
    return text
      .replace(/\b(i need to|can you|please|i want to|could you|help me to|i would like to|um|uh|ah)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const sendToBackend = async (textArg, opts) => {
    const rawText = ((typeof textArg === 'string' ? textArg : transcript) || '').trim();
    const text = cleanTranscript(rawText);
    
    if (!text) {
      setError('Say something first, then try again.');
      return;
    }

    setIsProcessing(true);
    setStatus('thinking');
    setError('');

    pushEvent({ type: 'user', text });

    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, text }),
      });

      if (!res.ok) {
        setStatus('idle');
        setError(`Backend error (${res.status})`);
        return;
      }

      const data = await res.json();
      setIsProcessing(false);
      const r = (data?.reply || '').toString();
      setReply(r);
      setAnalysis(data?.analysis || null);
      setCandidates(Array.isArray(data?.candidates) ? data.candidates : []);
      const nextAction = data?.action || null;
      setAction(nextAction);
      pushEvent({ type: 'assistant', text: r });
      speak(r);

      if ((opts?.auto || false) && nextAction?.type === 'OPEN_URL') {
        const url = (nextAction.url || '').toString();
        if (url) {
          const ok = !nextAction.confirmation_required || window.confirm(`Open this website?\n\n${url}`);
          if (ok) {
            pushEvent({ type: 'action', text: `OPEN_URL ${url}` });
            window.open(url, '_blank', 'noopener,noreferrer');
          }
        }
      }
    } catch (e) {
      setIsProcessing(false);
      setStatus('idle');
      setError('Failed to reach backend. Is it running on 127.0.0.1:8001?');
    }
  };

  const runAction = async () => {
    if (!action || !action.type) return;

    if (action.type === 'OPEN_URL') {
      const url = (action.url || '').toString();
      if (!url) return;
      const ok = !action.confirmation_required || window.confirm(`Open this website?\n\n${url}`);
      if (!ok) return;

      pushEvent({ type: 'action', text: `OPEN_URL ${url}` });
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    if (action.type === 'BOOK_APPOINTMENT') {
      const details = action.details || {};
      pushEvent({ type: 'action', text: `BOOK_APPOINTMENT ${details.date || ''} ${details.time || ''}` });
      return;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-3xl font-black tracking-tight">Voice Agent</div>
          <div className="text-sm text-gray-400 font-medium">Whisper + GPT-4o powered personal assistant</div>
        </div>
        <a 
          href={BACKEND_URL} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/10 transition-all font-semibold"
        >
          <Settings size={18} />
          Admin Panel
        </a>
      </div>

      <div className="rounded-2xl bg-white/5 border border-white/5 p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm font-bold">Text Input (Testing)</div>
            <div className="text-xs text-gray-400 font-medium">Type a message, send to backend, and optionally hear TTS</div>
          </div>

          <button
            onClick={() => setTtsEnabled((v) => !v)}
            className={`px-4 py-2 rounded-xl border transition-all font-semibold ${
              ttsEnabled
                ? 'bg-emerald-500/15 border-emerald-300/20 text-emerald-50 hover:bg-emerald-500/20'
                : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'
            }`}
            type="button"
          >
            {ttsEnabled ? 'TTS: ON' : 'TTS: OFF'}
          </button>
        </div>

        <div className="mt-4 flex gap-3 flex-wrap">
          <input
            value={textDraft}
            onChange={(e) => setTextDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const msg = (textDraft || '').trim();
                if (!msg) return;
                setTranscript(msg);
                setTextDraft('');
                sendToBackend(msg);
              }
            }}
            placeholder="Type here (e.g. open amazon website, book appointment...)"
            className="flex-1 min-w-[240px] bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-500 outline-none focus:border-white/20"
          />
            <button
              onClick={() => {
                const msg = (textDraft || '').trim();
                if (!msg) return;
                setTranscript(msg);
                setTextDraft('');
                sendToBackend(msg);
              }}
              disabled={status !== 'idle' || isProcessing}
              className="bg-white hover:bg-blue-50 disabled:bg-gray-200 text-blue-700 font-bold py-3 px-6 rounded-2xl shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 flex items-center gap-2"
              type="button"
            >
              {isProcessing ? <div className="w-4 h-4 border-2 border-blue-700 border-t-transparent rounded-full animate-spin"></div> : <Send size={18} />}
              Send
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white/5 border border-white/5 p-5">
          <div className="text-xs text-gray-300 font-semibold mb-2">YOU SAID</div>
          <div className="text-white text-lg font-semibold min-h-[44px]">{transcript || '—'}</div>
        </div>
        <div className="rounded-2xl bg-white/5 border border-white/5 p-5">
          <div className="text-xs text-gray-300 font-semibold mb-2">AGENT REPLY</div>
          <div className="text-white text-lg font-semibold min-h-[44px]">{reply || '—'}</div>
        </div>
      </div>

      {analysis ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white/5 border border-white/5 p-5">
            <div className="text-xs text-gray-300 font-semibold mb-2">INTENT</div>
            <div className="text-white text-lg font-black">{analysis.intent || '—'}</div>
            <div className="text-xs text-gray-400 mt-2">Confidence: {Math.round((analysis.confidence || 0) * 100)}%</div>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/5 p-5 lg:col-span-2">
            <div className="text-xs text-gray-300 font-semibold mb-2">ENTITIES</div>
            <div className="text-sm text-gray-200 font-mono whitespace-pre-wrap">{JSON.stringify(analysis.entities || {}, null, 2)}</div>
          </div>
        </div>
      ) : null}

      {analysis?.followups?.length ? (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-300/20 p-4">
          <div className="text-xs text-amber-100 font-semibold mb-2">FOLLOW-UP QUESTIONS</div>
          <div className="space-y-2">
            {analysis.followups.map((q, idx) => (
              <div key={idx} className="text-sm text-amber-50">{q}</div>
            ))}
          </div>
        </div>
      ) : null}

      {candidates.length > 1 ? (
        <div className="rounded-2xl bg-white/5 border border-white/5 p-5">
          <div className="text-xs text-gray-300 font-semibold mb-3">ALTERNATE REPLIES (CANDIDATES)</div>
          <div className="space-y-2">
            {candidates.slice(0, 4).map((c, idx) => (
              <div key={idx} className="text-sm text-gray-200 bg-black/30 border border-white/5 rounded-xl px-3 py-2">
                {c}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {action?.type ? (
        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-300/20 p-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs text-emerald-100 font-semibold">SUGGESTED ACTION</div>
            <div className="text-sm text-emerald-50 mt-1 font-semibold">
              {action.type}{action.type === 'OPEN_URL' && action.url ? `: ${action.url}` : ''}
            </div>
          </div>
          <button
            onClick={runAction}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-4 rounded-xl shadow-xl transition-all duration-200 active:scale-95"
          >
            Run
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="bg-rose-500/20 border border-rose-300/30 text-rose-50 rounded-2xl p-3 text-sm">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className={`text-sm font-semibold ${status === 'idle' ? 'text-gray-300' : status === 'listening' ? 'text-yellow-200' : status === 'thinking' ? 'text-blue-200' : 'text-purple-200'}`}>
          {status.toUpperCase()}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={startListening}
            disabled={status !== 'idle'}
            className="group bg-white hover:bg-blue-50 disabled:bg-gray-200 text-blue-700 font-bold py-3 px-5 rounded-2xl shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center active:scale-95"
          >
            <Mic className={`mr-2 transition-transform duration-300 group-hover:scale-110 ${status === 'listening' ? 'animate-pulse' : ''}`} size={18} />
            Talk
          </button>

          <button
            onClick={stopListening}
            disabled={status !== 'listening'}
            className="group bg-red-500 hover:bg-red-600 disabled:bg-gray-200 text-white font-bold py-3 px-5 rounded-2xl shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center active:scale-95"
          >
            <Square className="mr-2" size={18} />
            Stop
          </button>

          <button
            onClick={() => sendToBackend()}
            disabled={status !== 'idle' || isProcessing}
            className="group bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-3 px-6 rounded-2xl shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center active:scale-95"
          >
            {isProcessing ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
            ) : (
              <Send className="mr-2" size={18} />
            )}
            Ask Agent
          </button>
        </div>
      </div>

      {!isSpeechApiAvailable ? (
        <div className="text-sm text-gray-300">
          SpeechRecognition is not available in this browser. Use Chrome or Edge.
        </div>
      ) : null}
    </div>
  );
}
