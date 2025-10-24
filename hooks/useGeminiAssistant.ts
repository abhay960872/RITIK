import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type, GenerateContentResponse } from "@google/genai";
import { encode, decode, decodeAudioData } from '../utils/audio';
import type { Transcript, InterimTranscript, LightState, Timer, HistoryItem, AppMode, Source } from '../types';

const controlLightFunctionDeclaration: FunctionDeclaration = {
  name: 'controlLight',
  parameters: {
    type: Type.OBJECT,
    description: 'Set the brightness and state of a room light.',
    properties: {
      brightness: {
        type: Type.NUMBER,
        description: 'Light level from 0 to 100. Zero is off.',
      },
      state: {
        type: Type.STRING,
        description: 'The desired state of the light, either `on` or `off`.',
        enum: ['on', 'off'],
      },
    },
    required: ['brightness', 'state'],
  },
};

const setTimerFunctionDeclaration: FunctionDeclaration = {
    name: 'setTimer',
    parameters: {
        type: Type.OBJECT,
        description: 'Sets a timer for a specified duration.',
        properties: {
            duration: {
                type: Type.NUMBER,
                description: 'The duration for the timer.',
            },
            unit: {
                type: Type.STRING,
                description: 'The unit of time for the duration.',
                enum: ['seconds', 'minutes', 'hours'],
            },
            label: {
                type: Type.STRING,
                description: 'An optional label for the timer.'
            }
        },
        required: ['duration', 'unit'],
    },
};

const setUserNameFunctionDeclaration: FunctionDeclaration = {
    name: 'setUserName',
    parameters: {
        type: Type.OBJECT,
        description: "Sets the user's name for personalized interaction.",
        properties: {
            name: {
                type: Type.STRING,
                description: "The name of the user.",
            },
        },
        required: ['name'],
    },
};

const displayCreatorMessageFunctionDeclaration: FunctionDeclaration = {
    name: 'displayCreatorMessage',
    parameters: {
        type: Type.OBJECT,
        description: "Use this function when the user asks who created, developed, or made the assistant.",
        properties: {
            acknowledged: {
                type: Type.BOOLEAN,
                description: "Acknowledge the request by setting to true."
            }
        },
        required: ['acknowledged'],
    },
};


const workletCode = `
class AudioProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const pcm16 = new Int16Array(input[0].length);
      for (let i = 0; i < input[0].length; i++) {
        pcm16[i] = input[0][i] * 32767;
      }
      this.port.postMessage(pcm16);
    }
    return true;
  }
}
registerProcessor('audio-processor', AudioProcessor);
`;

export const useGeminiAssistant = (onApiKeyError: () => void) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [interimTranscript, setInterimTranscript] = useState<InterimTranscript>({ user: '', assistant: '' });
  const [error, setError] = useState<string | null>(null);

  const [lightState, setLightState] = useState<LightState>({ isOn: false, brightness: 50 });
  const [timers, setTimers] = useState<Timer[]>([]);
  const [userName, setUserName] = useState<string | null>(() => localStorage.getItem('userName'));
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Refs for audio processing and session management
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const playingSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  
  const currentUserTranscriptRef = useRef('');
  const currentAssistantTranscriptRef = useRef('');
  const sessionTranscriptsRef = useRef<Transcript[]>([]);
  const isStoppingRef = useRef(false);

  useEffect(() => {
    try {
        const storedHistory = localStorage.getItem('apnaAssistantHistory');
        if (storedHistory) {
            setHistory(JSON.parse(storedHistory));
        }
    } catch (e) {
        console.error("Failed to load history from localStorage", e);
    }
  }, []);

  const saveHistory = useCallback(async (newHistoryItem: HistoryItem) => {
    try {
        setHistory(prevHistory => {
            const updatedHistory = [newHistoryItem, ...prevHistory];
            localStorage.setItem('apnaAssistantHistory', JSON.stringify(updatedHistory));
            return updatedHistory;
        });
    } catch (e) {
        console.error("Failed to save history to localStorage", e);
    }
  }, []);

  const deleteHistoryItem = useCallback((id: string) => {
    try {
        setHistory(prevHistory => {
            const updatedHistory = prevHistory.filter(item => item.id !== id);
            localStorage.setItem('apnaAssistantHistory', JSON.stringify(updatedHistory));
            return updatedHistory;
        });
    } catch (e) {
        console.error("Failed to delete history item", e);
    }
  }, []);

  const generateHeadline = useCallback(async (conversation: Transcript[]): Promise<string> => {
    if (!process.env.API_KEY) return "Conversation";
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const conversationText = conversation.map(t => `${t.speaker}: ${t.text}`).join('\n');
        const prompt = `Summarize the following conversation in 5 words or less to use as a title. Conversation:\n\n${conversationText}`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text.trim();
    } catch (e) {
        console.error("Failed to generate headline", e);
        const message = (e as Error).message || '';
        if (message.includes('permission denied') || message.includes('API key not valid') || message.includes('not found') || message.includes('RESOURCE_EXHAUSTED')) {
            onApiKeyError();
        }
        return "Conversation"; // Fallback headline
    }
  }, [onApiKeyError]);

  const stopAssistant = useCallback(async (shouldSaveHistory = true) => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    setIsRecording(false);
    setIsResponding(false);

    if (shouldSaveHistory && sessionTranscriptsRef.current.length > 0) {
        const headline = await generateHeadline(sessionTranscriptsRef.current);
        const newHistoryItem: HistoryItem = {
            id: crypto.randomUUID(),
            headline,
            transcripts: [...sessionTranscriptsRef.current],
            timestamp: Date.now(),
        };
        await saveHistory(newHistoryItem);
    }
    sessionTranscriptsRef.current = [];

    if (sessionPromiseRef.current) {
      try {
        const session = await sessionPromiseRef.current;
        session.close();
      } catch (e) {
        console.error("Error closing session:", e);
      } finally {
        sessionPromiseRef.current = null;
      }
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (workletNodeRef.current) {
        workletNodeRef.current.port.onmessage = null;
        workletNodeRef.current.disconnect();
        workletNodeRef.current = null;
    }

    if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
        playingSourcesRef.current.forEach(source => source.stop());
        playingSourcesRef.current.clear();
        await outputAudioContextRef.current.close();
        outputAudioContextRef.current = null;
    }

    setInterimTranscript({ user: '', assistant: ''});
    currentUserTranscriptRef.current = '';
    currentAssistantTranscriptRef.current = '';
    
    isStoppingRef.current = false;
  }, [saveHistory, generateHeadline, onApiKeyError]);

  const startNewChat = useCallback(async () => {
    await stopAssistant(false);
    setTranscripts([]);
    setTimers([]);
    setLightState({ isOn: false, brightness: 50 });
    setError(null);
  }, [stopAssistant]);

  const loadHistoryItem = useCallback(async (item: HistoryItem) => {
      await stopAssistant(false);
      setTranscripts(item.transcripts);
      setTimers([]);
      setLightState({ isOn: false, brightness: 50 });
      setError(null);
  }, [stopAssistant]);

  const clearTimer = useCallback((id: string) => {
    setTimers(prev => prev.filter(timer => timer.id !== id));
  }, []);

  const getAnswerAndSpeak = useCallback(async (question: string) => {
    setIsResponding(true);
    let ai;
    try {
        if (!process.env.API_KEY) throw new Error("API key not available.");
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const stream = await ai.models.generateContentStream({
            model: "gemini-2.5-flash",
            contents: question,
            config: {
              tools: [{googleSearch: {}}],
            },
        });

        let fullText = "";
        const tempId = crypto.randomUUID();

        setTranscripts(prev => [...prev, { id: tempId, speaker: 'assistant', text: '' }]);
        
        for await (const chunk of stream) {
            if (chunk.text) {
                fullText += chunk.text;
                setTranscripts(prev => prev.map(t => 
                    t.id === tempId ? { ...t, text: fullText } : t
                ));
            }
        }
        
        const finalResponse = await stream.response;
        const answerText = finalResponse.text;
        const groundingChunks = finalResponse.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const sources: Source[] = groundingChunks
            .map(chunk => chunk.web)
            .filter((web): web is { uri: string; title: string } => !!web && !!web.uri && !!web.title);

        const assistantTranscript: Transcript = {
            id: tempId,
            speaker: 'assistant',
            text: answerText,
            sources,
        };
        setTranscripts(prev => prev.map(t => t.id === tempId ? assistantTranscript : t));
        sessionTranscriptsRef.current.push(assistantTranscript);

        const ttsResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: [{ parts: [{ text: answerText }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
                },
            },
        });
        
        const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio && outputAudioContextRef.current) {
            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
            const source = outputAudioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputAudioContextRef.current.destination);
            source.start(0);
            source.onended = () => {
                stopAssistant();
            };
        } else {
            stopAssistant();
        }

    } catch (e: any) {
        console.error("Error in answer mode:", e);
        if (e.message?.includes('permission denied') || e.message?.includes('API key not valid') || e.message?.includes('not found')) {
            onApiKeyError();
            setError("Permission denied. Please select a valid API key.");
        } else if (e.message?.includes('RESOURCE_EXHAUSTED')) {
            setError("You've exceeded the free request limit. Please wait and try again later.");
            onApiKeyError();
        } else {
            setError("Sorry, I couldn't find an answer for that.");
        }
        await stopAssistant(false);
    }
  }, [stopAssistant, onApiKeyError]);

  const startAssistant = useCallback(async (voiceName: string = 'Kore', mode: AppMode = 'assistant') => {
    if (isRecording) return;
    await stopAssistant(false);
    setIsRecording(true);
    sessionTranscriptsRef.current = [];
    let ai;

    try {
      if (!process.env.API_KEY) {
        throw new Error("API key not available.");
      }
      ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      streamRef.current = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
        }
      });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      
      const workletURL = 'data:application/javascript;base64,' + btoa(workletCode);
      await audioContextRef.current.audioWorklet.addModule(workletURL);
      
      workletNodeRef.current = new AudioWorkletNode(audioContextRef.current, 'audio-processor');
      sourceRef.current = audioContextRef.current.createMediaStreamSource(streamRef.current);
      sourceRef.current.connect(workletNodeRef.current);

      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const systemInstruction = `You are a friendly and helpful personal assistant named Apna Assistant. Keep your answers concise. When asked who created you, you must answer that you were created by Mr. Priyanshu and also call the 'displayCreatorMessage' function with acknowledged set to true. ${userName ? `The user's name is ${userName}. Address them by their name.` : 'If the user tells you their name, use the setUserName function to remember it.'}`;

      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: mode === 'assistant' ? {} : undefined, // Only get assistant transcription in assistant mode
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } },
          },
          tools: mode === 'assistant' ? [{ functionDeclarations: [controlLightFunctionDeclaration, setTimerFunctionDeclaration, setUserNameFunctionDeclaration, displayCreatorMessageFunctionDeclaration] }] : undefined,
          systemInstruction: systemInstruction,
          thinkingConfig: { thinkingBudget: 0 },
        },
        callbacks: {
          onopen: () => {
            if (!workletNodeRef.current) return;
            workletNodeRef.current.port.onmessage = (event) => {
              const pcm16Data = event.data;
              const pcmBlob = {
                data: encode(new Uint8Array(pcm16Data.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              if (sessionPromiseRef.current) {
                 sessionPromiseRef.current.then((session) => {
                    session.sendRealtimeInput({ media: pcmBlob });
                 });
              }
            };
          },
          onmessage: async (message: LiveServerMessage) => {
             // Shared logic for input transcription
             if (message.serverContent?.inputTranscription) {
                const text = message.serverContent.inputTranscription.text;
                currentUserTranscriptRef.current += text;
                setInterimTranscript(prev => ({ ...prev, user: currentUserTranscriptRef.current }));
             }

             if (mode === 'assistant') {
                if (message.toolCall) {
                    for(const fc of message.toolCall.functionCalls) {
                        let result = "ok";
                        let systemMessage = '';
                        if (fc.name === 'controlLight') {
                            const { brightness, state } = fc.args as { brightness: number; state: 'on' | 'off' };
                            setLightState({ isOn: state === 'on', brightness });
                            systemMessage = `[SYSTEM] Light set to ${state} at ${brightness}% brightness.`;
                        } else if (fc.name === 'setTimer') {
                            const { duration, unit, label } = fc.args as { duration: number; unit: 'seconds' | 'minutes' | 'hours'; label?: string };
                            let durationInSeconds = duration;
                            if (unit === 'minutes') durationInSeconds *= 60;
                            if (unit === 'hours') durationInSeconds *= 3600;
                            
                            const newTimer: Timer = {
                                id: crypto.randomUUID(),
                                duration: durationInSeconds,
                                remaining: durationInSeconds,
                                label: label || `${duration} ${unit} timer`,
                            };
                            setTimers(prev => [...prev, newTimer]);
                            systemMessage = `[SYSTEM] Setting a ${duration} ${unit} timer.`;
                        } else if (fc.name === 'setUserName') {
                            const { name } = fc.args as { name: string };
                            setUserName(name);
                            localStorage.setItem('userName', name);
                            systemMessage = `[SYSTEM] I'll remember your name is ${name}.`;
                        } else if (fc.name === 'displayCreatorMessage') {
                            systemMessage = 'I was created by Mr. Priyanshu.';
                            result = 'Creator message displayed.';
                        }
                        
                        if (systemMessage) {
                            const newTranscript: Transcript = {id: crypto.randomUUID(), speaker: 'system', text: systemMessage};
                            setTranscripts(prev => [...prev, newTranscript]);
                            sessionTranscriptsRef.current.push(newTranscript);
                        }

                        sessionPromiseRef.current?.then(session => {
                            session.sendToolResponse({
                                functionResponses: { id: fc.id, name: fc.name, response: { result } }
                            });
                        });
                    }
                }

                if (message.serverContent?.outputTranscription) {
                    setIsResponding(true);
                    const text = message.serverContent.outputTranscription.text;
                    currentAssistantTranscriptRef.current += text;
                    setInterimTranscript(prev => ({ ...prev, assistant: currentAssistantTranscriptRef.current }));
                }

                const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
                if (base64Audio && outputAudioContextRef.current) {
                    const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
                    nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current.currentTime);
                    
                    const source = outputAudioContextRef.current.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(outputAudioContextRef.current.destination);
                    source.start(nextStartTimeRef.current);
                    
                    nextStartTimeRef.current += audioBuffer.duration;
                    playingSourcesRef.current.add(source);
                    source.onended = () => {
                        playingSourcesRef.current.delete(source);
                    };
                }
                if(message.serverContent?.interrupted && outputAudioContextRef.current) {
                    playingSourcesRef.current.forEach(source => source.stop());
                    playingSourcesRef.current.clear();
                    nextStartTimeRef.current = 0;
                }
             }

             if(message.serverContent?.turnComplete) {
                const fullUserInput = currentUserTranscriptRef.current;
                
                if (fullUserInput) {
                    const newTranscript: Transcript = {id: crypto.randomUUID(), speaker: 'user', text: fullUserInput};
                    setTranscripts(prev => [...prev, newTranscript]);
                    sessionTranscriptsRef.current.push(newTranscript);
                }

                if (mode === 'assistant') {
                    const fullAssistantOutput = currentAssistantTranscriptRef.current;
                    if (fullAssistantOutput) {
                        const newTranscript: Transcript = {id: crypto.randomUUID(), speaker: 'assistant', text: fullAssistantOutput};
                        setTranscripts(prev => [...prev, newTranscript]);
                        sessionTranscriptsRef.current.push(newTranscript);
                    }
                    currentAssistantTranscriptRef.current = '';
                } else if (mode === 'answer' && fullUserInput) {
                    await getAnswerAndSpeak(fullUserInput);
                }
                
                currentUserTranscriptRef.current = '';
                setInterimTranscript({ user: '', assistant: '' });
                if(mode === 'assistant') setIsResponding(false);
             }

          },
          onerror: async (e) => {
            console.error('Gemini API Error:', e);
            const errorMessage = (e as ErrorEvent).message || 'Unknown error';
            if (errorMessage.includes('permission denied') || errorMessage.includes('API key not valid') || errorMessage.includes('not found')) {
               onApiKeyError();
               setError('Permission denied. Please select a valid API key and try again.');
            } else if (errorMessage.includes('RESOURCE_EXHAUSTED')) {
                setError("You've exceeded the free request limit. The assistant has been stopped.");
                onApiKeyError();
            } else {
               setError(`An error occurred: ${errorMessage}`);
            }
            await stopAssistant(false);
          },
          onclose: async () => {
            console.log('Session closed.');
            if(!isStoppingRef.current) await stopAssistant();
          },
        }
      });
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('permission denied') || err.message?.includes('API key not valid') || err.message?.includes('not found')) {
        onApiKeyError();
        setError('Permission denied. Please select a valid API key.');
      } else {
        setError(err.message || 'Failed to start the assistant.');
      }
      await stopAssistant(false);
    }
  }, [stopAssistant, userName, isRecording, getAnswerAndSpeak, onApiKeyError]);

  const toggleAssistant = useCallback(async (voiceName: string, mode: AppMode) => {
    if (isRecording) {
      await stopAssistant();
    } else {
      await startAssistant(voiceName, mode);
    }
  }, [isRecording, startAssistant, stopAssistant]);

  return { isRecording, isResponding, transcripts, interimTranscript, error, toggleAssistant, lightState, timers, clearTimer, userName, history, loadHistoryItem, startNewChat, deleteHistoryItem };
};