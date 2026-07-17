import { describe, expect, it } from 'vitest';
import { createInitialInterviewState, targetQuestions } from './interviewPlan';

describe('interview plan', () => {
  it('maps supported durations to the expected question targets', () => {
    expect(targetQuestions(20)).toBe(8);
    expect(targetQuestions(40)).toBe(16);
    expect(targetQuestions(60)).toBe(22);
  });

  it('creates initial progress from the selected duration', () => {
    expect(createInitialInterviewState(40)).toMatchObject({
      phase: 'introduction',
      questions_answered: 0,
      target_questions: 16,
    });
  });
});
