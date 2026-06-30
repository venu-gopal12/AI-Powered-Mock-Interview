# AI Mock Interviewer

An AI-powered mock interview platform for software-engineering candidates. It
uses a candidate's resume and interview preferences to run an adaptive
interview, accept text or spoken answers, and produce an evidence-based
scorecard with a focused practice plan.

## Features

- Configurable target role, experience level, duration, interview style, and
  topic focus
- Adaptive interview phases: introduction, project deep dive, technical,
  problem solving, and closing
- PDF resume upload for context-aware questions
- Text answers and microphone recording with editable transcription
- One-sentence hints that are excluded from the interview history and grading
- Optional Monaco code-editor attachments
- Technical and communication scorecards with strengths, gaps, evidence, and
  recommended practice questions
- Local performance dashboard and read-only review of previous interviews
- Automatic recovery of an active interview after a page refresh
- Guided product tour and responsive light/dark interface

> [!NOTE]
> The code editor is a scratchpad: submitted code is attached as text and is
> never executed. Resume text is passed directly to the model as delimited,
> untrusted context; this project does not use a vector database or RAG.

## Tech stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, Vite, Axios |
| Interface | Monaco Editor, React Markdown, Recharts, Lucide, React Joyride |
| Backend | Node.js, Express 5 |
| AI | LangChain, Groq Llama 3.3 70B |
| Speech | Groq Whisper Large V3 Turbo |
| Files | Multer, `pdf-parse` |
| Tests | Node.js test runner, Vitest, Testing Library |

## How it works

1. The candidate configures the interview and optionally uploads a PDF resume.
2. The Express API extracts up to 10,000 characters of resume text.
3. A single AI interviewer selects questions and adjusts the topic and
   difficulty while tracking interview progress.
4. The candidate answers with text, speech, or an optional code attachment.
5. On completion, the API generates a normalized scorecard and interview title.
6. The browser stores a compact copy for review and performance analytics.

## Getting started

### Prerequisites

- Node.js 20 or newer
- npm
- A [Groq API key](https://console.groq.com/keys)

### Installation

```bash
git clone <your-repository-url>
cd ai-mock-interviewer
npm install
npm --prefix client install
```

Create the server environment file:

```bash
# macOS/Linux
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

Add your Groq API key to `.env`:

```dotenv
GROQ_API_KEY=your_groq_api_key
```

### Run locally

Start the API from the project root:

```bash
npm start
```

In a second terminal, start the frontend:

```bash
npm --prefix client run dev
```

Open `http://localhost:5173`. The API runs on
`http://localhost:5000` by default, and `GET /health` can be used as a health
check.

## Environment variables

### Server (`.env`)

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `GROQ_API_KEY` | Yes | — | Groq key used for interviewing, grading, and transcription |
| `PORT` | No | `5000` | Express server port |
| `ALLOWED_ORIGINS` | No | `http://localhost:5173` | Comma-separated exact CORS origins |
| `AI_TIMEOUT_MS` | No | `40000` | Timeout for AI requests |
| `RATE_LIMIT_WINDOW_MS` | No | `60000` | Rate-limit window per IP/session |
| `RATE_LIMIT_MAX` | No | `30` | Maximum requests during one rate-limit window |

### Client

Set this when the API is hosted somewhere other than
`http://localhost:5000`:

```dotenv
VITE_API_URL=https://api.example.com
```

Vite reads client variables at build time. Put the value in `client/.env` for
local development or configure it in the frontend deployment environment.

## API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Check API availability |
| `POST` | `/upload-resume` | Validate and extract text from one PDF resume |
| `POST` | `/transcribe` | Transcribe a supported audio recording |
| `POST` | `/interview` | Submit an answer and receive the next question |
| `POST` | `/hint` | Generate a hint for the current question |
| `POST` | `/end-interview` | Generate the scorecard and interview title |

Resume uploads are limited to 5 MB. Audio uploads are limited to 10 MB and
support WebM, Ogg, WAV, MP3, and MP4 when the file signature matches its MIME
type.

## Available scripts

From the project root:

```bash
npm start                    # Start the Express API
npm test                     # Run backend tests
npm --prefix client run dev  # Start the Vite development server
npm --prefix client test     # Run frontend tests once
npm --prefix client run build # Create a production frontend build
```

## Project structure

```text
.
├── agent.js                 # Interview, hint, title, and grading prompts
├── server.js                # Express API and upload handling
├── transcription.js        # Groq Whisper integration
├── validation.js           # Request and scorecard validation
├── rateLimit.js             # In-memory request limiter
├── test/                    # Backend tests
└── client/
    ├── src/
    │   ├── App.jsx          # Navigation and saved-session review
    │   ├── Interview.jsx    # Main interview experience
    │   ├── Scorecard.jsx    # Interview results
    │   ├── Dashboard.jsx    # Local performance analytics
    │   └── sessionStorage.js
    └── vite.config.js
```

## Security and data handling

- Uploaded files are held in memory and are not intentionally persisted by the
  server.
- The API validates request shapes, upload sizes, MIME types, and file
  signatures.
- Resume content is clearly delimited as untrusted model context.
- Hints are removed from interview context and grading.
- Conversation length and model-generated scorecard content are bounded.
- CORS, per-IP/session rate limiting, and request timeouts are configurable.
- Up to 30 compact completed sessions are stored in the browser's
  `localStorage`; there is no account system or server-side session database.

Before exposing the app publicly, add authentication, durable storage,
distributed rate limiting, monitoring, and an explicit resume and interview
data-retention policy.

## Current limitations

- Browser speech recording requires `MediaRecorder` support, microphone
  permission, and a supported audio format.
- Interview responses use request/response calls rather than token streaming.
- Sessions do not sync across browsers or devices.
- AI-generated grading is practice feedback, not an objective hiring decision.
- The production frontend bundle would benefit from lazy loading Monaco and
  charting components.
