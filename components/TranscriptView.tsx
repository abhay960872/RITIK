
import React, { useEffect, useRef } from 'react';
import type { Transcript, InterimTranscript } from '../types';

interface TranscriptViewProps {
  transcripts: Transcript[];
  interimTranscript: InterimTranscript;
}

const TranscriptMessage: React.FC<{ transcript: Transcript }> = ({ transcript }) => {
  const { speaker, text, sources } = transcript;

  if (speaker === 'system') {
    return (
        <div className="flex justify-center mb-4">
            <div className="max-w-prose p-2 rounded-lg bg-slate-800 text-slate-400 text-sm">
                <p className="italic">{text}</p>
            </div>
        </div>
    );
  }

  const isUser = speaker === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-prose p-3 rounded-xl shadow-md ${isUser ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-700 text-slate-200 rounded-bl-none'}`}>
        <p>{text}</p>
        {sources && sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-600">
                <h4 className="text-xs font-bold text-slate-400 mb-2">Sources:</h4>
                <ul className="space-y-1">
                    {sources.map((source, index) => (
                        <li key={index}>
                            <a 
                                href={source.uri} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-400 text-sm hover:underline truncate block"
                            >
                                {index + 1}. {source.title || source.uri}
                            </a>
                        </li>
                    ))}
                </ul>
            </div>
        )}
      </div>
    </div>
  );
};

const InterimTranscriptMessage: React.FC<{ text: string, speaker: 'user' | 'assistant' }> = ({ text, speaker }) => {
    if (!text) return null;
    const isUser = speaker === 'user';
    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
            <div className={`max-w-prose p-3 rounded-xl opacity-70 ${isUser ? 'bg-blue-600/80 text-white rounded-br-none' : 'bg-slate-700/80 text-slate-200 rounded-bl-none'}`}>
                <p>{text}</p>
            </div>
        </div>
    );
};

export const TranscriptView: React.FC<TranscriptViewProps> = ({ transcripts, interimTranscript }) => {
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts, interimTranscript]);

  return (
    <div className="space-y-4 pt-4 flex-grow">
      {transcripts.map((t) => (
        <TranscriptMessage key={t.id} transcript={t} />
      ))}
      <InterimTranscriptMessage text={interimTranscript.user} speaker="user" />
      <InterimTranscriptMessage text={interimTranscript.assistant} speaker="assistant" />
      <div ref={endOfMessagesRef} />
    </div>
  );
};