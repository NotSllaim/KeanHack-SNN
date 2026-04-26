# Lingo Confidence Coach

A full-stack speech confidence practice app built for hackathon and portfolio use.

## Stack

- React + Vite frontend
- Tailwind CSS styling
- Node.js + Express backend API
- MongoDB Atlas with Mongoose models
- bcrypt password hashing and JWT authentication
- Google Gemini/Gemma service wrapper for chat and feedback analysis
- Deepgram TTS (with ElevenLabs fallback) and ElevenLabs STT

## Setup

1. Install dependencies for the root, server, and client:

```bash
npm install
npm install --prefix server
npm install --prefix client
```

You can also run `npm run install:all` to do the server + client installs in one shot after `npm install`.

2. Copy `.env.example` to `.env` at the repo root and fill in the values.

3. Start the app (runs server + client together):

```bash
npm run dev
```

The client runs on `http://localhost:5173` and the API runs on the port set in `.env` (`PORT`).

### macOS port note

Do **not** use `PORT=5000`. macOS Control Center binds port 5000 (AirPlay Receiver) and you cannot kill it. Use `PORT=5001` (or another free port) and set `VITE_API_URL=http://localhost:5001/api` to match.

## Features

- Sign up and log in with hashed passwords
- Full-screen 8-question post-signup survey that assigns each user a Fire, Water, Leaf, or Lightning companion element
- User profiles, scores, activity history, and feedback stored in MongoDB Atlas
- Live conversation practice with selectable AI personalities
- Speech bubbles, AI thought bubbles, response scoring, and Deepgram TTS
- Microphone recording with ElevenLabs transcription
- Speech reading practice with passage analysis
- Verbiage training with phrase-level feedback

The AI and voice services include demo fallbacks, so the UI can still be tested before API keys are added.
