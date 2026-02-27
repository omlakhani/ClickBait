import React, { useEffect, useMemo, useState } from 'react';

const API = 'http://127.0.0.1:8000';

function Pill({ children }) {
  return <span className="text-xs px-2 py-1 rounded-full bg-black/30 border border-white/5 text-gray-200">{children}</span>;
}

export default function ConversationsPage() {
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState('');
  const [messages, setMessages] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState('');

  const loadSessions = async () => {
    setError('');
    try {
      const res = await fetch(`${API}/chat/sessions`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSessions(data.sessions || []);
      if (!selected && data.sessions?.[0]?.session_id) {
        setSelected(data.sessions[0].session_id);
      }
    } catch {
      setError('Failed to load sessions. Is backend running on 127.0.0.1:8000?');
    }
  };

  const loadSession = async (sid) => {
    if (!sid) return;
    setError('');
    try {
      const res = await fetch(`${API}/chat/session/${sid}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages(data.messages || []);
      setAnalytics(data.analytics || null);
    } catch {
      setError('Failed to load session details.');
    }
  };

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadSession(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const selectedMeta = useMemo(() => sessions.find((s) => s.session_id === selected), [sessions, selected]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-3xl font-black tracking-tight">Conversations</div>
          <div className="text-sm text-gray-400 font-medium">Browse session history stored in the backend</div>
        </div>
        <button
          onClick={loadSessions}
          className="bg-white/5 hover:bg-white/10 border border-white/5 text-white font-semibold py-2 px-4 rounded-xl transition-all"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="bg-rose-500/20 border border-rose-300/30 text-rose-50 rounded-2xl p-3 text-sm">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        <div className="rounded-2xl bg-white/5 border border-white/5 p-4">
          <div className="text-sm font-bold mb-3">Sessions</div>
          <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
            {sessions.length ? (
              sessions.map((s) => (
                <button
                  key={s.session_id}
                  onClick={() => setSelected(s.session_id)}
                  className={`w-full text-left rounded-2xl p-3 border transition-all ${
                    selected === s.session_id
                      ? 'bg-gradient-to-r from-blue-600/30 to-purple-600/30 border-white/10'
                      : 'bg-black/20 border-white/5 hover:bg-black/30'
                  }`}
                >
                  <div className="text-xs text-gray-300 font-semibold">{s.session_id}</div>
                  <div className="text-sm text-white/90 mt-1 line-clamp-2">{s.last_user || '—'}</div>
                  <div className="mt-2 flex gap-2">
                    <Pill>{s.messages} msgs</Pill>
                  </div>
                </button>
              ))
            ) : (
              <div className="text-sm text-gray-400">No sessions yet. Use Voice Agent first.</div>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white/5 border border-white/5 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-bold">Session</div>
              <div className="text-xs text-gray-400 font-mono">{selectedMeta?.session_id || '—'}</div>
            </div>
            {analytics ? (
              <div className="flex gap-2 flex-wrap">
                <Pill>turns: {analytics.turns}</Pill>
                <Pill>user chars: {analytics.user_chars}</Pill>
                <Pill>agent chars: {analytics.assistant_chars}</Pill>
              </div>
            ) : null}
          </div>

          <div className="mt-4 space-y-3 max-h-[520px] overflow-auto pr-1">
            {messages.length ? (
              messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`rounded-2xl p-4 border ${
                    m.role === 'user' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-purple-500/10 border-purple-500/20'
                  }`}
                >
                  <div className="text-xs text-gray-300 font-semibold mb-2">{m.role === 'user' ? 'USER' : 'AGENT'}</div>
                  <div className="text-sm text-white/90 whitespace-pre-wrap">{m.content}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-400">Select a session to view messages.</div>
            )}
          </div>

          <div className="mt-4 rounded-2xl bg-black/30 border border-white/5 p-4 text-sm text-gray-300">
            <div className="font-semibold mb-2">Agents Used</div>
            Browser STT/TTS for voice I/O. Backend support agent for replies (FastAPI `/chat`).
          </div>
        </div>
      </div>
    </div>
  );
}
