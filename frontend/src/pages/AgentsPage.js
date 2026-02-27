import React from 'react';
import { BrainCircuit, Mic, Speaker, Wand2, Server } from 'lucide-react';

function Card({ icon: Icon, title, subtitle, items }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/5 p-5">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <Icon size={18} />
        </div>
        <div>
          <div className="text-lg font-black">{title}</div>
          <div className="text-sm text-gray-400 font-medium">{subtitle}</div>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {items.map((x) => (
          <div key={x} className="text-sm text-gray-200 bg-black/30 border border-white/5 rounded-xl px-3 py-2">
            {x}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-3xl font-black tracking-tight">AI Agents Map</div>
        <div className="text-sm text-gray-400 font-medium">Which “agent” is used for which element and why</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card
          icon={Mic}
          title="STT Agent (Speech-to-Text)"
          subtitle="Converts voice input to text"
          items={[
            'No-download mode: Browser SpeechRecognition (fast, simple demo)',
            'Local mode (optional): Whisper (higher accuracy, runs locally, heavier install)',
          ]}
        />

        <Card
          icon={BrainCircuit}
          title="Conversation Agent (Reasoning)"
          subtitle="Generates contextual support replies"
          items={[
            'No-download mode: FastAPI /chat heuristic support agent (intent + clarifying questions)',
            'Local mode (optional): LLaMA 3 via Ollama (higher quality responses for reply text)',
          ]}
        />

        <Card
          icon={Server}
          title="LLM Provider (Ollama)"
          subtitle="Local LLaMA 3 for reply generation (optional)"
          items={[
            'Used by backend /chat to generate: reply + candidates (actions stay deterministic)',
            'Default URL: http://127.0.0.1:11434  (POST /api/chat)',
            'Default model: llama3',
            'Enable with env: USE_OLLAMA_CHAT=true (optional: OLLAMA_URL, OLLAMA_MODEL, OLLAMA_TIMEOUT_S)',
          ]}
        />

        <Card
          icon={Speaker}
          title="TTS Agent (Text-to-Speech)"
          subtitle="Turns the AI reply into spoken audio"
          items={[
            'No-download mode: Browser speechSynthesis (instant, zero setup)',
            'Local mode (optional): Coqui TTS (offline, better control, heavier install)',
          ]}
        />

        <Card
          icon={Wand2}
          title="Analytics Agents"
          subtitle="Insights and dashboards"
          items={[
            'Emotion page: WebAudio energy + pitch proxy (heuristic, local)',
            'Text analysis: local metrics + top terms',
            'Conversations: backend session store + browsing',
          ]}
        />
      </div>

      <div className="rounded-2xl bg-amber-500/10 border border-amber-300/20 p-4 text-sm text-amber-50">
        Emotion detection is a heuristic demo (energy + pitch proxy). It is not a medical/psychological classifier.
      </div>
    </div>
  );
}
