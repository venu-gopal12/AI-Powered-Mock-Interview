export function targetQuestions(duration) {
  const minutes = Number(duration);
  if (minutes === 40) return 16;
  if (minutes === 60) return 22;
  return 8;
}

export function createInitialInterviewState(duration) {
  return {
    phase: 'introduction',
    current_topic: '',
    difficulty: 1,
    follow_ups_on_topic: 0,
    questions_answered: 0,
    target_questions: targetQuestions(duration),
  };
}
