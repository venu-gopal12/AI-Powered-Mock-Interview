import { STATUS } from 'react-joyride';
import { describe, expect, it } from 'vitest';
import {
  DESKTOP_TOUR_STEPS,
  MOBILE_TOUR_STEPS,
  hasCompletedTour,
} from './interviewTour';

describe('interview tour', () => {
  it('only treats finished and skipped tours as completed', () => {
    expect(hasCompletedTour(STATUS.FINISHED)).toBe(true);
    expect(hasCompletedTour(STATUS.SKIPPED)).toBe(true);
    expect(hasCompletedTour(STATUS.PAUSED)).toBe(false);
    expect(hasCompletedTour(STATUS.RUNNING)).toBe(false);
  });

  it('uses targets that remain visible in the mobile layout', () => {
    const targets = MOBILE_TOUR_STEPS.map((step) => step.target);
    expect(targets).toContain('.mobile-menu-toggle');
    expect(targets).toContain('.tour-chat-step');
    expect(targets).toContain('.tour-code-tab');
    expect(targets).not.toContain('.tour-resume-step');
    expect(targets).not.toContain('.tour-code-step');
  });

  it('keeps the full desktop workflow', () => {
    expect(DESKTOP_TOUR_STEPS.map((step) => step.target)).toEqual([
      '.tour-resume-step',
      '.tour-chat-step',
      '.tour-code-step',
      '.tour-end-step',
    ]);
    expect(DESKTOP_TOUR_STEPS[0].skipBeacon).toBe(true);
    expect(MOBILE_TOUR_STEPS[0].skipBeacon).toBe(true);
  });
});
