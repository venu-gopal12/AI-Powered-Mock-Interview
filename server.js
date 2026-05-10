const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdf = require('pdf-parse');
const { runInterviewAgent, generateHint, generateScorecard, generateTitle } = require('./agent');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Limits ───────────────────────────────────────────────────────────────────

// Max characters of history accepted per request (~30k chars ≈ ~7k tokens).
// Prevents a buggy or malicious client from sending a massive payload straight
// to the LLM.
const MAX_HISTORY_CHARS = 30_000;

// Max resume size: 5MB (multer default is no limit — that's dangerous)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json({ limit: '2mb' })); // prevent oversized JSON payloads too

// ─── Guards ───────────────────────────────────────────────────────────────────

/**
 * Serialize history to a string and truncate if it exceeds MAX_HISTORY_CHARS.
 * Trims from the front (oldest messages) to preserve recent context.
 */
function guardHistory(history) {
  if (!Array.isArray(history)) return [];

  // Remove hint messages server-side as well (defence in depth)
  const clean = history.filter((m) => m._isHint !== true);

  let totalChars = clean.reduce((sum, m) => sum + (m.text?.length || 0), 0);
  while (totalChars > MAX_HISTORY_CHARS && clean.length > 2) {
    const removed = clean.shift();
    totalChars -= removed.text?.length || 0;
  }
  return clean;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// 1. Resume upload
app.post('/upload-resume', upload.single('resume'), async (req, res) => {
  console.log('📥 Resume upload received');
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    // FIX #10: Validate MIME type server-side, not just the browser's file picker
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Only PDF files are accepted.' });
    }

    console.log(`📄 Parsing: ${req.file.originalname} (${req.file.size} bytes)`);
    const data = await pdf(req.file.buffer);
    console.log(`✅ Parsed. Text length: ${data.text.length}`);

    res.json({
      message: "Resume received. The interviewer is reading it now...",
      resumeText: data.text,
    });
  } catch (error) {
    console.error('🔥 PDF parse error:', error);
    res.status(500).json({ error: 'Failed to parse PDF.', details: error.message });
  }
});

// 2. Hint
app.post('/hint', async (req, res) => {
  try {
    const history = guardHistory(req.body.history);
    const hint = await generateHint(history);
    console.log('💡 Hint generated');
    res.json({ hint });
  } catch (error) {
    console.error('Hint error:', error);
    res.status(500).json({ error: 'Could not generate hint.' });
  }
});

// 3. End interview
app.post('/end-interview', async (req, res) => {
  try {
    const history = guardHistory(req.body.history);

    // Run scorecard and title generation in parallel
    const [scorecardData, smartTitle] = await Promise.all([
      generateScorecard(history),
      generateTitle(history),
    ]);

    console.log('✅ Scorecard generated');
    res.json({ scorecard: scorecardData, title: smartTitle });
  } catch (error) {
    console.error('End-interview error:', error);
    res.status(500).json({ error: 'Could not generate session results.' });
  }
});

// 4. Main interview endpoint
// FIX #9: History is guarded before being passed to the LLM
app.post('/interview', async (req, res) => {
  try {
    const { message, resumeContext } = req.body;
    const history = guardHistory(req.body.history);

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    console.log('User said:', message.slice(0, 80));

    const result = await runInterviewAgent(message, history, resumeContext || '');
    res.json({ agent: result.agent, response: result.response });
  } catch (error) {
    console.error('Interview error:', error);
    res.status(500).json({ error: 'Something went wrong with the AI.' });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
