# Lingo Confidence Coach

A full-stack speech confidence practice app built for hackathon and portfolio use.

## Stack

- React + Vite frontend
- Tailwind CSS styling
- Node.js + Express backend API
- MongoDB Atlas with Mongoose models
- bcrypt password hashing and JWT authentication
- Google Gemini/Gemma service wrapper for chat and feedback analysis
- ElevenLabs service wrapper for text-to-speech and speech-to-text

## Setup

1. Install dependencies:

```bash
npm install
npm run install:all
```

2. Copy `.env.example` to `.env` at the repository root and fill in the values.

3. Start the app:

```bash
npm run dev
# or
npm start
```

The client runs on `http://localhost:5173` and the API runs on `http://localhost:5000`.

## Features

- Sign up and log in with hashed passwords
- Full-screen 8-question post-signup survey that assigns each user a Fire, Water, Leaf, or Lightning companion element
- User profiles, scores, activity history, and feedback stored in MongoDB Atlas
- Live conversation practice with selectable AI personalities
- Speech bubbles, AI thought bubbles, response scoring, and ElevenLabs TTS
- Microphone recording with ElevenLabs transcription
- Speech reading practice with passage analysis
- Verbiage training with phrase-level feedback

The AI and voice services include demo fallbacks, so the UI can still be tested before API keys are added.
