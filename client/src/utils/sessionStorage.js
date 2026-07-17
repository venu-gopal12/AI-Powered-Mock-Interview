export const MAX_SAVED_SESSIONS = 30;
export const MAX_REVIEW_MESSAGES = 80;
export const MAX_REVIEW_MESSAGE_CHARS = 4_000;

export function loadJson(key, fallback) {
  // Local storage can be manually edited or corrupted; callers get a safe
  // fallback instead of a thrown parse error.
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function compactMessages(messages) {
  // Keep enough transcript for review while preventing localStorage from
  // ballooning after many long interviews.
  return messages.slice(-MAX_REVIEW_MESSAGES).map(({ sender, text, _isHint }) => ({
    sender,
    text: String(text).slice(0, MAX_REVIEW_MESSAGE_CHARS),
    ...(_isHint ? { _isHint: true } : {}),
  }));
}

export function saveCompletedSession(session) {
  // Completed sessions are append-only from the user's point of view, capped to
  // the latest attempts for browser storage health.
  const sessions = loadJson('savedSessions', []);
  const compact = { ...session, messages: compactMessages(session.messages || []) };
  localStorage.setItem(
    'savedSessions',
    JSON.stringify([...sessions, compact].slice(-MAX_SAVED_SESSIONS))
  );
}

export function clearActiveSession() {
  // Clear only in-progress interview data; savedSessions is intentionally left
  // alone so history and analytics remain available.
  localStorage.removeItem('interviewMessages');
  localStorage.removeItem('interviewResumeContext');
  localStorage.removeItem('interviewConfig');
  localStorage.removeItem('interviewState');
}

export function hasActiveSession() {
  return loadJson('interviewMessages', []).length > 0;
}
