import React, { useState } from 'react';
import { Bell, Check, Settings, Play, Pause, RefreshCw, Trash2, Heart, Star, Send } from 'lucide-react';

export default function ComponentShowcase() {
  const [toggle, setToggle] = useState(false);
  const [activeTab, setActiveTab] = useState('buttons');

  return (
    <div className="bg-gray-800 rounded-xl shadow-2xl p-8 w-full max-w-4xl animate-fade-in">
      <div className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
          UI Component Gallery
        </h2>
        <div className="flex space-x-2">
          {['buttons', 'switches', 'animations'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg capitalize transition-all duration-300 ${
                activeTab === tab
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-8">
        {activeTab === 'buttons' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/20">
              <Send size={18} /> <span>Primary</span>
            </button>
            <button className="flex items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-lg transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-purple-500/20">
              <Star size={18} /> <span>Secondary</span>
            </button>
            <button className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-lg transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-emerald-500/20">
              <Check size={18} /> <span>Success</span>
            </button>
            <button className="flex items-center justify-center space-x-2 bg-rose-600 hover:bg-rose-700 text-white p-3 rounded-lg transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-rose-500/20">
              <Trash2 size={18} /> <span>Danger</span>
            </button>
          </div>
        )}

        {activeTab === 'switches' && (
          <div className="flex flex-col space-y-6 items-center py-4">
            <div className="flex items-center space-x-4">
              <span className="text-gray-300">Default Toggle</span>
              <button
                onClick={() => setToggle(!toggle)}
                className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${toggle ? 'bg-blue-600' : 'bg-gray-600'}`}
              >
                <div
                  className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform duration-300 ${
                    toggle ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-gray-300">Icon Switch</span>
              <div onClick={() => setToggle(!toggle)} className="flex bg-gray-700 p-1 rounded-xl cursor-pointer">
                <div className={`p-2 rounded-lg transition-all ${!toggle ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400'}`}>
                  <Play size={20} />
                </div>
                <div className={`p-2 rounded-lg transition-all ${toggle ? 'bg-purple-600 text-white shadow-md' : 'text-gray-400'}`}>
                  <Pause size={20} />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'animations' && (
          <div className="grid grid-cols-2 gap-8 items-center justify-items-center py-4">
            <div className="p-8 bg-gray-700 rounded-full animate-spin-slow">
              <RefreshCw size={48} className="text-blue-400" />
            </div>
            <div className="p-8 bg-gray-700 rounded-full animate-bounce">
              <Heart size={48} className="text-rose-500 fill-rose-500" />
            </div>
            <div className="p-8 bg-gray-700 rounded-2xl animate-pulse">
              <Bell size={48} className="text-yellow-400" />
            </div>
            <div className="group relative cursor-pointer">
              <div className="absolute -inset-1 bg-gradient-to-r from-pink-600 to-purple-600 rounded-lg blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative px-7 py-4 bg-gray-800 rounded-lg leading-none flex items-center divide-x divide-gray-600">
                <span className="flex items-center space-x-5">
                  <Settings className="text-indigo-400 group-hover:rotate-90 transition-transform duration-500" size={24} />
                  <span className="pr-6 text-gray-100">Hover for Glow</span>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
