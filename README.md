# VideoSumm 🎬

Transform Media into Insight with VideoSummAI. This is a modern React application that leverages Google's Gemini AI to analyze videos, audio files, and YouTube links, generating comprehensive summaries, transcripts, and overviews.

## Features ✨
- **Multi-Source Support:** Upload local video/audio files, paste YouTube links, or record directly from your browser.
- **AI-Powered Analysis:** Generate intelligent summaries and transcripts using Google's powerful Gemini AI models.
- **History Tracking:** Automatically saves your past summaries and analysis locally so you can revisit them anytime.
- **Live Transcription:** Get real-time text updates when recording audio/video.
- **Modern UI/UX:** Built with React, featuring a responsive design, sleek Dark/Light mode, and beautiful icons.

## Tech Stack 🛠️
- **Frontend:** React 19, TypeScript, Vite
- **Styling:** Tailwind CSS
- **AI Integration:** Google Gemini AI API (`@google/genai`)
- **Icons:** Lucide React

## Run Locally 🚀

**Prerequisites:** Node.js

1. Clone the repository:
   ```bash
   git clone https://github.com/nandishdev/videosum.git
   cd videosum
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set the `GEMINI_API_KEY` in `.env.local` to your Gemini API key.

4. Start the app:
   ```bash
   npm run dev
   ```

## Usage 💡
1. Open the app in your browser (usually `http://localhost:5173`).
2. Provide a video/audio source (Upload, Link, or Record).
3. Select your desired summary mode (Overview, Transcript) and processing tier.
4. Click Generate and let the AI do the magic!
