import React from 'react';
import { NavLink } from 'react-router-dom';
import { Activity, BrainCircuit, LayoutGrid, MessageSquareText, Mic, Sparkles } from 'lucide-react';

function Item({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${
          isActive
            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white border-white/10 shadow-lg'
            : 'text-gray-300 border-white/5 hover:bg-white/5 hover:text-white'
        }`
      }
    >
      <Icon size={18} />
      <span className="font-semibold">{label}</span>
    </NavLink>
  );
}

export default function NavShell({ children }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
          <aside className="bg-gray-900/60 border border-white/5 rounded-2xl p-4 shadow-2xl">
            <div className="flex items-center gap-3 px-2 pb-4 border-b border-white/5 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Sparkles size={18} />
              </div>
              <div>
                <div className="text-lg font-black tracking-tight">VocalFlow</div>
                <div className="text-xs text-gray-400 font-medium">Local Voice Assistant</div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Item to="/" icon={Mic} label="Voice Agent" />
              <Item to="/emotion" icon={Activity} label="Emotion Insights" />
              <Item to="/text" icon={MessageSquareText} label="Text Analysis" />
              <Item to="/conversations" icon={LayoutGrid} label="Conversations" />
              <Item to="/agents" icon={BrainCircuit} label="AI Agents Map" />
              <Item to="/showcase" icon={LayoutGrid} label="UI Showcase" />
            </div>

            <div className="mt-6 rounded-2xl bg-white/5 border border-white/5 p-4">
              <div className="text-xs text-gray-300 font-semibold mb-2">Agent Stack (No-Download Mode)</div>
              <div className="text-xs text-gray-400 leading-relaxed">
                Browser STT/TTS + Backend Support Agent.
              </div>
            </div>
          </aside>

          <main className="bg-gray-900/30 border border-white/5 rounded-2xl p-6 shadow-2xl">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
