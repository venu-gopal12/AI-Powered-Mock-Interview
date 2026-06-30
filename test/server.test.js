const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');
const { normalizeScorecard } = require('../validation');

function startApp(overrides = {}) {
  const calls = [];
  const dependencies = {
    async runInterviewAgent(...args) {
      calls.push(args);
      return { agent: 'INTERVIEWER', response: 'Next question?' };
    },
    async generateHint() {
      return 'Think about the event loop.';
    },
    async generateScorecard() {
      return {
        technical_score: 99,
        communication_score: '7.4',
        feedback: 'Good work.',
        improvement: 'Review closures.',
      };
    },
    async generateTitle() {
      return 'JavaScript\nInterview';
    },
    async transcribeAudio() {
      return 'React uses a virtual DOM.';
    },
    ...overrides,
  };
  const server = createApp(dependencies).listen(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return { server, baseUrl, calls };
}

async function postAudio(baseUrl, bytes, type = 'audio/webm') {
  const form = new FormData();
  form.append('audio', new Blob([bytes], { type }), 'answer.webm');
  return fetch(`${baseUrl}/transcribe`, { method: 'POST', body: form });
}

async function post(baseUrl, path, body, headers = {}) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

test('rejects invalid interview input', async (t) => {
  const { server, baseUrl } = startApp();
  t.after(() => server.close());
  const response = await post(baseUrl, '/interview', { message: '', history: [] });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Message is required.' });
});

test('transcribes a validated WebM recording', async (t) => {
  let received;
  const { server, baseUrl } = startApp({
    async transcribeAudio(audio) {
      received = audio;
      return 'React uses a virtual DOM.';
    },
  });
  t.after(() => server.close());
  const webm = Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 0x01]);
  const response = await postAudio(baseUrl, webm);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    transcript: 'React uses a virtual DOM.',
  });
  assert.equal(received.mimetype, 'audio/webm');
});

test('rejects audio with a forged MIME type', async (t) => {
  const { server, baseUrl } = startApp();
  t.after(() => server.close());
  const response = await postAudio(baseUrl, Buffer.from('not audio'));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Unsupported audio format.' });
});

test('passes prior history once and the current answer separately', async (t) => {
  const { server, baseUrl, calls } = startApp();
  t.after(() => server.close());
  const history = [{ sender: 'INTERVIEWER', text: 'What is a closure?' }];
  const response = await post(baseUrl, '/interview', {
    message: 'A function retaining lexical scope.',
    history,
    resumeContext: '',
    interviewConfig: {
      role: 'Backend Engineer',
      level: 'mid',
      duration: 30,
      style: 'strict',
      focus: 'backend',
    },
    interviewState: {
      phase: 'technical',
      current_topic: 'Closures',
      difficulty: 2,
      follow_ups_on_topic: 1,
      questions_answered: 3,
    },
  });
  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'A function retaining lexical scope.');
  assert.deepEqual(calls[0][1], history);
  assert.equal(calls[0][3].role, 'Backend Engineer');
  assert.equal(calls[0][3].duration, 30);
  assert.equal(calls[0][4].current_topic, 'Closures');
});

test('normalizes generated scores and title', async (t) => {
  const { server, baseUrl } = startApp();
  t.after(() => server.close());
  const response = await post(baseUrl, '/end-interview', {
    history: [{ sender: 'user', text: 'A sufficiently detailed technical answer.' }],
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.scorecard.technical_score, 10);
  assert.equal(body.scorecard.communication_score, 7);
  assert.equal(body.title, 'JavaScript Interview');
});

test('builds a weighted evidence-based scorecard with deterministic metrics', () => {
  const result = normalizeScorecard(
    {
      technical: { correctness: 8, depth: 6, problem_solving: 7 },
      communication: { clarity: 9, structure: 7, confidence: 8 },
      strengths: [{ point: 'Explained closures', evidence: 'Referenced lexical scope.' }],
      weaknesses: [{ point: 'Missed tradeoffs', evidence: 'Did not mention memory retention.' }],
      recommended_actions: [{
        priority: 1,
        topic: 'Closures',
        action: 'Practice explaining closure tradeoffs.',
        practice_question: 'When can a closure retain too much memory?',
      }],
    },
    [
      { sender: 'user', text: 'This is a substantive first technical answer.' },
      { sender: 'HR_WHISPER', text: 'Think about scope.', _isHint: true },
      { sender: 'user', text: 'This is a substantive second technical answer.' },
      { sender: 'user', text: 'This is a substantive third technical answer.' },
    ]
  );
  assert.equal(result.technical_score, 7);
  assert.equal(result.communication_score, 8);
  assert.equal(result.overall_score, 7);
  assert.equal(result.interview_summary.questions_answered, 3);
  assert.equal(result.interview_summary.hints_used, 1);
  assert.equal(result.interview_summary.completion, 'complete');
  assert.equal(result.strengths[0].evidence, 'Referenced lexical scope.');
});

test('rejects disallowed browser origins', async (t) => {
  const { server, baseUrl } = startApp();
  t.after(() => server.close());
  const response = await post(
    baseUrl,
    '/interview',
    { message: 'hello', history: [] },
    { Origin: 'https://attacker.example' }
  );
  assert.equal(response.status, 403);
});

test('returns 504 when the AI exceeds its deadline', async (t) => {
  const previous = process.env.AI_TIMEOUT_MS;
  process.env.AI_TIMEOUT_MS = '10';
  const { server, baseUrl } = startApp({
    runInterviewAgent: () => new Promise(() => {}),
  });
  t.after(() => {
    server.close();
    if (previous === undefined) delete process.env.AI_TIMEOUT_MS;
    else process.env.AI_TIMEOUT_MS = previous;
  });
  const response = await post(baseUrl, '/interview', { message: 'hello', history: [] });
  assert.equal(response.status, 504);
});
