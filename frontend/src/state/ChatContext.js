import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const [sessionId] = useState(() => {
    const existing = localStorage.getItem('vf_session_id');
    if (existing) return existing;
    const sid = Math.random().toString(36).slice(2);
    localStorage.setItem('vf_session_id', sid);
    return sid;
  });

  const [events, setEvents] = useState(() => {
    try {
      const raw = localStorage.getItem('vf_events');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const pushEvent = useCallback((evt) => {
    setEvents((prev) => {
      const next = [...prev, { ...evt, ts: Date.now() }].slice(-200);
      localStorage.setItem('vf_events', JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo(() => ({ sessionId, events, pushEvent }), [sessionId, events, pushEvent]);

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
