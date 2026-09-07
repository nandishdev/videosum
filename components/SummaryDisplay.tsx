import React, { useState, useRef, useEffect } from 'react';
import { Copy, Check, Share2, Bot, Volume2, Loader2, StopCircle, Radio } from 'lucide-react';
import { generateSpeech } from '../services/geminiService';

interface SummaryDisplayProps {
  text: string;
  isLive?: boolean;
  title?: string;
}

export const SummaryDisplay: React.FC<SummaryDisplayProps> = ({ text, isLive, title }) => {
  const [copied, setCopied] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      // Cleanup audio on unmount
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Auto-scroll when live text updates
  useEffect(() => {
    if (isLive && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [text, isLive]);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStopAudio = () => {
    if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
        sourceNodeRef.current = null;
    }
    setIsPlaying(false);
  };

  const handlePlayAudio = async () => {
    if (isPlaying) {
        handleStopAudio();
        return;
    }

    setIsGeneratingAudio(true);
    try {
        const audioBuffer = await generateSpeech(text);
        
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        // Resume context if suspended (browser policy)
        if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }

        const decodedBuffer = await audioContextRef.current.decodeAudioData(audioBuffer);
        
        const source = audioContextRef.current.createBufferSource();
        source.buffer = decodedBuffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => setIsPlaying(false);
        
        sourceNodeRef.current = source;
        source.start(0);
        setIsPlaying(true);

    } catch (err) {
        console.error("Failed to play audio", err);
        alert("Failed to generate speech. Please try again.");
    } finally {
        setIsGeneratingAudio(false);
    }
  };

  const processInlineStyles = (text: string): React.ReactNode[] => {
    // 1. Split by Bold (**text**)
    const parts = text.split(/(\*\*.*?\*\*)/g);
    
    return parts.flatMap((part, idx) => {
      // Handle Bold
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={`b-${idx}`} className="text-zinc-900 dark:text-zinc-100 font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      
      // Handle Italic (*text*) within non-bold parts
      const italicParts = part.split(/(\*.*?\*)/g);
      return italicParts.map((subPart, subIdx) => {
        if (subPart.startsWith('*') && subPart.endsWith('*') && subPart.length > 2) {
           return <em key={`i-${idx}-${subIdx}`} className="italic text-zinc-600 dark:text-zinc-400">{subPart.slice(1, -1)}</em>;
        }
        return subPart;
      });
    });
  };

  const formatText = (inputText: string) => {
    const lines = inputText.split(/\r?\n/);
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];

    lines.forEach((line, i) => {
      // Toggle Code Block
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          // End of code block
          elements.push(
            <div key={`code-${i}`} className="w-full bg-zinc-100 dark:bg-zinc-950 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 font-mono text-xs md:text-sm text-zinc-700 dark:text-zinc-300 overflow-x-auto my-4 shadow-inner">
              <pre>{codeBlockContent.join('\n')}</pre>
            </div>
          );
          codeBlockContent = [];
          inCodeBlock = false;
        } else {
          // Start of code block
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        return;
      }

      // Headings
      if (line.startsWith('## ')) {
        elements.push(
          <h3 key={i} className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-6 mb-3">
            {processInlineStyles(line.replace('## ', ''))}
          </h3>
        );
        return;
      }
      if (line.startsWith('# ')) {
        elements.push(
          <h2 key={i} className="text-2xl font-bold text-zinc-900 dark:text-white mt-6 mb-4 border-b border-zinc-200 dark:border-zinc-800 pb-2">
            {processInlineStyles(line.replace('# ', ''))}
          </h2>
        );
        return;
      }

      // Blockquotes
      if (line.startsWith('> ')) {
        elements.push(
          <blockquote key={i} className="border-l-4 border-indigo-500 pl-4 py-2 my-4 bg-zinc-100 dark:bg-zinc-800/30 rounded-r text-zinc-600 dark:text-zinc-300 italic">
            {processInlineStyles(line.replace('> ', ''))}
          </blockquote>
        );
        return;
      }

      // Unordered Lists
      if (line.startsWith('- ') || line.startsWith('* ')) {
        elements.push(
          <div key={i} className="flex items-start gap-3 mb-2 ml-1 text-zinc-700 dark:text-zinc-300">
            <span className="text-indigo-500 mt-1.5 shrink-0">•</span>
            <span className="leading-relaxed">{processInlineStyles(line.substring(2))}</span>
          </div>
        );
        return;
      }

      // Ordered Lists
      const orderedListMatch = line.match(/^(\d+)\.\s(.*)/);
      if (orderedListMatch) {
         elements.push(
            <div key={i} className="flex items-start gap-3 mb-2 ml-1 text-zinc-700 dark:text-zinc-300">
                <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold shrink-0 mt-0.5 select-none">{orderedListMatch[1]}.</span>
                <span className="leading-relaxed">{processInlineStyles(orderedListMatch[2])}</span>
            </div>
         );
         return;
      }

      // Empty lines (render as spacer)
      if (line.trim() === '') {
          elements.push(<div key={i} className="h-2" />);
          return;
      }

      // Regular Text
      elements.push(
        <div key={i} className="mb-2 text-zinc-700 dark:text-zinc-300 leading-relaxed">
          {processInlineStyles(line)}
        </div>
      );
    });

    // Handle case where code block wasn't closed
    if (inCodeBlock && codeBlockContent.length > 0) {
        elements.push(
            <div key="code-incomplete" className="w-full bg-zinc-100 dark:bg-zinc-950 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 font-mono text-xs md:text-sm text-zinc-700 dark:text-zinc-300 overflow-x-auto my-4 shadow-inner">
              <pre>{codeBlockContent.join('\n')}</pre>
            </div>
        );
    }

    return elements;
  };

  return (
    <div className={`w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-700 transition-colors ${isLive ? 'ring-2 ring-red-500/50' : ''}`}>
      <div className="bg-zinc-50 dark:bg-zinc-950/50 p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between transition-colors">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            {isLive ? (
              <div className="flex items-center gap-2 text-red-500">
                <Radio size={20} className="animate-pulse" />
                <span className="font-bold text-sm tracking-wide uppercase">Live Transcription</span>
              </div>
            ) : (
              <>
                <Bot size={20} />
                <span className="font-semibold text-sm tracking-wide uppercase">AI Analysis Result</span>
              </>
            )}
          </div>
          {title && <h3 className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{title}</h3>}
        </div>
        <div className="flex items-center gap-2">
            {!isLive && (
                <button 
                    onClick={handlePlayAudio}
                    disabled={isGeneratingAudio}
                    className={`p-2 rounded-lg transition-colors flex items-center gap-2 ${isPlaying ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10' : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                    title="Read Aloud"
                >
                    {isGeneratingAudio ? (
                        <Loader2 size={18} className="animate-spin" />
                    ) : isPlaying ? (
                        <StopCircle size={18} />
                    ) : (
                        <Volume2 size={18} />
                    )}
                </button>
            )}
            <button 
                onClick={handleCopy}
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                title="Copy to clipboard"
            >
                {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
            </button>
            <button 
                className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                title="Share (Mock)"
            >
                <Share2 size={18} />
            </button>
        </div>
      </div>
      
      <div 
        ref={contentRef}
        className={`p-6 md:p-8 bg-white dark:bg-gradient-to-b dark:from-zinc-900 dark:to-zinc-900/50 min-h-[300px] max-h-[600px] overflow-y-auto transition-colors relative ${isLive ? 'scroll-smooth' : ''}`}
      >
        <div className="prose prose-invert max-w-none">
            {formatText(text)}
            {isLive && (
                <span className="inline-block w-2 h-4 bg-red-500 ml-1 animate-pulse align-middle"></span>
            )}
        </div>
      </div>
    </div>
  );
};