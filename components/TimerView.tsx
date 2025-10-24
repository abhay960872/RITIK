import React, { useState, useEffect, useRef } from 'react';
import type { Timer } from '../types';

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
};

// A short, royalty-free beep sound encoded as a Base64 data URL.
const ALARM_SOUND_DATA_URL = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU' + Array(1e3).join('123');


const TimerCard: React.FC<{ timer: Timer; onClear: (id: string) => void }> = ({ timer, onClear }) => {
    const [remaining, setRemaining] = useState(timer.remaining);
    const alarmAudioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        const audio = new Audio(ALARM_SOUND_DATA_URL);
        audio.preload = 'auto';
        alarmAudioRef.current = audio;
    }, []);

    useEffect(() => {
        if (remaining <= 0) {
            alarmAudioRef.current?.play();
            const timeoutId = setTimeout(() => onClear(timer.id), 5000); // Clear after 5s
            return () => clearTimeout(timeoutId);
        }

        const intervalId = setInterval(() => {
            setRemaining(prev => prev - 1);
        }, 1000);

        return () => clearInterval(intervalId);
    }, [remaining, onClear, timer.id]);

    const isFinished = remaining <= 0;
    const progress = (timer.duration - remaining) / timer.duration * 100;

    return (
        <div className={`relative bg-slate-800 p-4 rounded-lg shadow-lg w-full sm:w-64 overflow-hidden transition-all duration-300 ${isFinished ? 'animate-pulse border-2 border-red-500' : 'border border-slate-700'}`}>
             <div 
                className={`absolute top-0 left-0 h-full bg-blue-600/20 transition-all duration-1000 ease-linear`}
                style={{ width: `${progress}%` }}
             />
            <div className="relative z-10">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold text-slate-200 truncate">{timer.label}</h3>
                    <button onClick={() => onClear(timer.id)} className="text-slate-500 hover:text-slate-300 text-xs font-bold">
                        &times;
                    </button>
                </div>
                <p className={`text-3xl sm:text-4xl font-mono font-bold ${isFinished ? 'text-red-500' : 'text-slate-50'}`}>
                    {isFinished ? "00:00:00" : formatTime(remaining)}
                </p>
                <p className="text-right text-sm text-slate-400">
                    {formatTime(timer.duration)}
                </p>
            </div>
        </div>
    );
};


export const TimerView: React.FC<{ timers: Timer[]; onClear: (id: string) => void }> = ({ timers, onClear }) => {
  if (timers.length === 0) return null;

  return (
    <div className="w-full flex justify-center p-2">
        <div className="flex flex-wrap gap-4 justify-center">
            {timers.map(timer => (
                <TimerCard key={timer.id} timer={timer} onClear={onClear} />
            ))}
        </div>
    </div>
  );
};