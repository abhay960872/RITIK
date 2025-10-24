
export type AppMode = 'assistant' | 'answer';

export type Source = {
    uri: string;
    title: string;
}

export type Transcript = {
  id: string;
  speaker: 'user' | 'assistant' | 'system';
  text: string;
  sources?: Source[];
};

export type InterimTranscript = {
  user: string;
  assistant: string;
};

export type LightState = {
  isOn: boolean;
  brightness: number; // 0 to 100
};

export type Timer = {
  id: string;
  duration: number; // in seconds
  remaining: number; // in seconds
  label: string;
};

export type Voice = {
    id: string;
    name: string;
    description: string;
}

export type HistoryItem = {
    id: string;
    headline: string;
    transcripts: Transcript[];
    timestamp: number;
}