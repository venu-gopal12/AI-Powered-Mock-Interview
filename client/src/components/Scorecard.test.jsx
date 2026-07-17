import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import Scorecard from './Scorecard';

// Scorecard tests cover both the current detailed schema and older saved
// sessions that only contain aggregate feedback strings.
it('renders evidence and a targeted practice plan', () => {
  render(<Scorecard scorecard={{
    overall_score: 7,
    technical_score: 7,
    communication_score: 8,
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
    interview_summary: { questions_answered: 3, hints_used: 1, completion: 'complete' },
  }} />);

  expect(screen.getAllByText('7/10').length).toBeGreaterThan(0);
  expect(screen.getByText('Explained closures')).toBeInTheDocument();
  expect(screen.getByText(/Referenced lexical scope/)).toBeInTheDocument();
  expect(screen.getByText(/When can a closure retain too much memory/)).toBeInTheDocument();
  expect(screen.getByText(/3 substantive answers/)).toBeInTheDocument();
});

it('renders old saved scorecards through compatibility fallbacks', () => {
  render(<Scorecard scorecard={{
    technical_score: 6,
    communication_score: 8,
    feedback: 'Clear explanations.',
    improvement: 'Add more examples.',
  }} />);
  expect(screen.getByText('Clear explanations.')).toBeInTheDocument();
  expect(screen.getByText('Add more examples.')).toBeInTheDocument();
});
