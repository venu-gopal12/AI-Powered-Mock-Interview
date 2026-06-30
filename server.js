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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 2 },
});

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 1 },
});

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

function guardHistory(history) {
  const clean = history.filter((message) => message._isHint !== true);
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
  return (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function createApp(dependencies = { ...agent, ...transcription }) {
  const app = express();
  const origins = allowedOrigins();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(
    cors({
      origin(origin, callback) {
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
      const history = guardHistory(parsed.value);
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
  server.requestTimeout = 50_000;
  server.headersTimeout = 55_000;
}

module.exports = { createApp, guardHistory, hasAudioSignature, withTimeout };
