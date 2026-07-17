import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import App from './App';

// Mock page components so these tests focus on App-level navigation and storage
// behavior instead of the full interview UI.
vi.mock('./pages/Interview', () => ({
  default: () => <div>Interview workspace</div>,
}));
vi.mock('./pages/Dashboard', () => ({
  default: () => <div>Analytics view</div>,
}));

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

it('navigates to analytics', () => {
  render(<App />);
  fireEvent.click(screen.getByText(/Analytics Dashboard/i));
  expect(screen.getByText('Analytics view')).toBeInTheDocument();
});

it('clears active state when a new interview is confirmed', () => {
  localStorage.setItem('interviewMessages', JSON.stringify([{ text: 'answer' }]));
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(<App />);
  fireEvent.click(screen.getByText('New Interview'));
  expect(localStorage.getItem('interviewMessages')).toBeNull();
});
