import React from 'react';
import { SummaryMode, ProcessingTier } from '../types';
import { Play, Loader2, Sparkles, List, CheckSquare, Activity, FileText, Zap, BrainCircuit, Cpu } from 'lucide-react';

interface ControlsProps {
  mode: SummaryMode;
  setMode: (mode: SummaryMode) => void;
  tier: ProcessingTier;
  setTier: (tier: ProcessingTier) => void;
  onGenerate: () => void;
  isLoading: boolean;
  disabled: boolean;
}

const MODES = [
  { id: SummaryMode.OVERVIEW, icon: Sparkles, label: 'Overview' },
  { id: SummaryMode.KEY_POINTS, icon: List, label: 'Key Points' },
  { id: SummaryMode.ACTION_ITEMS, icon: CheckSquare, label: 'Action Items' },
  { id: SummaryMode.SENTIMENT, icon: Activity, label: 'Sentiment' },
  { id: SummaryMode.TRANSCRIPT, icon: FileText, label: 'Transcription' },
];

const TIERS = [
  { id: ProcessingTier.FAST, icon: Zap, label: 'Lightning', desc: 'Fast (Flash Lite)' },
  { id: ProcessingTier.BALANCED, icon: Cpu, label: 'Standard', desc: 'Balanced (Flash)' },
  { id: ProcessingTier.THINKING, icon: BrainCircuit, label: 'Deep Think', desc: 'Reasoning (Pro 3)' },
];

export const Controls: React.FC<ControlsProps> = ({ 
  mode, 
  setMode, 
  tier,
  setTier,
  onGenerate, 
  isLoading, 
  disabled 
}) => {
  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Processing Tier Selection */}
      <div className="bg-zinc-100/50 dark:bg-zinc-900/50 p-1 rounded-xl flex items-center justify-between border border-zinc-200 dark:border-zinc-800 transition-colors">
        {TIERS.map((t) => {
          const Icon = t.icon;
          const isActive = tier === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTier(t.id)}
              disabled={isLoading}
              className={`
                flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg transition-all text-sm font-medium
                ${isActive 
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700' 
                  : 'text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'}
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
              title={t.desc}
            >
              <Icon size={14} className={isActive ? (t.id === ProcessingTier.THINKING ? 'text-purple-500 dark:text-purple-400' : t.id === ProcessingTier.FAST ? 'text-yellow-500 dark:text-yellow-400' : 'text-indigo-500 dark:text-indigo-400') : ''} />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* Mode Selection Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {MODES.map((m) => {
            const Icon = m.icon;
            const isActive = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                disabled={isLoading}
                className={`
                  flex flex-col items-center justify-center gap-2 p-3 md:p-4 rounded-xl border transition-all duration-200
                  ${isActive 
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-200'}
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                <Icon size={20} className={isActive ? 'animate-pulse' : ''} />
                <span className="text-xs md:text-sm font-medium">{m.label}</span>
              </button>
            );
        })}
      </div>

      {/* Main Action Button */}
      <button
        onClick={onGenerate}
        disabled={disabled || isLoading}
        className={`
          relative w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-300
          ${disabled 
            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed' 
            : tier === ProcessingTier.THINKING
               ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-xl shadow-purple-500/30'
               : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-xl shadow-indigo-500/30'}
             transform hover:-translate-y-0.5 active:translate-y-0
        `}
      >
        {isLoading ? (
          <>
            <Loader2 className="animate-spin" size={24} />
            <span className="animate-pulse">
               {tier === ProcessingTier.THINKING ? 'Thinking Deeply...' : 'Analyzing Content...'}
            </span>
          </>
        ) : (
          <>
            <Play fill="currentColor" size={20} />
            Generate {mode === SummaryMode.TRANSCRIPT ? 'Transcription' : 'Summary'}
          </>
        )}
      </button>
    </div>
  );
};