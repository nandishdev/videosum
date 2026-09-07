export enum SummaryMode {
  OVERVIEW = 'Overview',
  KEY_POINTS = 'Key Points',
  ACTION_ITEMS = 'Action Items',
  SENTIMENT = 'Sentiment Analysis',
  TRANSCRIPT = 'Transcription'
}

export enum ProcessingTier {
  FAST = 'Fast (Flash Lite)',
  BALANCED = 'Standard (Flash)',
  THINKING = 'Deep Thinking (Pro 3)'
}

export type VideoSourceType = 'upload' | 'url' | 'youtube' | 'record';

export interface VideoData {
  id: string;
  sourceType: VideoSourceType;
  file?: File; // For uploads or recordings
  url?: string; // For remote URLs
  previewUrl: string; // Blob URL or Embed URL
  base64Data?: string; // For uploads, recordings or fetched direct links
  mimeType?: string;
  name: string;
  size?: number; // In bytes
}

export interface SummaryResult {
  text: string;
  timestamp: number;
}

export interface AnalysisState {
  isLoading: boolean;
  error: string | null;
  result: SummaryResult | null;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  videoName: string;
  sourceType: VideoSourceType;
  url?: string; // For remote/YouTube
  mode: SummaryMode;
  tier: ProcessingTier;
  resultText: string;
}
