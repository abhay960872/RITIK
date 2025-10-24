
import React, { useState, useCallback, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { useGeminiAssistant } from './hooks/useGeminiAssistant';
import { AssistantButton } from './components/AssistantButton';
import { LightIndicator } from './components/LightIndicator';
import { TimerView } from './components/TimerView';
import { VoiceSelector } from './components/VoiceSelector';
import { TranscriptView } from './components/TranscriptView';
import { HistoryPanel } from './components/HistoryPanel';
import { SplashScreen } from './components/SplashScreen';
import type { Voice, AppMode } from './types';

const VOICE_OPTIONS: Voice[] = [
  { id: 'Kore', name: 'Kore', description: 'Bright' },
  { id: 'Puck', name: 'Puck', description: 'Playful' },
  { id: 'Charon', name: 'Charon', description: 'Deep' },
  { id: 'Fenrir', name: 'Fenrir', description: 'Strong' },
  { id: 'Zephyr', name: 'Zephyr', description: 'Calm' },
];

const ApiKeySelector: React.FC<{
  onSelectKey: () => void;
  isVerifying: boolean;
  error: string | null;
}> = ({ onSelectKey, isVerifying, error }) => {
  return (
    <div className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center text-center p-4">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl max-w-md w-full border border-slate-700">
        <h2 className="text-2xl font-bold text-slate-100 mb-3">API Key Required</h2>
        <p className="text-slate-400 mb-6">
          This application requires a valid Gemini API key to function. Please select an API key to proceed.
        </p>

        {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 text-sm rounded-lg p-3 mb-4 text-left">
                <p className="font-semibold">Verification Failed</p>
                <p>{error}</p>
            </div>
        )}

        <button
          onClick={onSelectKey}
          disabled={isVerifying}
          className="w-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-blue-500/50 disabled:bg-slate-600 disabled:cursor-not-allowed"
        >
          {isVerifying ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Verifying...
            </>
          ) : (
            'Select API Key'
          )}
        </button>
        <p className="text-xs text-slate-500 mt-4">
          For more information on billing, visit the{' '}
          <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
            billing documentation
          </a>.
        </p>
      </div>
    </div>
  );
};


const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'INITIALIZING' | 'NEEDS_SELECTION' | 'VERIFYING' | 'READY'>('INITIALIZING');
  const [verificationError, setVerificationError] = useState<string | null>(null);

  useEffect(() => {
    const welcomeShown = sessionStorage.getItem('welcomeShown');
    if (!welcomeShown) {
      setShowSplash(true);
      const timer = setTimeout(() => {
        setShowSplash(false);
        sessionStorage.setItem('welcomeShown', 'true');
      }, 2500); // Show splash for 2.5 seconds

      return () => clearTimeout(timer);
    }
  }, []);

  const handleApiKeyError = useCallback(() => {
    setKeyStatus('NEEDS_SELECTION');
    setVerificationError("An API error occurred. Your key might be invalid, rate-limited, or expired. Please select a new key.");
  }, []);
  
  const verifyAndSetKey = useCallback(async () => {
    setKeyStatus('VERIFYING');
    setVerificationError(null);
    
    await new Promise(resolve => setTimeout(resolve, 100));

    if (!process.env.API_KEY) {
      setVerificationError("No API key was selected. Please try again.");
      setKeyStatus('NEEDS_SELECTION');
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: 'hi' });
      setKeyStatus('READY');
    } catch (e: any) {
      console.error("API Key verification failed:", e);
      if (e.message?.includes('permission denied') || e.message?.includes('API key not valid')) {
        setVerificationError("The selected API key is invalid or lacks permissions. Please select a different key.");
      } else if (e.message?.includes('RESOURCE_EXHAUSTED')) {
        setVerificationError("This key has exceeded its free request limit. Please wait a minute, or select a different key.");
      } else {
        setVerificationError("Could not connect to the API. Check your network and try again.");
      }
      setKeyStatus('NEEDS_SELECTION');
    }
  }, []);

  useEffect(() => {
    const checkAndVerifyKey = async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
        await verifyAndSetKey();
      } else {
        setKeyStatus('NEEDS_SELECTION');
      }
    };
    
    if (keyStatus === 'INITIALIZING' && !showSplash) {
        checkAndVerifyKey();
    }
  }, [keyStatus, showSplash, verifyAndSetKey]);

  const {
    isRecording,
    isResponding,
    error,
    toggleAssistant,
    lightState,
    timers,
    clearTimer,
    userName,
    transcripts,
    interimTranscript,
    history,
    loadHistoryItem,
    startNewChat,
    deleteHistoryItem,
  } = useGeminiAssistant(handleApiKeyError);
  
  const [selectedVoice, setSelectedVoice] = useState<string>('Kore');
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(true);
  const [mode, setMode] = useState<AppMode>('assistant');
  
  useEffect(() => {
    if (keyStatus === 'READY') {
        startNewChat();
    }
  }, [keyStatus, startNewChat]);

  const handleSelectKey = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      try {
        await window.aistudio.openSelectKey();
        await verifyAndSetKey();
      } catch (e) {
        console.error("Failed to open API key selection dialog:", e);
        setVerificationError("The API key selection dialog could not be opened. Please refresh and try again.");
        setKeyStatus('NEEDS_SELECTION');
      }
    } else {
      setVerificationError("This application requires an environment with API key selection support.");
      setKeyStatus('NEEDS_SELECTION');
    }
  };
  
  if (showSplash) {
    return <SplashScreen />;
  }

  if (keyStatus !== 'READY') {
    if (keyStatus === 'INITIALIZING') {
        return (
             <div className="fixed inset-0 bg-slate-900 flex items-center justify-center">
                 <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                 </svg>
            </div>
        );
    }
    return <ApiKeySelector onSelectKey={handleSelectKey} isVerifying={keyStatus === 'VERIFYING'} error={verificationError} />;
  }

  const getStatusMessage = () => {
    if (isRecording && !isResponding) return "Listening...";
    if (isResponding) return "Thinking...";
    if (mode === 'answer') return "Tap to ask anything";
    return "Tap to start";
  };
  
  const getSubtitle = () => {
    if (userName) return `Ready to talk, ${userName}.`;
    if (mode === 'answer') return "Powered by Google Search.";
    return 'Your personal AI, ready to talk.';
  }

  return (
    <div className="relative flex h-screen w-full bg-slate-900 overflow-hidden">
      {isHistoryPanelOpen && (
        <div 
          onClick={() => setIsHistoryPanelOpen(false)}
          className="fixed inset-0 z-10 bg-black/60 md:hidden"
          aria-hidden="true"
        ></div>
      )}
      <HistoryPanel 
        isOpen={isHistoryPanelOpen}
        history={history}
        onSelectItem={loadHistoryItem}
        onNewChat={startNewChat}
        onDeleteItem={deleteHistoryItem}
        isSessionActive={isRecording || isResponding}
      />

      <div className="flex flex-col flex-1 h-screen w-full items-center justify-between p-2 sm:p-4 overflow-hidden">
        <header className="w-full max-w-4xl mx-auto text-center py-2 sm:py-4 flex justify-between items-center">
          <div className="flex-1 flex justify-start">
              <button 
                onClick={() => setIsHistoryPanelOpen(!isHistoryPanelOpen)} 
                className="p-2 rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
                aria-label="Toggle history panel"
              >
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7"></path></svg>
              </button>
          </div>
          <div className="flex flex-col items-center">
              <h1 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
              Apna Assistant
              </h1>
              <p className="text-slate-400 mt-1">{getSubtitle()}</p>
          </div>
          <div className="flex-1 flex justify-end items-center">
            {mode === 'assistant' && <LightIndicator isOn={lightState.isOn} brightness={lightState.brightness} />}
          </div>
        </header>

        <main className="flex-grow w-full max-w-4xl mx-auto overflow-y-auto flex flex-col">
          {mode === 'assistant' && <TimerView timers={timers} onClear={clearTimer} />}
          
          {transcripts.length === 0 && interimTranscript.user === '' && interimTranscript.assistant === '' && timers.length === 0 && (
             <div className="flex-grow flex items-center justify-center">
                {/* Empty state can be used for a logo or welcome message */}
             </div>
          )}

          <TranscriptView transcripts={transcripts} interimTranscript={interimTranscript} />
          {error && <div className="text-center text-red-500 p-4 bg-red-900/20 rounded-lg mt-4">{error}</div>}
        </main>

        <footer className="w-full flex flex-col items-center justify-center pt-2 sm:pt-4">
          <div className="flex items-center space-x-2 mb-4">
            <button 
              onClick={() => setMode('assistant')}
              disabled={isRecording || isResponding}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors disabled:opacity-50 ${mode === 'assistant' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              Apna Assistant
            </button>
             <button 
              onClick={() => setMode('answer')}
              disabled={isRecording || isResponding}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors disabled:opacity-50 ${mode === 'answer' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              Ask Anything
            </button>
          </div>

          {mode === 'assistant' && (
            <VoiceSelector 
                options={VOICE_OPTIONS}
                selectedValue={selectedVoice}
                onValueChange={setSelectedVoice}
                disabled={isRecording || isResponding}
            />
          )}
          <div className="h-4 sm:h-6" />
          <AssistantButton
            isRecording={isRecording}
            isResponding={isResponding}
            onClick={() => toggleAssistant(selectedVoice, mode)}
          />
          <p className="text-slate-400 mt-3 sm:mt-4 text-sm font-medium">{getStatusMessage()}</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
