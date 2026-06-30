export const MAX_SAVED_SESSIONS = 30;
export const MAX_REVIEW_MESSAGES = 80;
export const MAX_REVIEW_MESSAGE_CHARS = 4_000;

export function loadJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function compactMessages(messages) {
  return messages.slice(-MAX_REVIEW_MESSAGES).map(({ sender, text, _isHint }) => ({
    sender,
    text: String(text).slice(0, MAX_REVIEW_MESSAGE_CHARS),
    ...(_isHint ? { _isHint: true } : {}),
  }));
}

export function saveCompletedSession(session) {
  const sessions = loadJson('savedSessions', []);
  const compact = { ...session, messages: compactMessages(session.messages || []) };
  localStorage.setItem(
    'savedSessions',
    JSON.stringify([...sessions, compact].slice(-MAX_SAVED_SESSIONS))
  );
}

export function clearActiveSession() {
  localStorage.removeItem('interviewMessages');
  localStorage.removeItem('interviewResumeContext');
  localStorage.removeItem('interviewConfig');
  localStorage.removeItem('interviewState');
}

export function hasActiveSession() {
  return loadJson('interviewMessages', []).length > 0;
}
