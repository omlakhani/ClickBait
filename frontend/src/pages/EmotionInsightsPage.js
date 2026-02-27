import React, { useEffect, useRef, useState } from 'react';

function clamp01(x) {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function classifyEmotion({ energy, zcr }) {
  // Heuristic: energy ~ loudness, zcr ~ "brightness"/pitch proxy
  if (energy > 0.55 && zcr > 0.18) return { label: 'Excited', color: 'text-pink-300' };
  if (energy > 0.55 && zcr <= 0.18) return { label: 'Stressed / Intense', color: 'text-rose-300' };
  if (energy <= 0.30 && zcr <= 0.14) return { label: 'Calm', color: 'text-emerald-300' };
  return { label: 'Neutral / Focused', color: 'text-sky-300' };
}

export default function EmotionInsightsPage() {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [energy, setEnergy] = useState(0);
  const [zcr, setZcr] = useState(0);

  const rafRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const dataRef = useRef(null);

  const start = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.75;
      analyserRef.current = analyser;

      source.connect(analyser);

      const buf = new Float32Array(analyser.fftSize);
      dataRef.current = buf;

      setRunning(true);
    } catch (e) {
      setError('Microphone permission denied or not available.');
      setRunning(false);
    }
  };

  const stop = async () => {
    setRunning(false);

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    try {
      streamRef.current?.getTracks()?.forEach((t) => t.stop());
    } catch {
      // ignore
    }

    try {
      await audioCtxRef.current?.close();
    } catch {
      // ignore
    }

    streamRef.current = null;
    audioCtxRef.current = null;
    analyserRef.current = null;
    dataRef.current = null;
  };

  useEffect(() => {
    if (!running) return;

    const tick = () => {
      const analyser = analyserRef.current;
      const buf = dataRef.current;
      if (!analyser || !buf) return;

      analyser.getFloatTimeDomainData(buf);

      // RMS energy
      let sumSq = 0;
      for (let i = 0; i < buf.length; i += 1) sumSq += buf[i] * buf[i];
      const rms = Math.sqrt(sumSq / buf.length);

      // Zero Crossing Rate (pitch/brightness proxy)
      let crossings = 0;
      for (let i = 1; i < buf.length; i += 1) {
        if ((buf[i - 1] >= 0 && buf[i] < 0) || (buf[i - 1] < 0 && buf[i] >= 0)) crossings += 1;
      }
      const z = crossings / buf.length;

      setEnergy(clamp01(rms * 3.2));
      setZcr(clamp01(z * 8));

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [running]);

  useEffect(() => {
    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emotion = classifyEmotion({ energy, zcr });

  return (
    <div className="space-y-6">
      <div>
        <div className="text-3xl font-black tracking-tight">Emotion Insights</div>
        <div className="text-sm text-gray-400 font-medium">
          Local heuristic demo based on mic energy + pitch proxy (zero-crossing). Not a medical classifier.
        </div>
      </div>

      {error ? (
        <div className="bg-rose-500/20 border border-rose-300/30 text-rose-50 rounded-2xl p-3 text-sm">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white/5 border border-white/5 p-5">
          <div className="text-xs text-gray-300 font-semibold mb-2">Detected State</div>
          <div className={`text-2xl font-black ${emotion.color}`}>{emotion.label}</div>
          <div className="text-xs text-gray-400 mt-2">
            Updates live while mic is running.
          </div>
        </div>

        <div className="rounded-2xl bg-white/5 border border-white/5 p-5">
          <div className="text-xs text-gray-300 font-semibold mb-2">Energy (loudness proxy)</div>
          <div className="text-2xl font-black">{Math.round(energy * 100)}%</div>
          <div className="mt-3 h-2 rounded-full bg-black/30 overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-emerald-400 to-rose-500" style={{ width: `${Math.round(energy * 100)}%` }} />
          </div>
        </div>

        <div className="rounded-2xl bg-white/5 border border-white/5 p-5">
          <div className="text-xs text-gray-300 font-semibold mb-2">Pitch Proxy (ZCR)</div>
          <div className="text-2xl font-black">{Math.round(zcr * 100)}%</div>
          <div className="mt-3 h-2 rounded-full bg-black/30 overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-sky-400 to-purple-500" style={{ width: `${Math.round(zcr * 100)}%` }} />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        {!running ? (
          <button
            onClick={start}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-3 px-5 rounded-2xl shadow-xl transition-all duration-300 active:scale-95"
          >
            Start Mic
          </button>
        ) : (
          <button
            onClick={stop}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-5 rounded-2xl shadow-xl transition-all duration-300 active:scale-95"
          >
            Stop Mic
          </button>
        )}
      </div>

      <div className="rounded-2xl bg-amber-500/10 border border-amber-300/20 p-4 text-sm text-amber-50">
        This page uses browser WebAudio features only. It does not send audio to your backend.
      </div>
    </div>
  );
}
