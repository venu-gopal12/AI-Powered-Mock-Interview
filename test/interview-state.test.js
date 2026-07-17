const test = require('node:test');
const assert = require('node:assert/strict');
const {
  targetQuestions,
  phaseForProgress,
  parseInterviewerResponse,
  formatHistory,
} = require('../agent');
const { validateInterviewConfig, validateInterviewState } = require('../validation');

// These tests pin the deterministic state helpers that keep the AI interview
// flow predictable across browser refreshes and malformed client input.
test('maps interview duration to a bounded question plan', () => {
  assert.equal(targetQuestions(20), 8);
  assert.equal(targetQuestions(40), 16);
  assert.equal(targetQuestions(60), 22);
});

test('progresses through realistic interview phases', () => {
  assert.equal(phaseForProgress(0, 7), 'introduction');
  assert.equal(phaseForProgress(2, 7), 'project_deep_dive');
  assert.equal(phaseForProgress(4, 7), 'technical');
  assert.equal(phaseForProgress(6, 7), 'problem_solving');
  assert.equal(phaseForProgress(7, 7), 'closing');
});

test('parses structured interviewer metadata safely', () => {
  assert.deepEqual(
    parseInterviewerResponse('{"message":"Why?","topic":"Caching","difficulty":2,"follow_up":true}'),
    { message: 'Why?', topic: 'Caching', difficulty: 2, follow_up: true }
  );
  assert.equal(parseInterviewerResponse('plain text fallback'), null);
});

test('can keep full history for final grading while trimming live context by default', () => {
  const history = [
    { sender: 'user', text: `old evidence ${'x'.repeat(7000)}` },
    { sender: 'INTERVIEWER', text: `question ${'y'.repeat(7000)}` },
    { sender: 'user', text: `new evidence ${'z'.repeat(7000)}` },
  ];

  assert.equal(formatHistory(history).length, 2);
  assert.equal(formatHistory(history, { maxChars: Infinity }).length, 3);
  assert.match(formatHistory(history, { maxChars: Infinity })[0].content, /^old evidence/);
});

test('sanitizes anonymous client configuration and state', () => {
  const config = validateInterviewConfig({
    role: 'Backend Engineer',
    level: 'invalid',
    duration: 999,
    style: 'strict',
    focus: 'backend',
  });
  assert.equal(config.role, 'Backend Engineer');
  assert.equal(config.level, 'junior');
  assert.equal(config.duration, 20);
  const state = validateInterviewState({
    phase: 'technical',
    difficulty: 99,
    follow_ups_on_topic: 9,
  });
  assert.equal(state.phase, 'technical');
  assert.equal(state.difficulty, 3);
  assert.equal(state.follow_ups_on_topic, 2);
});
