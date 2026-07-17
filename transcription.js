const Groq = require('groq-sdk');
const { toFile } = require('groq-sdk');

let client;

function getClient() {
  // Create the Groq client lazily so tests can import this module without
  // needing a real API key until transcription is actually requested.
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured.');
  }
  if (!client) client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return client;
}

async function transcribeAudio({ buffer, filename, mimetype }) {
  // Groq expects a File-like object, so convert the uploaded memory buffer while
  // preserving the browser-provided filename and MIME type.
  const file = await toFile(buffer, filename, { type: mimetype });
  const result = await getClient().audio.transcriptions.create({
    file,
    model: 'whisper-large-v3-turbo',
    language: 'en',
    temperature: 0,
    response_format: 'json',
    // Domain vocabulary helps Whisper choose technical terms during interviews.
    prompt:
      'Technical software engineering interview. Common terms include JavaScript, TypeScript, React, Node.js, Express, API, SQL, MongoDB, C++, Python, Git, HTTP, CSS, and HTML.',
  });
  return result.text.trim();
}

module.exports = { transcribeAudio };
