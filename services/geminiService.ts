import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { SummaryMode, VideoData, ProcessingTier } from "../types";

// Helper to get the core instructional prompt for the specific mode
const getPromptForMode = (mode: SummaryMode): string => {
  switch (mode) {
    case SummaryMode.TRANSCRIPT:
      return "Provide a verbatim transcription of the spoken content. Do not summarize. Capture the speech exactly as it is spoken.";
    case SummaryMode.KEY_POINTS:
      return "Analyze the content and provide a structured list of the key points, main topics discussed, and critical takeaways. Use bullet points.";
    case SummaryMode.ACTION_ITEMS:
      return "Extract any action items, to-do tasks, or next steps mentioned. If none are explicitly stated, infer potential next steps based on the context. Format as a checklist.";
    case SummaryMode.SENTIMENT:
      return "Analyze the overall sentiment and tone. Describe the emotional state, atmosphere, and delivery style. Is it positive, negative, neutral, urgent, or relaxed?";
    case SummaryMode.OVERVIEW:
    default:
      return "Provide a comprehensive but concise summary. Cover the who, what, where, when, and why. Ensure the summary flows logically and captures the essence of the content.";
  }
};

export const generateVideoSummary = async (
  video: VideoData,
  mode: SummaryMode,
  tier: ProcessingTier
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Model Selection based on Tier
    let modelId = "gemini-2.5-flash"; // Default (Balanced)
    if (tier === ProcessingTier.FAST) {
      modelId = "gemini-flash-lite-latest";
    } else if (tier === ProcessingTier.THINKING) {
      modelId = "gemini-3-pro-preview";
    }

    let contents: any;
    let config: any = {
      temperature: 0.4,
    };

    // Configure Thinking Mode
    if (tier === ProcessingTier.THINKING) {
      config.thinkingConfig = { thinkingBudget: 32768 };
      // Note: Do not set maxOutputTokens when using thinking budget for max reasoning
    }

    // Priority 1: Visual/Audio Analysis (Base64 Data Available)
    if (video.base64Data && video.mimeType) {
      const prompt = getPromptForMode(mode);
      
      contents = {
        parts: [
          {
            inlineData: {
              mimeType: video.mimeType,
              data: video.base64Data,
            },
          },
          {
            text: prompt,
          },
        ],
      };
    
    // Priority 2: Search Grounding (URL Available, no Base64)
    } else if (video.url) {
      // Stronger prompt to overcome refusal to summarize YouTube links
      let targetOutput = getPromptForMode(mode);
      
      // If asking for a Transcript via URL, we must be flexible because a perfect transcript might not exist online.
      if (mode === SummaryMode.TRANSCRIPT) {
        targetOutput = "Attempt to find a verbatim transcript via search. If a full transcript is unavailable, provide a highly detailed, chronological summary of the spoken content, quoting specific phrases where possible. Do NOT refuse the request.";
      }

      const searchPrompt = `
        You are analyzing the video titled "${video.name}" at: ${video.url}

        **Your Goal:**
        Use the Google Search tool to research this video's content, finding transcripts, descriptions, reviews, and summaries from the web.
        Combine this search data with your own internal knowledge about this video or topic.

        **Task:**
        ${targetOutput}
        
        **CRITICAL INSTRUCTIONS:**
        - Do NOT say "I cannot watch the video".
        - Do NOT say "I cannot find a transcript".
        - If direct text is missing, synthesize the best possible response from the available search information.
        - You MUST provide a result based on what you find.
      `;
      
      contents = {
        parts: [{ text: searchPrompt }]
      };

      config.tools = [{ googleSearch: {} }];

    } else {
      throw new Error("Invalid media data source. No file data or URL provided.");
    }

    const response = await ai.models.generateContent({
      model: modelId,
      contents: contents,
      config: config
    });

    if (response.text) {
      return response.text;
    }
    
    throw new Error("No summary generated. The model returned an empty response.");

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Failed to generate summary. Please try again.");
  }
};

export const generateSpeech = async (text: string): Promise<ArrayBuffer> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // Truncate text if too long to avoid token limits for TTS
    const safeText = text.length > 2000 ? text.substring(0, 2000) + "..." : text;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: safeText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio generated.");
    }

    // Decode Base64 to ArrayBuffer
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;

  } catch (error: any) {
    console.error("TTS Error:", error);
    throw new Error("Failed to generate speech.");
  }
};

// --- Live API Transcriber ---

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): any {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

export class LiveTranscriber {
  public onUpdate: (text: string) => void;
  private sessionPromise: Promise<any> | null = null;
  private inputAudioContext: AudioContext | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;

  constructor(onUpdate: (text: string) => void) {
    this.onUpdate = onUpdate;
  }

  async connect() {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    this.sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: () => {
          console.log('Live session connected');
        },
        onmessage: (message: LiveServerMessage) => {
          if (message.serverContent?.inputTranscription?.text) {
             this.onUpdate(message.serverContent.inputTranscription.text);
          }
          if (message.serverContent?.outputTranscription?.text) {
             // Optionally handle model output transcription if it participates
          }
        },
        onerror: (e: any) => {
          console.error('Live session error:', e);
        },
        onclose: () => {
          console.log('Live session closed');
        }
      },
      config: {
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {}, 
      }
    });
    
    await this.sessionPromise;
  }

  start(stream: MediaStream) {
    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 16000});
    const source = this.inputAudioContext.createMediaStreamSource(stream);
    
    this.scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
    
    this.scriptProcessor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmBlob = createBlob(inputData);
        
        if (this.sessionPromise) {
            this.sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
            });
        }
    };
    
    source.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.inputAudioContext.destination);
  }

  stop() {
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    if (this.inputAudioContext) {
      this.inputAudioContext.close();
      this.inputAudioContext = null;
    }
    if (this.sessionPromise) {
        this.sessionPromise.then(session => session.close());
        this.sessionPromise = null;
    }
  }
}