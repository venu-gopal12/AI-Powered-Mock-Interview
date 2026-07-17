import { STATUS } from 'react-joyride';

// Desktop targets can point directly at the resume button and editor panel
// because both are visible in the wide layout.
export const DESKTOP_TOUR_STEPS = [
  {
    target: '.tour-resume-step',
    content: 'Start by uploading your resume. The AI will parse it and tailor the interview to your experience.',
    skipBeacon: true,
    placement: 'bottom',
  },
  {
    target: '.tour-chat-step',
    content: 'Type your answers here, or use the microphone to speak naturally.',
    placement: 'top',
  },
  {
    target: '.tour-code-step',
    content: 'Write and submit real code here for technical questions.',
    placement: 'left',
  },
  {
    target: '.tour-end-step',
    content: "When you're done, click here to end the interview and get your scorecard.",
    placement: 'bottom-end',
  },
];

// Mobile uses stable controls that remain visible when panels are collapsed.
export const MOBILE_TOUR_STEPS = [
  {
    target: '.mobile-menu-toggle',
    content: 'Open this menu to upload your resume or start a new interview.',
    skipBeacon: true,
    placement: 'bottom-end',
  },
  {
    target: '.tour-chat-step',
    content: 'Type your answers here, or use the microphone to speak naturally.',
    placement: 'top',
  },
  {
    target: '.tour-code-tab',
    content: 'Switch to the Code tab when a technical question needs a coded solution.',
    placement: 'top',
  },
  {
    target: '.mobile-menu-toggle',
    content: "When you're done, open this menu and choose End to get your scorecard.",
    placement: 'bottom-end',
  },
];

export function hasCompletedTour(status) {
  // Closing Joyride should pause the tour, not mark it complete.
  return status === STATUS.FINISHED || status === STATUS.SKIPPED;
}
