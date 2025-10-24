import React from 'react';
import type { HistoryItem } from '../types';

interface HistoryPanelProps {
  isOpen: boolean;
  history: HistoryItem[];
  onSelectItem: (item: HistoryItem) => void;
  onNewChat: () => void;
  onDeleteItem: (id: string) => void;
  isSessionActive: boolean;
}

const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);
    
    if (diffSeconds < 60) return "Just now";
    const diffMinutes = Math.round(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ isOpen, history, onSelectItem, onNewChat, onDeleteItem, isSessionActive }) => {
  
  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent onSelectItem from firing
    if (window.confirm("Are you sure you want to delete this conversation?")) {
        onDeleteItem(id);
    }
  };

  return (
    <aside className={`
      fixed md:relative inset-y-0 left-0 z-20
      h-full w-5/6 sm:w-64 flex-shrink-0
      bg-slate-800/80 backdrop-blur-sm border-r border-slate-700/50 
      flex flex-col
      transition-transform md:transition-all duration-300 ease-in-out
      ${isOpen ? 'translate-x-0' : '-translate-x-full md:w-0 md:border-r-0 md:translate-x-0'}
    `}>
      <div className="p-2 border-b border-slate-700/50">
        <button
          onClick={onNewChat}
          disabled={isSessionActive}
          className="w-full flex items-center justify-between px-3 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-md shadow-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span className="font-semibold">New Chat</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
        </button>
      </div>
      <div className="flex-grow overflow-y-auto">
        <ul className="p-2 space-y-1">
          {history.map(item => (
            <li key={item.id} className="relative group">
              <button
                onClick={() => onSelectItem(item)}
                disabled={isSessionActive}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-slate-700/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <p className="text-slate-100 font-medium truncate pr-6">{item.headline}</p>
                <p className="text-slate-400 text-xs">{formatTimestamp(item.timestamp)}</p>
              </button>
              <button
                  onClick={(e) => handleDelete(e, item.id)}
                  disabled={isSessionActive}
                  className="absolute top-1/2 right-2 -translate-y-1/2 p-1 rounded-md text-slate-500 hover:text-red-500 hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 focus:outline-none disabled:opacity-0"
                  aria-label="Delete conversation"
              >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
};