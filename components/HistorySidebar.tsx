import React from 'react';
import { HistoryItem, SummaryMode, VideoSourceType } from '../types';
import { X, Clock, Trash2, FileVideo, Youtube, Globe, Mic, ChevronRight, FileQuestion } from 'lucide-react';

interface HistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onClearAll: () => void;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({
  isOpen,
  onClose,
  history,
  onSelect,
  onDelete,
  onClearAll
}) => {
  const getIcon = (type: VideoSourceType) => {
    switch (type) {
      case 'youtube': return <Youtube size={16} className="text-red-500" />;
      case 'url': return <Globe size={16} className="text-blue-500" />;
      case 'record': return <Mic size={16} className="text-indigo-500" />;
      case 'upload': return <FileVideo size={16} className="text-purple-500" />;
      default: return <FileQuestion size={16} className="text-zinc-400" />;
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Less than 24 hours
    if (diff < 86400000) {
      if (diff < 3600000) {
        const mins = Math.floor(diff / 60000);
        return `${mins}m ago`;
      }
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-sm z-[60]"
          onClick={onClose}
        />
      )}

      {/* Sidebar Panel */}
      <div 
        className={`
          fixed top-0 right-0 bottom-0 w-full max-w-sm bg-white dark:bg-zinc-900 
          border-l border-zinc-200 dark:border-zinc-800 shadow-2xl z-[70] transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/50">
            <div className="flex items-center gap-2 text-zinc-800 dark:text-zinc-100 font-semibold">
              <Clock size={20} className="text-indigo-600 dark:text-indigo-400" />
              <h2>History</h2>
            </div>
            <div className="flex items-center gap-1">
              {history.length > 0 && (
                <button 
                  onClick={onClearAll}
                  className="p-2 text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors mr-1"
                >
                  Clear All
                </button>
              )}
              <button 
                onClick={onClose}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-500 dark:text-zinc-400"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-zinc-400 dark:text-zinc-500 text-sm text-center">
                <Clock size={48} className="mb-3 opacity-20" />
                <p>No history yet.</p>
                <p className="text-xs mt-1">Generate a summary to see it here.</p>
              </div>
            ) : (
              history.map((item) => (
                <div 
                  key={item.id}
                  onClick={() => onSelect(item)}
                  className="group relative bg-white dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-xl p-3 cursor-pointer transition-all hover:shadow-md"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="p-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        {getIcon(item.sourceType)}
                      </div>
                      <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate flex-1">
                        {item.videoName}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-400 whitespace-nowrap ml-2 font-mono">
                      {formatDate(item.timestamp)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs mt-2">
                    <div className="flex gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">
                        {item.mode}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                        {item.tier.split(' ')[0]}
                        </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="absolute right-2 bottom-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                       onClick={(e) => onDelete(item.id, e)}
                       className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                       title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                    <div className="p-1.5 text-indigo-500">
                      <ChevronRight size={14} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
};
