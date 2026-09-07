import React, { useState, useRef, useEffect } from 'react';
import { VideoUploader } from './components/VideoUploader';
import { Controls } from './components/Controls';
import { SummaryDisplay } from './components/SummaryDisplay';
import { HistorySidebar } from './components/HistorySidebar';
import { generateVideoSummary } from './services/geminiService';
import { VideoData, SummaryMode, AnalysisState, ProcessingTier, HistoryItem } from './types';
import { MonitorPlay, Sun, Moon, Clock } from 'lucide-react';

const App: React.FC = () => {
  const [video, setVideo] = useState<VideoData | null>(null);
  const [mode, setMode] = useState<SummaryMode>(SummaryMode.OVERVIEW);
  const [tier, setTier] = useState<ProcessingTier>(ProcessingTier.BALANCED);
  const [analysis, setAnalysis] = useState<AnalysisState>({
    isLoading: false,
    error: null,
    result: null
  });
  
  // Live Transcription State
  const [liveText, setLiveText] = useState<string>('');
  
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(true);

  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Apply theme class to HTML element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Load History from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('videosumm_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);
  
  const saveToHistory = (item: HistoryItem) => {
    setHistory(prev => {
      const newHistory = [item, ...prev].slice(0, 20); // Keep last 20 items
      localStorage.setItem('videosumm_history', JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => {
      const newHistory = prev.filter(item => item.id !== id);
      localStorage.setItem('videosumm_history', JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('videosumm_history');
  };

  const restoreHistoryItem = (item: HistoryItem) => {
    setMode(item.mode);
    setTier(item.tier);
    setLiveText('');
    setAnalysis({
      isLoading: false,
      error: null,
      result: {
        text: item.resultText,
        timestamp: item.timestamp
      }
    });

    // Helper to get youtube ID robustly
    const getYoutubeId = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    // Reconstruct video data
    const ytId = item.url ? getYoutubeId(item.url) : null;
    const restoredVideo: VideoData = {
      id: item.id,
      sourceType: item.sourceType,
      name: item.videoName,
      url: item.url,
      previewUrl: item.sourceType === 'youtube' && ytId
        ? `https://www.youtube.com/embed/${ytId}`
        : item.url || '',
    };

    setVideo(restoredVideo);
    setIsHistoryOpen(false);
  };
  
  // Ref to track the currently loaded video ID to prevent race conditions during auto-generation
  const currentVideoIdRef = useRef<string | null>(null);

  const handleVideoSelect = (data: VideoData) => {
    setVideo(data);
    currentVideoIdRef.current = data.id;
    
    // Only clear live text if we are NOT coming from a recording session.
    // If it's a recording, we want to preserve the live transcript that was just generated
    // until the final AI analysis replaces it.
    if (data.sourceType !== 'record') {
        setLiveText(''); 
    }
    
    // Default to Overview for generic summarization requests
    const defaultMode = (data.sourceType === 'youtube' || data.sourceType === 'url') 
        ? SummaryMode.OVERVIEW 
        : SummaryMode.TRANSCRIPT;

    setMode(defaultMode);
    
    // Auto-trigger generation
    setAnalysis({ isLoading: true, error: null, result: null });
    
    generateVideoSummary(data, defaultMode, tier)
      .then(text => {
        if (currentVideoIdRef.current === data.id) {
          setAnalysis({
            isLoading: false,
            error: null,
            result: { text, timestamp: Date.now() }
          });
          
          saveToHistory({
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            videoName: data.name,
            sourceType: data.sourceType,
            url: data.url,
            mode: defaultMode,
            tier: tier,
            resultText: text
          });
        }
      })
      .catch(err => {
        if (currentVideoIdRef.current === data.id) {
          setAnalysis({
            isLoading: false,
            error: err.message || "Auto-generation failed.",
            result: null
          });
        }
      });
  };

  const handleClear = () => {
    setVideo(null);
    currentVideoIdRef.current = null;
    setLiveText('');
    setAnalysis({ isLoading: false, error: null, result: null });
  };

  const handleGenerate = async () => {
    if (!video) return;

    setAnalysis(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const text = await generateVideoSummary(video, mode, tier);
      setAnalysis({
        isLoading: false,
        error: null,
        result: { text, timestamp: Date.now() }
      });

      // Save to history
      saveToHistory({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        videoName: video.name,
        sourceType: video.sourceType,
        url: video.url,
        mode: mode,
        tier: tier,
        resultText: text
      });

    } catch (err: any) {
      setAnalysis({
        isLoading: false,
        error: err.message || "Something went wrong during analysis.",
        result: null
      });
    }
  };

  const handleLiveUpdate = (text: string) => {
    // Append new text chunk with a space if needed
    setLiveText(prev => prev + (prev ? " " : "") + text);
  };

  const handleLiveStart = () => {
    setLiveText('');
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 selection:bg-indigo-500/30 transition-colors duration-300 overflow-x-hidden">
      
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 h-16 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 z-50 flex items-center justify-center transition-colors duration-300">
        <div className="w-full max-w-5xl px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg shadow-md shadow-indigo-500/20">
                <MonitorPlay className="text-white" size={20} />
            </div>
            <span className="font-bold text-xl tracking-tight text-zinc-900 dark:text-white">VideoSumm<span className="text-indigo-600 dark:text-indigo-400">AI</span></span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              title="View History"
            >
              <Clock size={20} />
            </button>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>
      </nav>

      {/* History Sidebar */}
      <HistorySidebar 
        isOpen={isHistoryOpen} 
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelect={restoreHistoryItem}
        onDelete={deleteHistoryItem}
        onClearAll={clearHistory}
      />

      {/* Main Content */}
      <main className="pt-24 pb-12 px-6">
        <div className="w-full max-w-3xl mx-auto flex flex-col gap-8">
          
          {/* Header Section */}
          <div className="text-center space-y-4 mb-4">
            <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 via-zinc-700 to-zinc-500 dark:from-white dark:via-zinc-200 dark:to-zinc-500">
              Transform Media into Insight
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400 text-lg max-w-xl mx-auto leading-relaxed">
              Upload video or audio, paste a link, or record directly. Our AI analyzes visuals and sound to generate summaries, transcripts, and more.
            </p>
          </div>

          {/* Upload & Preview Area */}
          <section className="w-full animate-in fade-in slide-in-from-bottom-8 duration-500 delay-100">
            <VideoUploader 
              onVideoSelected={handleVideoSelect} 
              onClear={handleClear}
              currentVideo={video}
              disabled={analysis.isLoading}
              isDarkMode={isDarkMode}
              onLiveUpdate={handleLiveUpdate}
              onLiveStart={handleLiveStart}
            />
          </section>

          {/* Controls & Actions */}
          {video && (
            <section className="w-full">
              <Controls 
                mode={mode} 
                setMode={setMode} 
                tier={tier}
                setTier={setTier}
                onGenerate={handleGenerate}
                isLoading={analysis.isLoading}
                disabled={analysis.isLoading}
              />
            </section>
          )}

          {/* Error State */}
          {analysis.error && (
            <div className="w-full p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-200 text-center animate-in fade-in zoom-in-95">
              <p className="font-semibold">Analysis Failed</p>
              <p className="text-sm opacity-80">{analysis.error}</p>
            </div>
          )}

          {/* Result Area */}
          {(analysis.result || liveText) && (
            <section className="w-full scroll-mt-24" id="results">
              <SummaryDisplay 
                text={analysis.result ? analysis.result.text : liveText} 
                isLive={!analysis.result && !!liveText}
                title={video ? `${mode} of ${video.name}` : undefined}
              />
            </section>
          )}

        </div>
      </main>

    </div>
  );
};

export default App;