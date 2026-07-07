import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearActiveSession,
  compactMessages,
  hasActiveSession,
  loadJson,
  saveCompletedSession,
} from './sessionStorage';

describe('session storage', () => {
  beforeEach(() => localStorage.clear());

  it('recovers safely from malformed JSON', () => {
    localStorage.setItem('broken', '{');
    expect(loadJson('broken', [])).toEqual([]);
  });

  it('bounds stored transcript size', () => {
    const messages = Array.from({ length: 100 }, (_, index) => ({
      sender: 'user',
      text: `${index}-${'x'.repeat(5_000)}`,
    }));
    const compact = compactMessages(messages);
    expect(compact).toHaveLength(80);
    expect(compact[0].text.length).toBeLessThanOrEqual(4_000);
  });

  it('keeps only the latest 30 completed sessions', () => {
    for (let index = 0; index < 35; index += 1) {
      saveCompletedSession({ _id: String(index), messages: [] });
    }
    const saved = loadJson('savedSessions', []);
    expect(saved).toHaveLength(30);
    expect(saved[0]._id).toBe('5');
  });

  it('clears only the active interview', () => {
    localStorage.setItem('interviewMessages', JSON.stringify([{ text: 'hello' }]));
    localStorage.setItem('interviewResumeContext', 'resume');
    localStorage.setItem('interviewConfig', '{"duration":40}');
    localStorage.setItem('interviewState', '{"phase":"technical"}');
    localStorage.setItem('savedSessions', '[]');
    expect(hasActiveSession()).toBe(true);
    clearActiveSession();
    expect(hasActiveSession()).toBe(false);
    expect(localStorage.getItem('interviewConfig')).toBeNull();
    expect(localStorage.getItem('interviewState')).toBeNull();
    expect(localStorage.getItem('savedSessions')).toBe('[]');
  });
});
