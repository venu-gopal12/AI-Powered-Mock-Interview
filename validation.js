const MAX_MESSAGE_CHARS = 12_000;
const MAX_RESUME_CHARS = 10_000;
// Sender values include older multi-agent names so previously saved sessions
// can still be reviewed after the app moved to one interviewer persona.
const ALLOWED_SENDERS = new Set([
  'user',
  'INTERVIEWER',
  'TECH_LEAD',
  'HR',
  'HR_WHISPER',
  'system',
]);
const LEVELS = new Set(['junior', 'mid', 'senior']);
const DURATIONS = new Set([20, 40, 60]);
const STYLES = new Set(['supportive', 'balanced', 'strict']);
const FOCUSES = new Set(['resume', 'frontend', 'backend', 'full-stack', 'behavioral']);
const PHASES = new Set(['introduction', 'project_deep_dive', 'technical', 'problem_solving', 'closing']);

function validateInterviewConfig(value = {}) {
  // Normalize user-configurable interview settings and fall back to the default
  // setup when a client sends an unsupported value.
  const role =
    typeof value.role === 'string' && value.role.trim()
      ? value.role.trim().slice(0, 80)
      : 'Full-Stack Developer';
  return {
    role,
    level: LEVELS.has(value.level) ? value.level : 'junior',
    duration: DURATIONS.has(Number(value.duration)) ? Number(value.duration) : 20,
    style: STYLES.has(value.style) ? value.style : 'balanced',
    focus: FOCUSES.has(value.focus) ? value.focus : 'resume',
  };
}

function validateInterviewState(value = {}) {
  // Clamp progress metadata because the browser stores it locally and may send
  // stale or manually edited values.
  return {
    phase: PHASES.has(value.phase) ? value.phase : 'introduction',
    current_topic:
      typeof value.current_topic === 'string'
        ? value.current_topic.trim().slice(0, 100)
        : '',
    difficulty: Math.max(1, Math.min(3, Math.round(Number(value.difficulty)) || 1)),
    follow_ups_on_topic: Math.max(
      0,
      Math.min(2, Math.round(Number(value.follow_ups_on_topic)) || 0)
    ),
    questions_answered: Math.max(
      0,
      Math.min(50, Math.round(Number(value.questions_answered)) || 0)
    ),
  };
}

function validateHistory(value) {
  // History arrives from the browser, so every message is checked before it is
  // trusted by the server or passed to an AI model.
  if (value === undefined) return { value: [] };
  if (!Array.isArray(value)) return { error: 'History must be an array.' };
  if (value.length > 200) return { error: 'History contains too many messages.' };

  const messages = [];
  for (const message of value) {
    if (!message || typeof message !== 'object') {
      return { error: 'Every history entry must be an object.' };
    }
    if (!ALLOWED_SENDERS.has(message.sender) || typeof message.text !== 'string') {
      return { error: 'Every history entry requires a valid sender and text.' };
    }
    if (message.text.length > MAX_MESSAGE_CHARS) {
      return { error: 'A history message is too long.' };
    }
    messages.push({
      sender: message.sender,
      text: message.text,
      ...(message._isHint === true ? { _isHint: true } : {}),
    });
  }
  return { value: messages };
}

function validateInterviewBody(body = {}) {
  // Validate the full /interview payload in one place so route handlers can
  // stay focused on orchestration.
  if (typeof body.message !== 'string' || !body.message.trim()) {
    return { error: 'Message is required.' };
  }
  if (body.message.length > MAX_MESSAGE_CHARS) {
    return { error: 'Message is too long.' };
  }
  const history = validateHistory(body.history);
  if (history.error) return history;
  if (body.resumeContext !== undefined && typeof body.resumeContext !== 'string') {
    return { error: 'Resume context must be text.' };
  }
  return {
    value: {
      message: body.message.trim(),
      history: history.value,
      resumeContext: (body.resumeContext || '').slice(0, MAX_RESUME_CHARS),
      interviewConfig: validateInterviewConfig(body.interviewConfig),
      interviewState: validateInterviewState(body.interviewState),
    },
  };
}

function scorecardMetrics(history = []) {
  // These metrics are deterministic and are merged into scorecards regardless
  // of what the grader model returns.
  const questionsAnswered = history.filter(
    (message) =>
      message?.sender === 'user' &&
      message._isHint !== true &&
      typeof message.text === 'string' &&
      message.text.trim().length > 20
  ).length;
  return {
    questions_answered: questionsAnswered,
    hints_used: history.filter((message) => message?._isHint === true).length,
    completion:
      questionsAnswered === 0
        ? 'incomplete'
        : questionsAnswered >= 3
          ? 'complete'
          : 'partial',
  };
}

function normalizeScorecard(value, history = []) {
  // Coerce model output into the shape the UI expects. This protects older
  // scorecards and malformed model responses from breaking rendering.
  const score = (input) => {
    const number = Number(input);
    return Number.isFinite(number)
      ? Math.max(0, Math.min(10, Math.round(number)))
      : 0;
  };
  const text = (input, fallback = '') =>
    typeof input === 'string' ? input.trim().slice(0, 500) : fallback;
  const technical = {
    correctness: score(value?.technical?.correctness ?? value?.technical_score),
    depth: score(value?.technical?.depth ?? value?.technical_score),
    problem_solving: score(
      value?.technical?.problem_solving ?? value?.technical_score
    ),
  };
  const communication = {
    clarity: score(value?.communication?.clarity ?? value?.communication_score),
    structure: score(value?.communication?.structure ?? value?.communication_score),
    confidence: score(value?.communication?.confidence ?? value?.communication_score),
  };
  const average = (values) =>
    Math.round(values.reduce((sum, item) => sum + item, 0) / values.length);
  const technicalScore = average(Object.values(technical));
  const communicationScore = average(Object.values(communication));
  const evidenceItems = (items) =>
    // Evidence lists are intentionally short so the scorecard remains scannable.
    Array.isArray(items)
      ? items.slice(0, 3).map((item) => ({
          point: text(item?.point, 'Observation'),
          evidence: text(item?.evidence, 'Based on the interview transcript.'),
        }))
      : [];
  const strengths = evidenceItems(value?.strengths);
  const weaknesses = evidenceItems(value?.weaknesses);
  const recommendedActions = Array.isArray(value?.recommended_actions)
    ? value.recommended_actions.slice(0, 3).map((item, index) => ({
        priority: Math.max(1, Math.min(3, Math.round(Number(item?.priority)) || index + 1)),
        topic: text(item?.topic, 'Interview practice'),
        action: text(item?.action, 'Review this topic and explain it aloud.'),
        practice_question: text(
          item?.practice_question,
          'How would you explain this concept with an example?'
        ),
      }))
    : [];

  return {
    overall_score: Math.round(technicalScore * 0.6 + communicationScore * 0.4),
    technical_score: technicalScore,
    communication_score: communicationScore,
    technical,
    communication,
    strengths,
    weaknesses,
    recommended_actions: recommendedActions,
    interview_summary: scorecardMetrics(history),
    feedback:
      strengths[0]?.point ||
      text(value?.feedback, 'Complete more answers to reveal your strengths.'),
    improvement:
      recommendedActions[0]?.action ||
      weaknesses[0]?.point ||
      text(value?.improvement, 'Practice explaining answers with examples and tradeoffs.'),
  };
}

module.exports = {
  validateHistory,
  validateInterviewBody,
  normalizeScorecard,
  scorecardMetrics,
  validateInterviewConfig,
  validateInterviewState,
};
