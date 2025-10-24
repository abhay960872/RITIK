import React, { useState, useRef, useEffect } from 'react';
import type { Voice } from '../types';

interface VoiceSelectorProps {
  options: Voice[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  disabled: boolean;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({ options, selectedValue, onValueChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [synthVoices, setSynthVoices] = useState<SpeechSynthesisVoice[]>([]);

  const selectedOption = options.find(opt => opt.id === selectedValue);
  
  // Load browser voices
  useEffect(() => {
    const loadVoices = () => {
        setSynthVoices(window.speechSynthesis.getVoices());
    };
    // Voices load asynchronously
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices(); // Initial load

    return () => {
        window.speechSynthesis.onvoiceschanged = null;
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (id: string) => {
    onValueChange(id);
    setIsOpen(false);
  };

  const playPreview = (e: React.MouseEvent, voiceName: string) => {
    e.stopPropagation();

    const utterance = new SpeechSynthesisUtterance("Hello dear, how can I help you?");

    // This is a rough, best-effort mapping of the assistant's conceptual voices
    // to the limited set of voices available in the user's browser.
    let selectedSynthVoice: SpeechSynthesisVoice | undefined;
    const enVoices = synthVoices.filter(v => v.lang.startsWith('en'));
    
    if (enVoices.length > 0) {
        switch(voiceName) {
            case 'Kore': // Bright (often female, higher pitch)
                selectedSynthVoice = enVoices.find(v => v.name.includes('Google') && v.name.includes('Female')) || enVoices.find(v => v.name.includes('Female'));
                break;
            case 'Puck': // Playful (can try a different accent)
                selectedSynthVoice = enVoices.find(v => v.lang === 'en-GB' && !v.name.includes('Male')) || enVoices.find(v => v.name.includes('Samantha'));
                break;
            case 'Charon': // Deep (male)
                selectedSynthVoice = enVoices.find(v => v.name.includes('Google') && v.name.includes('Male')) || enVoices.find(v => v.name.includes('Male'));
                break;
            case 'Fenrir': // Strong (can try a different accent)
                 selectedSynthVoice = enVoices.find(v => v.lang === 'en-GB' && v.name.includes('Male')) || enVoices.find(v => v.name.includes('Daniel'));
                break;
            case 'Zephyr': // Calm (standard US female)
                 selectedSynthVoice = enVoices.find(v => v.lang === 'en-US' && v.name.includes('Female')) || enVoices[0];
                break;
        }
    }

    utterance.voice = selectedSynthVoice || enVoices[0]; // Fallback to first english voice
    
    window.speechSynthesis.cancel(); // Cancel any previous speech
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="relative w-full max-w-xs" ref={wrapperRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-800 border border-slate-700 rounded-md shadow-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <div className="flex items-center">
            <svg className="w-5 h-5 mr-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5L6 9H2v6h4l5 4V5zM15.536 8.464a5 5 0 010 7.072"></path></svg>
            <span className="font-medium">{selectedOption?.name || 'Select Voice'}</span>
            <span className="text-slate-400 ml-2 text-sm">({selectedOption?.description})</span>
        </div>
        <svg className={`w-5 h-5 text-slate-400 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} xmlns="http://www.w.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-lg bottom-full mb-1 animate-fade-in-up">
          <ul className="py-1">
            {options.map(option => (
              <li
                key={option.id}
                onClick={() => handleSelect(option.id)}
                className={`flex items-center justify-between px-3 py-2 text-slate-200 hover:bg-slate-700 cursor-pointer transition-colors ${selectedValue === option.id ? 'bg-blue-600/30' : ''}`}
              >
                <div className="flex items-center">
                  <span className={`w-5 h-5 mr-3 transition-opacity ${selectedValue === option.id ? 'opacity-100' : 'opacity-0'}`}>
                    <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                  </span>
                  <span>{option.name} <span className="text-slate-400 text-sm">({option.description})</span></span>
                </div>
                <button
                    onClick={(e) => playPreview(e, option.id)}
                    className="p-1 rounded-full hover:bg-slate-600 text-slate-400 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label={`Preview ${option.name} voice`}
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"></path></svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};