# Lingo

An AI-powered speech confidence coach. Practice live conversations, read passages aloud, and rehearse short prompts — Lingo scores your delivery, gives you actionable feedback, and grows an elemental companion alongside you.

Built at KeanHack with Snowflake Cortex as the default LLM provider, plus a tasteful Solana devnet integration for Pro subscriptions.

---

## What it does

- **Live Conversation Practice** — Talk to one of five AI personas (Sana, Theo, Jax, Mira, Arcas), each with a distinct Deepgram voice. The model returns the next turn, a "thought bubble" of what your partner is thinking, plus per-turn scores.
- **Reading Practice** — Read a passage aloud; the AI grades pacing, clarity, and pronunciation against the source text.
- **Verbiage Training** — Short prompts that ask you to tell a one-minute story or explain a concept. You get phrase-level feedback on filler words, hedging, and structure.
- **Companion System** — An 8-question survey assigns you a Fire, Water, Leaf, or Lightning companion. The companion levels up (1 → 3) as you earn XP, and the entire UI re-themes around its element.
- **Light / Dark Mode** — Element-aware theming in both modes.
- **Solana Pro Tier** — Optional 0.1 USDC payment on devnet (via Phantom + Helius RPC) verified server-side before the tier is upgraded.

---

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | React 18, Vite 6, Tailwind CSS, Lucide icons |
| Backend | Node.js, Express 4, ESM, `node --watch` |
| Database | MongoDB Atlas + Mongoose |
| Auth | JWT + bcrypt |
| LLM (primary) | **Snowflake Cortex** (`openai-gpt-4.1`) |
| LLM (fallback) | Google Gemini / Gemma |
| Speech-to-text | ElevenLabs Scribe |
| Text-to-speech | Deepgram Aura 2 (per-persona voices) |
| Wallet / Pay | Solana web3.js, SPL Token, Phantom wallet adapter, Helius devnet RPC |

---

## Architecture

```
client/  (React + Vite, port 5173)
   ├─ AuthContext  ──────────────  JWT in localStorage
   ├─ Practice screens  ─────────  POST /api/{conversation,reading,verbiage}
   ├─ RecorderButton  ───────────  POST /api/voice (ElevenLabs STT)
   └─ SolanaUpgrade  ────────────  POST /api/subscription/verify

server/  (Express, port 5001 by default)
   ├─ /api/auth        signup, login, /me, /survey
   ├─ /api/conversation   live chat turn + scoring
   ├─ /api/reading        passage + transcript analysis
   ├─ /api/verbiage       prompt + response analysis
   ├─ /api/voice          STT (multipart upload)
   ├─ /api/history        per-user activity log
   ├─ /api/me             profile, subscription
   ├─ /api/subscription   USDC tx verification on Solana devnet
   └─ /api/cortex         direct Cortex passthrough

services/
   ├─ gemmaService     Snowflake Cortex first → Gemma fallback → local fallback
   ├─ snowflakeSqlService   raw Cortex SQL helper
   ├─ elevenLabsService    STT
   └─ solanaVerification   on-chain USDC transfer check (mint, amount, recipient)
```

The AI router (`server/src/services/gemmaService.js`) tries Snowflake Cortex first if `SNOWFLAKE_ACCOUNT` and `SNOWFLAKE_TOKEN` are set; falls back to Gemini if `GEMMA_API_KEY` is set; and falls back to a local deterministic stub otherwise. This means the UI works end-to-end before any API keys are wired up — useful for demos.

---

## Quick start

### Prerequisites

- Node.js 20+ (for `node --watch`)
- A free MongoDB Atlas cluster
- API keys for whichever providers you want (Snowflake Cortex, ElevenLabs, Deepgram). All optional — the app falls back gracefully.

### Install

```bash
git clone https://github.com/NotSllaim/KeanHack-SNN.git
cd KeanHack-SNN
npm install
npm run install:all      # installs server + client
```

### Configure

```bash
cp .env.example .env
```

Then edit `.env` — see [Configuration](#configuration) below for what each block does.

### Run

```bash
npm run dev
```

That spins up:

- API on `http://localhost:5001` (or whatever you set `PORT=` to)
- Client on `http://localhost:5173`

---

## Configuration

The repo uses a **single root `.env`** file. The server walks up the directory tree to find it, so you do not need separate `.env` files in `client/` and `server/`.

### Required

| Variable | Purpose |
| --- | --- |
| `PORT` | Server port. **Use `5001`, not `5000`** — see Troubleshooting. |
| `CLIENT_ORIGIN` | CORS allow-list (default `http://localhost:5173`) |
| `MONGODB_URI` | Atlas connection string |
| `JWT_SECRET` | Random ≥32-char string |
| `JWT_EXPIRES_IN` | e.g. `7d` |
| `VITE_API_URL` | Must match your server, e.g. `http://localhost:5001/api` |

### LLM (pick one or both)

| Variable | Purpose |
| --- | --- |
| `AI_PROVIDER` | `snowflake` (default) or `gemini` |
| `SNOWFLAKE_ACCOUNT` | Snowflake account identifier (e.g. `ABCDEFG-XY12345`) |
| `SNOWFLAKE_TOKEN` | Programmatic Access Token (PAT) — note: JWTs expire |
| `SNOWFLAKE_MODEL` | Default `openai-gpt-4.1` |
| `GEMMA_API_KEY` | Google AI key (used when Snowflake is unset or AI_PROVIDER=gemini) |
| `GEMMA_API_URL` | Gemini/Gemma generateContent endpoint |
| `GEMMA_MODEL` | e.g. `gemini-2.5-flash-lite` |
| `AI_DEBUG` | `true` to log prompt/response metadata |

### Voice

| Variable | Purpose |
| --- | --- |
| `ELEVENLABS_API_KEY` | Speech-to-text |
| `ELEVENLABS_STT_MODEL_ID` | e.g. `scribe_v1` |
| `DEEPGRAM_API_KEY` | Text-to-speech |
| `DEEPGRAM_TTS_*_MODEL_ID` | One Aura 2 voice ID per persona (Sana / Theo / Jax / Mira / default) |

### Solana subscription (optional — only needed for Pro upgrade flow)

| Variable | Purpose |
| --- | --- |
| `VITE_HELIUS_DEVNET_RPC`, `HELIUS_DEVNET_RPC` | Helius devnet RPC URL |
| `VITE_MERCHANT_WALLET`, `MERCHANT_WALLET` | Recipient wallet (your devnet wallet) |
| `VITE_USDC_MINT_DEVNET`, `USDC_MINT_DEVNET` | USDC mint (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`) |
| `VITE_SUBSCRIPTION_PRICE_USDC`, `SUBSCRIPTION_PRICE_USDC` | e.g. `0.1` |
| `SUBSCRIPTION_DURATION_DAYS` | e.g. `30` |

The `VITE_*` and unprefixed pairs hold the same value — Vite only exposes `VITE_`-prefixed vars to the browser, while the server reads the unprefixed ones.

---

## Project layout

```
KeanHack-SNN/
├─ client/                  React + Vite SPA
│  ├─ src/
│  │  ├─ components/        Practice screens, auth, dashboard, wallet
│  │  ├─ state/             AuthContext
│  │  ├─ utils/             audioAnalysis, etc.
│  │  ├─ public/            Companion sprites (fire1.png … lightning3.png)
│  │  └─ styles.css         Tailwind + element-themed CSS variables
│  └─ tailwind.config.js
├─ server/                  Express API
│  ├─ src/
│  │  ├─ routes/            One file per resource
│  │  ├─ services/          AI, voice, Solana
│  │  ├─ models/            User, Activity (Mongoose)
│  │  ├─ middleware/        requireAuth
│  │  ├─ utils/             tokens, xp, scoreAverages
│  │  └─ index.js
└─ .env.example
```

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Run server + client together (concurrently) |
| `npm run server` | Server only, with `node --watch` |
| `npm run client` | Client only (Vite dev) |
| `npm run build` | Production client bundle |
| `npm run install:all` | Install both subprojects |

---

## Troubleshooting

**`EADDRINUSE: address already in use :::5001`**
A previous server crashed without releasing the port. Kill it and rerun:
```bash
lsof -ti tcp:5001 | xargs kill -9
```

**Do not use `PORT=5000` on macOS.** Control Center binds 5000 (AirPlay Receiver) and you cannot kill it. Use `5001` and set `VITE_API_URL` to match.

**`AI fallback used: missing_config`**
Either no LLM keys are set, or the dev server was started before `.env` was saved. `node --watch` only restarts on `.js` source changes, not `.env` — stop and rerun `npm run dev` after editing env vars.

**Snowflake auth fails after working previously**
Snowflake PATs are JWTs and expire. Decode the `exp` claim — if it's in the past, mint a new one in Snowflake.

**Mongoose connect timeout**
Whitelist your IP in MongoDB Atlas (Network Access → Add Current IP), or use `0.0.0.0/0` for local dev only.

**Solana verification rejecting valid tx**
Confirm the merchant wallet, mint, and price in `.env` match what the client signed. Use Solana Explorer (devnet) to inspect the transfer instruction — the server checks recipient, mint, and amount, not just signature validity.

---

## Team / credits

Built for KeanHack. Powered by Snowflake Cortex, Gemini, ElevenLabs, Deepgram, MongoDB Atlas, and Helius.
