import React, { useState, useRef } from 'react';
import { Mic, Square } from 'lucide-react';

function App() {
  const [status, setStatus] = useState('idle');
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const startRecording = async () => {
    setStatus('recording');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream);
    chunksRef.current = [];
    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };
    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
      setStatus('uploading');
      const formData = new FormData();
      formData.append('audio', blob, 'recording.wav');
      try {
        const response = await fetch('http://127.0.0.1:8000/upload', {
          method: 'POST',
          body: formData,
        });
        if (response.ok) {
          const audioBlob = await response.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          setStatus('playing');
          const audio = new Audio(audioUrl);
          audio.play();
          audio.onended = () => setStatus('idle');
        } else {
          setStatus('idle');
        }
      } catch (error) {
        setStatus('idle');
      }
    };
    mediaRecorderRef.current.start();
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-2xl p-8 max-w-md mx-auto">
        <h1 className="text-white text-3xl font-bold text-center mb-6">Audio Recorder</h1>
        <p className={`text-center text-xl mb-8 ${status === 'idle' ? 'text-green-300' : status === 'recording' ? 'text-red-300 animate-pulse' : status === 'uploading' ? 'text-blue-300' : 'text-purple-300 animate-bounce'}`}>Status: {status}</p>
        <div className="flex justify-center space-x-4">
          <button onClick={startRecording} disabled={status !== 'idle'} className="bg-green-500 hover:bg-green-600 disabled:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center">
            <Mic className="mr-2" /> Start Recording
          </button>
          <button onClick={stopRecording} disabled={status !== 'recording'} className="bg-red-500 hover:bg-red-600 disabled:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center">
            <Square className="mr-2" /> Stop Recording
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
