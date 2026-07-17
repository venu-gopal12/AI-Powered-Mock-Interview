const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdf = require('pdf-parse');
const agent = require('./agent');
const transcription = require('./transcription');
const { createRateLimiter } = require('./rateLimit');
const {
  validateHistory,
  validateInterviewBody,
  normalizeScorecard,
} = require('./validation');
require('dotenv').config();

const PORT = process.env.PORT || 5000;
const MAX_HISTORY_CHARS = 30_000;

// Resume uploads stay in memory because the app only needs to parse the PDF
// once and never stores the original file on disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 2 },
});

// Voice answers can be larger than resumes, but are still bounded to prevent
// accidental or abusive large uploads.
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 1 },
});

// Only formats supported by the browser recorder / Groq transcription flow are
// accepted. The signature check below prevents a fake MIME type from passing.
const AUDIO_MIME_TYPES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp4',
]);

function hasAudioSignature(buffer, mimetype) {
  if (mimetype === 'audio/webm') {
    return buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  }
  if (mimetype === 'audio/ogg') return buffer.subarray(0, 4).toString() === 'OggS';
  if (mimetype === 'audio/wav' || mimetype === 'audio/x-wav') {
    return buffer.subarray(0, 4).toString() === 'RIFF';
  }
  if (mimetype === 'audio/mpeg') {
    return buffer.subarray(0, 3).toString() === 'ID3' || buffer[0] === 0xff;
  }
  if (mimetype === 'audio/mp4') return buffer.subarray(4, 8).toString() === 'ftyp';
  return false;
}

function cleanHistory(history) {
  // Hints are shown to the user, but must not become evidence for the
  // interviewer or scorecard.
  return history.filter((message) => message._isHint !== true);
}

function guardHistory(history) {
  // Live interview calls only need recent context, so keep them bounded for
  // latency and model-context safety.
  const clean = cleanHistory(history);
  let totalChars = clean.reduce((sum, message) => sum + message.text.length, 0);
  while (totalChars > MAX_HISTORY_CHARS && clean.length > 2) {
    totalChars -= clean.shift().text.length;
  }
  return clean;
}

function withTimeout(
  promise,
  timeoutMs = Number(process.env.AI_TIMEOUT_MS) || 40_000
) {
  // AI providers can occasionally hang; routes wrap long-running calls so the
  // client gets a clear 504 instead of waiting indefinitely.
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error('AI request timed out.');
      error.code = 'AI_TIMEOUT';
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function allowedOrigins() {
  // Comma-separated origins make local dev and deployed frontends configurable
  // without code changes.
  return (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function createApp(dependencies = { ...agent, ...transcription }) {
  // Dependencies are injectable so tests can exercise HTTP behavior without
  // making real AI or transcription requests.
  const app = express();
  const origins = allowedOrigins();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(
    cors({
      origin(origin, callback) {
        // Non-browser clients may omit Origin; browsers must match allowlist.
        if (!origin || origins.includes(origin)) return callback(null, true);
        return callback(new Error('Origin is not allowed by CORS.'));
      },
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'X-Session-ID'],
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(createRateLimiter({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
    max: Number(process.env.RATE_LIMIT_MAX) || 30,
  }));

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.post('/transcribe', audioUpload.single('audio'), async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No audio was uploaded.' });
      const mimetype = req.file.mimetype.split(';')[0].toLowerCase();
      // Check both claimed type and binary signature before sending bytes to
      // the transcription provider.
      if (!AUDIO_MIME_TYPES.has(mimetype) || !hasAudioSignature(req.file.buffer, mimetype)) {
        return res.status(400).json({ error: 'Unsupported audio format.' });
      }
      const transcript = await withTimeout(
        dependencies.transcribeAudio({
          buffer: req.file.buffer,
          filename: req.file.originalname || 'answer.webm',
          mimetype,
        })
      );
      if (!transcript) {
        return res.status(422).json({ error: 'No speech was detected.' });
      }
      return res.json({ transcript });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/upload-resume', upload.single('resume'), async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
      const hasPdfSignature = req.file.buffer.subarray(0, 5).toString() === '%PDF-';
      // Browser MIME types are not trustworthy by themselves, so require the
      // PDF file header as well.
      if (req.file.mimetype !== 'application/pdf' || !hasPdfSignature) {
        return res.status(400).json({ error: 'Only valid PDF files are accepted.' });
      }
      const data = await withTimeout(pdf(req.file.buffer), 15_000);
      return res.json({
        message: 'Resume received. The interviewer is reading it now...',
        resumeText: data.text.trim().slice(0, 10_000),
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/hint', async (req, res, next) => {
    try {
      const parsed = validateHistory(req.body?.history);
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      // Hints use the same transcript context but remain outside the official
      // interview history used for grading.
      const hint = await withTimeout(dependencies.generateHint(guardHistory(parsed.value)));
      return res.json({ hint });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/end-interview', async (req, res, next) => {
    try {
      const parsed = validateHistory(req.body?.history);
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      const history = cleanHistory(parsed.value);
      // Scorecard and title do not depend on each other, so they can run in
      // parallel under the same timeout wrapper.
      const [rawScorecard, rawTitle] = await withTimeout(
        Promise.all([
          dependencies.generateScorecard(history),
          dependencies.generateTitle(history),
        ])
      );
      const title =
        typeof rawTitle === 'string' && rawTitle.trim()
          ? rawTitle.replace(/[\r\n]/g, ' ').trim().slice(0, 80)
          : 'Mock Interview';
      return res.json({ scorecard: normalizeScorecard(rawScorecard, history), title });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/interview', async (req, res, next) => {
    try {
      const parsed = validateInterviewBody(req.body);
      if (parsed.error) return res.status(400).json({ error: parsed.error });
      const { message, history, resumeContext, interviewConfig, interviewState } = parsed.value;
      // The server owns validation and context trimming so the AI prompt never
      // receives unbounded client-supplied data.
      const result = await withTimeout(
        dependencies.runInterviewAgent(
          message,
          guardHistory(history),
          resumeContext,
          interviewConfig,
          interviewState
        )
      );
      return res.json({
        agent: result.agent,
        response: result.response,
        interviewState: result.interviewState,
      });
    } catch (error) {
      return next(error);
    }
  });

  app.use((error, _req, res, _next) => {
    // Keep client errors specific and hide unexpected internals behind a
    // generic response while still logging details for developers.
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ error: 'Invalid upload.', details: error.message });
    }
    if (error.message === 'Origin is not allowed by CORS.') {
      return res.status(403).json({ error: error.message });
    }
    if (error.code === 'AI_TIMEOUT') {
      return res.status(504).json({ error: 'The AI took too long to respond. Please retry.' });
    }
    console.error('Request failed:', error);
    return res.status(500).json({ error: 'The request could not be completed.' });
  });
  return app;
}

if (require.main === module) {
  const server = createApp().listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  // Express defaults can outlive the AI timeout; align HTTP timeouts so stuck
  // requests clean up promptly.
  server.requestTimeout = 50_000;
  server.headersTimeout = 55_000;
}

module.exports = {
  createApp,
  cleanHistory,
  guardHistory,
  hasAudioSignature,
  withTimeout,
};
