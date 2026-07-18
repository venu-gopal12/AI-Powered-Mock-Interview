import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import Interview from './Interview';
import api from '../api/api';
import { loadJson } from '../utils/sessionStorage';

vi.mock('../api/api', () => ({
  default: {
    post: vi.fn(),
  },
}));

vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="code-editor" />,
}));

vi.mock('react-joyride', () => ({
  Joyride: () => null,
}));

vi.mock('../hooks/useInterviewSpeech', () => ({
  default: () => ({
    isListening: false,
    isTranscribing: false,
    isSpeaking: false,
    toggleListening: vi.fn(),
    speak: vi.fn(),
    stopSpeaking: vi.fn(),
  }),
}));

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  window.confirm = vi.fn(() => true);
});

it('saves the completed session, shows the scorecard, and starts fresh after close', async () => {
  localStorage.setItem(
    'interviewMessages',
    JSON.stringify([
      { sender: 'INTERVIEWER', text: 'Tell me about yourself.' },
      { sender: 'user', text: 'I build React and Node apps.' },
    ])
  );

  api.post.mockResolvedValueOnce({
    data: {
      title: 'Full-Stack Interview',
      scorecard: {
        overall_score: 8,
        technical_score: 8,
        communication_score: 7,
        feedback: 'Good practical examples.',
        improvement: 'Add more tradeoff detail.',
      },
    },
  });

  const onInterviewEnd = vi.fn();
  render(<Interview onInterviewEnd={onInterviewEnd} />);

  fireEvent.click(screen.getByRole('button', { name: /^end$/i }));

  expect(await screen.findByText('Interview Scorecard')).toBeInTheDocument();
  expect(screen.getAllByText('8/10').length).toBeGreaterThan(0);
  expect(loadJson('savedSessions', [])).toHaveLength(1);
  expect(loadJson('savedSessions', [])[0].title).toBe('Full-Stack Interview');
  expect(onInterviewEnd).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole('button', { name: /close/i }));

  await waitFor(() => {
    expect(screen.getByText('AI Mock Interviewer')).toBeInTheDocument();
  });
  expect(screen.queryByText('I build React and Node apps.')).not.toBeInTheDocument();
  expect(loadJson('savedSessions', [])).toHaveLength(1);
  expect(onInterviewEnd).toHaveBeenCalledTimes(2);
});
