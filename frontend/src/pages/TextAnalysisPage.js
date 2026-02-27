import React, { useMemo } from 'react';
import { useChat } from '../state/ChatContext';

function metric(label, value) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/5 p-4">
      <div className="text-xs text-gray-300 font-semibold">{label}</div>
      <div className="text-2xl font-black mt-1">{value}</div>
    </div>
  );
}

export default function TextAnalysisPage() {
  const { events } = useChat();

  const analysis = useMemo(() => {
    const user = events.filter((e) => e.type === 'user');
    const assistant = events.filter((e) => e.type === 'assistant');

    const userChars = user.reduce((a, b) => a + (b.text?.length || 0), 0);
    const assistantChars = assistant.reduce((a, b) => a + (b.text?.length || 0), 0);

    const allText = [...user, ...assistant].map((e) => e.text || '').join(' ');
    const words = allText.trim() ? allText.trim().split(/\s+/).length : 0;

    const topTerms = (() => {
      const stop = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'is', 'are', 'for', 'on', 'with', 'i', 'you', 'we', 'it', 'this', 'that']);
      const counts = new Map();
      for (const w of allText.toLowerCase().split(/[^a-z0-9]+/g)) {
        if (!w || w.length < 3) continue;
        if (stop.has(w)) continue;
        counts.set(w, (counts.get(w) || 0) + 1);
      }
      return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    })();

    return {
      turns: Math.min(user.length, assistant.length),
      userMsgs: user.length,
      assistantMsgs: assistant.length,
      userChars,
      assistantChars,
      words,
      topTerms,
    };
  }, [events]);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-3xl font-black tracking-tight">Text Analysis</div>
        <div className="text-sm text-gray-400 font-medium">Analytics computed locally from your chat history in this browser</div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {metric('Turns', analysis.turns)}
        {metric('User msgs', analysis.userMsgs)}
        {metric('Agent msgs', analysis.assistantMsgs)}
        {metric('User chars', analysis.userChars)}
        {metric('Agent chars', analysis.assistantChars)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl bg-white/5 border border-white/5 p-5">
          <div className="text-sm font-bold mb-3">Conversation Timeline</div>
          <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
            {events.length ? (
              events.slice().reverse().map((e, idx) => (
                <div key={idx} className={`rounded-2xl p-4 border ${e.type === 'user' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-purple-500/10 border-purple-500/20'}`}>
                  <div className="text-xs text-gray-300 font-semibold mb-2">{e.type === 'user' ? 'USER' : 'AGENT'}</div>
                  <div className="text-sm text-white/90 whitespace-pre-wrap">{e.text}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-400">No messages yet. Use the Voice Agent page first.</div>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white/5 border border-white/5 p-5">
          <div className="text-sm font-bold mb-3">Top Terms</div>
          <div className="flex flex-wrap gap-2">
            {analysis.topTerms.length ? (
              analysis.topTerms.map(([t, c]) => (
                <div key={t} className="px-3 py-2 rounded-xl bg-black/30 border border-white/5">
                  <div className="text-sm font-semibold">{t}</div>
                  <div className="text-xs text-gray-400">{c}x</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-400">No terms yet.</div>
            )}
          </div>

          <div className="mt-5 rounded-2xl bg-black/30 border border-white/5 p-4">
            <div className="text-xs text-gray-300 font-semibold">Agents Used</div>
            <div className="text-sm text-gray-400 mt-2 leading-relaxed">
              STT: Browser SpeechRecognition
              <br />
              Agent: Backend Support Agent (/chat)
              <br />
              TTS: Browser speechSynthesis
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
