import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Upload, X, FileVideo, AlertCircle, Link as LinkIcon, Youtube, ArrowRight, Globe, Search, Loader2, Mic, StopCircle, Music, Play, Pause, AudioLines, MonitorPlay, FolderOpen, Activity } from 'lucide-react';
import { VideoData } from '../types';
import { LiveTranscriber } from '../services/geminiService';

interface VideoUploaderProps {
  onVideoSelected: (data: VideoData) => void;
  onClear: () => void;
  currentVideo: VideoData | null;
  disabled: boolean;
  isDarkMode?: boolean;
  onLiveUpdate?: (text: string) => void;
  onLiveStart?: () => void;
}

const MAX_FILE_SIZE_MB = 20;

// Helper to draw rounded rects on canvas
function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  if (width < 2 * radius) radius = width / 2;
  if (height < 2 * radius) radius = height / 2;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
  ctx.fill();
}

// Helper to format duration
const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const WaveformVisualizer: React.FC<{ src: string, isDarkMode: boolean }> = ({ src, isDarkMode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState(true);

  // Load and decode audio data
  useEffect(() => {
    let active = true;
    const loadAudio = async () => {
      // If src is empty (media missing), don't try to load
      if (!src) {
        setIsProcessing(false);
        return;
      }

      setIsProcessing(true);
      try {
        const response = await fetch(src);
        const arrayBuffer = await response.arrayBuffer();
        // Use a new context for decoding (standard browser compatibility)
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        try {
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          if (!active) return;

          // Calculate peaks
          const channelData = audioBuffer.getChannelData(0); // Left channel
          const sampleCount = 120; // Number of bars to display
          const blockSize = Math.floor(channelData.length / sampleCount);
          const generatedPeaks = [];

          for (let i = 0; i < sampleCount; i++) {
            let max = 0;
            const start = i * blockSize;
            // Optimize: Check every 10th sample in block for speed
            for (let j = 0; j < blockSize; j += 10) { 
               if (channelData[start + j] > max) max = channelData[start + j];
               else if (-channelData[start + j] > max) max = -channelData[start + j];
            }
            generatedPeaks.push(max);
          }

          // Normalize peaks to make quiet audio visible
          const multiplier = Math.pow(Math.max(...generatedPeaks), -1);
          const normalizedPeaks = generatedPeaks.map(n => n * multiplier);

          setPeaks(normalizedPeaks);
          setDuration(audioBuffer.duration);
        } finally {
          // Close context to free resources/limits
          audioContext.close();
        }
        
        setIsProcessing(false);
      } catch (err) {
        console.error("Error generating waveform:", err);
        setIsProcessing(false);
      }
    };

    if (src) loadAudio();
    return () => { active = false; };
  }, [src]);

  // Sync with audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, []);

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || peaks.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    
    ctx.clearRect(0, 0, width, height);

    const totalBars = peaks.length;
    // Calculate exact bar width to fill space
    const gap = 2;
    const barWidth = (width - (totalBars - 1) * gap) / totalBars;

    peaks.forEach((peak, index) => {
      const x = index * (barWidth + gap);
      // Min height 3px for visibility
      const barHeight = Math.max(3, peak * (height * 0.8)); 
      const y = (height - barHeight) / 2;

      // Color logic based on playback progress
      const progressPercent = currentTime / duration;
      const barPercent = index / totalBars;
      
      if (barPercent < progressPercent) {
        ctx.fillStyle = '#6366f1'; // Indigo-500
      } else {
        // Adapt inactive bar color based on theme
        ctx.fillStyle = isDarkMode ? '#3f3f46' : '#cbd5e1'; // Zinc-700 (dark) vs Slate-300 (light)
      }

      roundedRect(ctx, x, y, barWidth, barHeight, 2);
    });

  }, [peaks, currentTime, duration, isDarkMode]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !audioRef.current || duration === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.min(Math.max(x / rect.width, 0), 1);
    const newTime = percent * duration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (t: number) => {
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isProcessing) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-zinc-500 bg-zinc-50 dark:bg-zinc-950 transition-colors">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
        <span className="text-sm font-medium">Extracting Audio Track...</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-6 relative group transition-colors">
      <audio ref={audioRef} src={src} />
      
      {/* Waveform Container */}
      <div 
        ref={containerRef}
        onClick={handleSeek}
        className="w-full h-32 cursor-pointer relative z-10 flex items-center"
      >
        <canvas 
          ref={canvasRef} 
          className="w-full h-full block" 
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      {/* Controls Overlay */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <button 
             onClick={(e) => { e.stopPropagation(); togglePlay(); }}
             className="p-4 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-black/20 dark:shadow-black/50 transform scale-90 group-hover:scale-100 transition-all pointer-events-auto"
          >
             {isPlaying ? <Pause fill="currentColor" size={24} /> : <Play fill="currentColor" size={24} className="ml-1" />}
          </button>
      </div>

      {/* Time Display */}
      <div className="absolute bottom-4 left-6 right-6 flex justify-between text-xs font-mono text-zinc-500 pointer-events-none">
         <span>{formatTime(currentTime)}</span>
         <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
};

export const VideoUploader: React.FC<VideoUploaderProps> = ({ 
  onVideoSelected, 
  onClear, 
  currentVideo,
  disabled,
  isDarkMode = true,
  onLiveUpdate,
  onLiveStart
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'link' | 'record'>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [isProcessingUrl, setIsProcessingUrl] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  
  // View mode for video files: 'video' player or 'waveform' audio visualizer
  const [viewMode, setViewMode] = useState<'video' | 'waveform'>('video');
  
  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Live Transcription State
  const transcriberRef = useRef<LiveTranscriber | null>(null);
  const [isLivePlayback, setIsLivePlayback] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track the last created object URL to revoke it when it's no longer needed
  const previousObjectURLRef = useRef<string | null>(null);

  // Helper to manage object URL creation and cleanup
  const createPreviewUrl = useCallback((blob: Blob | File): string => {
    if (previousObjectURLRef.current) {
      URL.revokeObjectURL(previousObjectURLRef.current);
    }
    const url = URL.createObjectURL(blob);
    previousObjectURLRef.current = url;
    return url;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup Object URL
      if (previousObjectURLRef.current) {
        URL.revokeObjectURL(previousObjectURLRef.current);
      }
      // Cleanup Transcriber
      if (transcriberRef.current) {
        transcriberRef.current.stop();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Cleanup when video is cleared or switched externally (e.g. history restore)
  useEffect(() => {
    if (previousObjectURLRef.current && currentVideo?.previewUrl !== previousObjectURLRef.current) {
        URL.revokeObjectURL(previousObjectURLRef.current);
        previousObjectURLRef.current = null;
    }
  }, [currentVideo]);

  // Reset view mode when new video loads
  useEffect(() => {
    setViewMode('video');
    setIsLivePlayback(false);
    if (transcriberRef.current) {
      transcriberRef.current.stop();
      transcriberRef.current = null;
    }
  }, [currentVideo?.id]);

  // --- Live Transcription Logic ---

  const startLiveRecording = async () => {
    try {
      if (!onLiveUpdate) return;
      if (onLiveStart) onLiveStart();
      
      const transcriber = new LiveTranscriber(onLiveUpdate);
      await transcriber.connect();
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1
        } 
      });
      
      transcriber.start(stream);
      transcriberRef.current = transcriber;
      
      // Also setup recording for the file
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], "recording.webm", { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        processFile(file);
        setRecordingDuration(0);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      
      timerRef.current = window.setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Error starting live recording:", err);
      setError("Could not access microphone or connect to Live API.");
    }
  };

  const stopLiveRecording = () => {
    if (transcriberRef.current) {
      transcriberRef.current.stop();
      transcriberRef.current = null;
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const toggleLivePlayback = async () => {
    if (isLivePlayback) {
      // Stop
      if (transcriberRef.current) {
        transcriberRef.current.stop();
        transcriberRef.current = null;
      }
      setIsLivePlayback(false);
      if (videoRef.current) {
        videoRef.current.pause();
      }
    } else {
      // Start
      if (!videoRef.current || !onLiveUpdate) return;
      if (onLiveStart) onLiveStart();
      
      try {
        const transcriber = new LiveTranscriber(onLiveUpdate);
        await transcriber.connect();
        
        // Capture audio from video element (Cross-browser support)
        let stream;
        const vid = videoRef.current as any;
        if (vid.captureStream) {
          stream = vid.captureStream();
        } else if (vid.mozCaptureStream) {
          stream = vid.mozCaptureStream();
        } else {
          throw new Error("captureStream not supported in this browser");
        }
        
        // Only audio track is needed
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
           setError("No audio track found in media.");
           return;
        }

        transcriber.start(stream);
        transcriberRef.current = transcriber;
        setIsLivePlayback(true);
        videoRef.current.play();

      } catch (err) {
        console.error("Failed to start live playback analysis:", err);
        setError("Could not start live analysis. Browser might restrict capturing media from this source.");
      }
    }
  };

  // --- File Handling ---

  const processFile = useCallback((file: File) => {
    setError(null);
    
    // Check file type (Video or Audio)
    if (!file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
      setError(`Invalid file type (${file.type || 'unknown'}). Please upload a video or audio file.`);
      return;
    }

    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      setError(`File is too large (${fileSizeMB.toFixed(1)}MB). The limit is ${MAX_FILE_SIZE_MB}MB for this demo.`);
      return;
    }

    setUploadProgress(1); // Initialize progress

    const reader = new FileReader();

    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);
      }
    };

    reader.onload = (e) => {
      const result = e.target?.result as string;
      const base64Data = result.split(',')[1];
      
      // Create a local object URL to avoid CORS issues in preview
      const blobUrl = createPreviewUrl(file);

      onVideoSelected({
        id: crypto.randomUUID(),
        sourceType: 'upload',
        file,
        previewUrl: blobUrl,
        base64Data,
        mimeType: file.type,
        name: file.name,
        size: file.size
      });
      setUploadProgress(0);
    };

    reader.onerror = () => {
      setError("Unable to read file data. The file may be corrupted or locked by another process.");
      setUploadProgress(0);
    };

    reader.readAsDataURL(file);
  }, [onVideoSelected, createPreviewUrl]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (uploadProgress > 0) return;

    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (uploadProgress > 0) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // --- URL Handling ---

  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleUrlSubmit = async () => {
    setError(null);
    let processedInput = urlInput.trim();

    if (!processedInput) {
      setError("Please enter a URL.");
      return;
    }

    // Auto-prepend https:// if missing
    if (!/^https?:\/\//i.test(processedInput)) {
      processedInput = `https://${processedInput}`;
    }

    setUrlInput(processedInput);

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(processedInput);
    } catch (_) {
      setError("Invalid URL format. Please check for typos.");
      return;
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
         setError("Only HTTP and HTTPS protocols are supported.");
         return;
    }
    
    if (!parsedUrl.hostname.includes('.')) {
         setError("Invalid domain name.");
         return;
    }

    const isYoutubeDomain = parsedUrl.hostname.includes('youtube.com') || parsedUrl.hostname.includes('youtu.be');
    const ytId = getYoutubeId(processedInput);

    if (isYoutubeDomain && !ytId) {
        setError("This looks like a YouTube link, but no valid Video ID was found. Please check that you are using a link to a specific video.");
        return;
    }

    setIsProcessingUrl(true);

    try {
      if (ytId) {
        let title = `YouTube Video (${ytId})`;
        try {
            const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(processedInput)}`);
            const data = await response.json();
            if (data.title) title = data.title;
        } catch (e) {
            console.warn("Could not fetch YouTube title:", e);
        }

        onVideoSelected({
          id: ytId,
          sourceType: 'youtube',
          url: processedInput,
          previewUrl: `https://www.youtube.com/embed/${ytId}`,
          name: title,
          mimeType: 'video/mp4'
        });
        setIsProcessingUrl(false);
        return;
      }

      try {
        const response = await fetch(processedInput, { method: 'HEAD' });
        
        if (response.status === 404) throw new Error("File not found (404).");
        if (response.status === 403 || response.status === 401) throw new Error("Access denied.");
        if (response.status >= 500) throw new Error("Server error.");

        const fullResponse = await fetch(processedInput);
        if (!fullResponse.ok) throw new Error(`Failed to download media (Status: ${fullResponse.status})`);

        let blob = await fullResponse.blob();
        
        // Robust MIME type check
        if (!blob.type.startsWith('video/') && !blob.type.startsWith('audio/')) {
           // Check extension
           const ext = processedInput.split('.').pop()?.toLowerCase();
           let newType = null;
           
           if (ext) {
             if (['mp4', 'm4v', 'mov', 'webm', 'mkv'].includes(ext)) newType = `video/${ext === 'mkv' ? 'x-matroska' : ext}`;
             else if (['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'].includes(ext)) newType = `audio/${ext}`;
           }

           if (newType) {
              blob = new Blob([blob], { type: newType });
           } else {
              if (blob.type.includes('text/html')) {
                console.warn("URL returned HTML, falling back to search.");
                throw new Error("__FALLBACK_TO_SEARCH__");
              }
              throw new Error(`URL points to '${blob.type}', not a supported media file.`); 
           }
        }

        const fileSizeMB = blob.size / (1024 * 1024);
        if (fileSizeMB > MAX_FILE_SIZE_MB) {
          console.warn("Media too large for local processing, falling back to search.");
          throw new Error("__FALLBACK_TO_SEARCH__");
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          const blobUrl = createPreviewUrl(blob);

          onVideoSelected({
            id: crypto.randomUUID(),
            sourceType: 'url',
            url: processedInput,
            previewUrl: blobUrl, 
            base64Data,
            mimeType: blob.type,
            name: processedInput.split('/').pop() || 'Remote Media',
            size: blob.size
          });
          setIsProcessingUrl(false);
        };
        reader.onerror = () => { throw new Error("Failed to process downloaded media data."); }
        reader.readAsDataURL(blob);

      } catch (directFetchError: any) {
        
        if (directFetchError.message !== "__FALLBACK_TO_SEARCH__" && 
           (directFetchError.message.includes("404") || 
            directFetchError.message.includes("Access denied") ||
            directFetchError.message.includes("points to"))) {
             throw directFetchError;
        }
        
        const ext = processedInput.split('.').pop()?.toLowerCase();
        let fallbackMime = 'application/x-url';
        
        if (ext && ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) {
            fallbackMime = 'audio/' + ext; 
        } else if (ext && ['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext)) {
            fallbackMime = 'video/' + ext; 
        }

        onVideoSelected({
          id: crypto.randomUUID(),
          sourceType: 'url',
          url: processedInput,
          previewUrl: processedInput,
          base64Data: undefined,
          name: processedInput.split('/').pop() || 'External Content',
          mimeType: fallbackMime
        });
        setIsProcessingUrl(false);
      }

    } catch (err: any) {
      setError(err.message || "Failed to process URL.");
      setIsProcessingUrl(false);
    }
  };

  // --- Render ---

  if (currentVideo) {
    const isSearchAnalysis = !currentVideo.base64Data && currentVideo.sourceType !== 'upload';
    const isAudio = currentVideo.mimeType?.startsWith('audio/');
    const isVideo = currentVideo.mimeType?.startsWith('video/');
    
    // We can use the visualizer if it's a local file or if we successfully downloaded the remote file (has base64Data)
    const hasLocalData = currentVideo.sourceType === 'upload' || 
                         currentVideo.sourceType === 'record' || 
                         (currentVideo.sourceType === 'url' && currentVideo.base64Data);

    const isMediaAvailable = currentVideo.previewUrl && currentVideo.previewUrl.length > 0;

    const showVisualizer = (isAudio || (isVideo && viewMode === 'waveform')) && hasLocalData && isMediaAvailable;
    const canDoLive = hasLocalData && isMediaAvailable;

    // Show large preview only for local uploads/recordings
    const showLargePreview = currentVideo.sourceType === 'upload' || currentVideo.sourceType === 'record';

    return (
      <div className="w-full bg-white dark:bg-zinc-900 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-xl transition-colors duration-300">
        
        {showLargePreview && (
          <div className="relative aspect-video bg-black flex items-center justify-center group">
            {!isMediaAvailable ? (
              <div className="flex flex-col items-center justify-center text-zinc-500 gap-3">
                  <div className="p-4 rounded-full bg-zinc-800/50">
                    <FolderOpen size={48} className="opacity-50" />
                  </div>
                  <p>Media file not stored in history.</p>
                  <p className="text-xs opacity-60">Result available below.</p>
              </div>
            ) : showVisualizer ? (
              <WaveformVisualizer src={currentVideo.previewUrl} isDarkMode={isDarkMode} />
            ) : isAudio ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-900 gap-4 transition-colors">
                <div className="w-24 h-24 rounded-full bg-indigo-500/10 flex items-center justify-center animate-pulse">
                    <Music size={48} className="text-indigo-500" />
                </div>
                <audio 
                  ref={videoRef as any} 
                  src={currentVideo.previewUrl} 
                  controls 
                  className="w-2/3" 
                  crossOrigin="anonymous"
                />
              </div>
            ) : (
              <video 
                ref={videoRef}
                src={currentVideo.previewUrl} 
                controls 
                className="w-full h-full object-contain"
                crossOrigin="anonymous"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement?.classList.add('bg-zinc-900');
                }}
              />
            )}
            
            {/* Controls Overlay */}
            <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 pointer-events-none">
              {/* Toggle Waveform */}
              {isVideo && hasLocalData && isMediaAvailable && (
                <button
                  onClick={() => setViewMode(prev => prev === 'video' ? 'waveform' : 'video')}
                  className="pointer-events-auto p-2.5 bg-black/60 hover:bg-indigo-500/90 text-zinc-200 hover:text-white rounded-full transition-all backdrop-blur-md border border-white/10"
                  title={viewMode === 'video' ? "View Audio Waveform" : "View Video Player"}
                >
                  {viewMode === 'video' ? <AudioLines size={18} /> : <MonitorPlay size={18} />}
                </button>
              )}
              
              {/* Live Transcription Toggle (for playback) */}
              {canDoLive && onLiveUpdate && (
                <button
                    onClick={toggleLivePlayback}
                    className={`pointer-events-auto px-4 py-2.5 rounded-full transition-all backdrop-blur-md border border-white/10 flex items-center gap-2 shadow-lg ${isLivePlayback ? 'bg-red-500/90 hover:bg-red-600/90 text-white animate-pulse' : 'bg-black/60 hover:bg-indigo-500/90 text-zinc-200 hover:text-white'}`}
                    title="Process audio in real-time while playing"
                >
                    <Activity size={18} />
                    <span className="text-xs font-bold whitespace-nowrap">{isLivePlayback ? 'LIVE TRANSCRIPTION ON' : 'Live Transcribe'}</span>
                </button>
              )}
            </div>

            <button 
              onClick={onClear}
              disabled={disabled}
              className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-red-500/80 text-white rounded-full transition-colors backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed z-20"
              title="Remove media"
            >
              <X size={20} />
            </button>
          </div>
        )}

        <div className="p-4 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 transition-colors bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className={`p-2 rounded-lg ${currentVideo.sourceType === 'youtube' ? 'bg-red-500/10' : 'bg-indigo-500/10'}`}>
              {currentVideo.sourceType === 'youtube' ? (
                <Youtube className="text-red-500" size={20} />
              ) : isAudio ? (
                <Music className="text-indigo-600 dark:text-indigo-400" size={20} />
              ) : (
                <FileVideo className="text-indigo-600 dark:text-indigo-400" size={20} />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-200 truncate max-w-[200px] sm:max-w-md">
                {currentVideo.name}
              </p>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                {isSearchAnalysis ? (
                   <span className="flex items-center gap-1 text-amber-600 dark:text-amber-500/80 bg-amber-500/10 px-1.5 py-0.5 rounded">
                     <Search size={10} /> Web Search Analysis
                   </span>
                ) : (
                   <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-500/80 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                     {isAudio ? <Mic size={10} /> : <FileVideo size={10} />} Deep Analysis
                   </span>
                )}
                <span>•</span>
                <span>
                  {currentVideo.sourceType === 'upload' && currentVideo.size 
                    ? `${(currentVideo.size / (1024 * 1024)).toFixed(1)} MB`
                    : currentVideo.sourceType === 'youtube' 
                      ? 'YouTube'
                      : 'Remote URL'}
                </span>
                {isLivePlayback && (
                   <>
                    <span>•</span>
                    <span className="text-red-500 font-bold animate-pulse">Live API Active</span>
                   </>
                )}
              </div>
            </div>
          </div>
          
          {!showLargePreview && (
             <button 
                onClick={onClear}
                disabled={disabled}
                className="p-2 hover:bg-red-500/10 text-zinc-400 hover:text-red-500 rounded-full transition-colors"
                title="Remove media"
              >
                <X size={20} />
              </button>
          )}
        </div>
      </div>
    );
  }

  // (The rest of the component remains unchanged, returning the tabs and upload areas)
  return (
    <div className="w-full bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm dark:shadow-none transition-colors duration-300">
      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => { setError(null); setActiveTab('upload'); }}
          disabled={isProcessingUrl || uploadProgress > 0}
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'upload' ? 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white border-b-2 border-indigo-500' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/30'} ${isProcessingUrl || uploadProgress > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Upload size={16} />
          Upload
        </button>
        <button
          onClick={() => { setError(null); setActiveTab('record'); }}
          disabled={isProcessingUrl || uploadProgress > 0}
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'record' ? 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white border-b-2 border-indigo-500' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/30'} ${isProcessingUrl || uploadProgress > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Mic size={16} />
          Record
        </button>
        <button
          onClick={() => { setError(null); setActiveTab('link'); }}
          disabled={isProcessingUrl || uploadProgress > 0}
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'link' ? 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white border-b-2 border-indigo-500' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/30'} ${isProcessingUrl || uploadProgress > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <LinkIcon size={16} />
          URL
        </button>
      </div>

      <div className="p-6 bg-white dark:bg-transparent transition-colors">
        {activeTab === 'upload' && (
          <div 
            className={`
              relative w-full h-64 rounded-xl border-2 border-dashed transition-all duration-300 ease-in-out flex flex-col items-center justify-center gap-4 cursor-pointer
              ${dragActive ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600'}
              ${uploadProgress > 0 ? 'cursor-default pointer-events-none' : ''}
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => !isProcessingUrl && uploadProgress === 0 && fileInputRef.current?.click()}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              className="hidden" 
              accept="video/*,audio/*" 
              onChange={handleFileChange}
            />
            
            {uploadProgress > 0 ? (
               <div className="w-full max-w-xs mx-auto text-center space-y-4 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium px-1">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                       <div 
                           className="h-full bg-indigo-500 transition-all duration-100 ease-linear shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                           style={{ width: `${uploadProgress}%` }}
                       />
                  </div>
                  <div className="flex items-center justify-center gap-2 text-zinc-500 text-xs">
                     <Loader2 size={12} className="animate-spin" />
                     <span>Processing media data</span>
                  </div>
               </div>
            ) : (
                <>
                    <div className={`p-4 rounded-full ${dragActive ? 'bg-indigo-500 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400'}`}>
                    <Upload size={32} />
                    </div>
                    
                    <div className="text-center px-4">
                    <p className="text-lg font-medium text-zinc-700 dark:text-zinc-200">
                        Click to upload or drag and drop
                    </p>
                    <p className="text-sm text-zinc-500 mt-1">
                        Video or Audio files (Max {MAX_FILE_SIZE_MB}MB)
                    </p>
                    </div>
                </>
            )}
          </div>
        )}

        {activeTab === 'record' && (
          <div className="h-64 flex flex-col items-center justify-center gap-6 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800/50 transition-colors">
             {!isRecording ? (
                <>
                  <div className="p-4 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                     <Mic size={48} />
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-200">Record Audio</h3>
                    <p className="text-sm text-zinc-500 mt-1">Record voice notes or meetings directly</p>
                  </div>
                  <button
                    onClick={startLiveRecording}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-medium transition-all shadow-lg shadow-indigo-500/30"
                  >
                    Start Recording
                  </button>
                </>
             ) : (
                <>
                  <div className="relative p-6 rounded-full bg-red-500/10 text-red-500 animate-pulse">
                     <Mic size={48} />
                     <span className="absolute inset-0 rounded-full border-2 border-red-500/50 animate-ping"></span>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-mono font-bold text-zinc-700 dark:text-zinc-200">
                      {formatDuration(recordingDuration)}
                    </div>
                    <p className="text-xs text-red-500 dark:text-red-400 mt-1 font-medium tracking-wide">RECORDING ACTIVE</p>
                  </div>
                  <button
                    onClick={stopLiveRecording}
                    className="px-6 py-2 bg-white dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-500/20 text-zinc-700 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-500 border border-zinc-300 dark:border-zinc-700 hover:border-red-500/50 rounded-full font-medium transition-all flex items-center gap-2"
                  >
                    <StopCircle size={18} />
                    Stop & Use
                  </button>
                </>
             )}
          </div>
        )}

        {activeTab === 'link' && (
          <div className="h-64 flex flex-col justify-center gap-4">
             <div className="text-center space-y-2">
               <div className="inline-flex p-3 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mb-2">
                 <LinkIcon size={32} />
               </div>
               <h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-200">Import Media</h3>
               <p className="text-sm text-zinc-500 max-w-sm mx-auto">
                 Paste a YouTube link or a direct link to a file.
                 <br />
                 <span className="text-xs opacity-70">Direct links (mp4, mp3, wav) enable deep analysis.</span>
               </p>
             </div>

             <div className="w-full max-w-lg mx-auto mt-2">
               <div className="flex gap-2">
                 <input 
                   type="text" 
                   placeholder="https://example.com/audio.mp3"
                   className={`flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all ${isProcessingUrl ? 'opacity-50 cursor-not-allowed bg-zinc-100 dark:bg-zinc-900' : ''}`}
                   value={urlInput}
                   onChange={(e) => setUrlInput(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && !isProcessingUrl && handleUrlSubmit()}
                   disabled={isProcessingUrl}
                 />
                 <button 
                   onClick={handleUrlSubmit}
                   disabled={isProcessingUrl || !urlInput.trim()}
                   className={`
                     px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 min-w-[100px] justify-center
                     ${isProcessingUrl || !urlInput.trim() 
                         ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                         : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'}
                   `}
                 >
                   {isProcessingUrl ? (
                     <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Check</span>
                     </>
                   ) : (
                     <>Add <ArrowRight size={16}/></>
                   )}
                 </button>
               </div>
             </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
};