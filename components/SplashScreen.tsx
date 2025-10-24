import React from 'react';

export const SplashScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center text-center p-4 animate-fade-in">
      <div className="flex flex-col items-center gap-4">
        {/* Reusing the microphone icon from AssistantButton */}
        <div className="relative w-28 h-28 flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800 rounded-full shadow-lg animate-pulse-icon" style={{ animationDuration: '2s' }}>
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
          </svg>
        </div>
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          Apna Assistant
        </h1>
      </div>
    </div>
  );
};
