import React from 'react';

interface AssistantButtonProps {
  isRecording: boolean;
  isResponding: boolean;
  onClick: () => void;
}

export const AssistantButton: React.FC<AssistantButtonProps> = ({ isRecording, isResponding, onClick }) => {
  const isListening = isRecording && !isResponding;
  const isIdle = !isRecording && !isResponding;

  return (
    <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center">
      {isListening && (
        <>
            <div className="absolute inset-0 rounded-full bg-blue-500/50 animate-wave" style={{ animationDelay: '0s' }}></div>
            <div className="absolute inset-0 rounded-full bg-blue-500/50 animate-wave" style={{ animationDelay: '0.5s' }}></div>
        </>
      )}
      <button
        onClick={onClick}
        className={`relative flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-slate-700 to-slate-800 rounded-full shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-500/50 transition-all duration-200 ease-in-out hover:scale-105 active:scale-95 ${isIdle ? 'animate-pulse-button' : ''}`}
        aria-label={isRecording ? 'Stop Assistant' : 'Start Assistant'}
      >
        <div className="absolute inset-0 rounded-full bg-black/10 backdrop-blur-sm"></div>
        <div className="relative z-10">
           <svg className={`w-7 h-7 sm:w-8 sm:h-8 text-white transition-transform duration-200 ${isResponding ? 'animate-pulse-icon' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
          </svg>
        </div>
      </button>
    </div>
  );
};