/**
 * Spaced Repetition System (SM-2 algorithm simplified)
 * 
 * Each question has an "SRS card" with:
 * - interval: days until next review
 * - ease: difficulty factor (1.3 - 2.5)
 * - due_date: when to show again
 * - repetitions: how many times reviewed
 */

export function calculateNextReview(card = {}, wasCorrect) {
  const ease = card.ease || 2.5;
  const repetitions = card.repetitions || 0;
  const interval = card.interval || 1;

  let newEase = ease;
  let newInterval;
  let newReps;

  if (wasCorrect) {
    newReps = repetitions + 1;
    if (newReps === 1) newInterval = 1;
    else if (newReps === 2) newInterval = 3;
    else newInterval = Math.round(interval * ease);
    newEase = Math.max(1.3, ease + 0.1);
  } else {
    newReps = 0;
    newInterval = 1;
    newEase = Math.max(1.3, ease - 0.2);
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + newInterval);

  return {
    interval: newInterval,
    ease: newEase,
    repetitions: newReps,
    due_date: dueDate.toISOString().split('T')[0],
    last_reviewed: new Date().toISOString().split('T')[0],
  };
}

/**
 * From a progress record, get question IDs due for review today
 */
export function getDueQuestions(srsData = {}, allQuestionIds = []) {
  const today = new Date().toISOString().split('T')[0];
  const due = [];

  for (const qid of allQuestionIds) {
    const card = srsData[qid];
    if (!card) {
      // Never seen — add to due
      due.push(qid);
    } else if (card.due_date <= today) {
      due.push(qid);
    }
  }

  // Sort: overdue first, then by due date
  due.sort((a, b) => {
    const da = srsData[a]?.due_date || '0000-00-00';
    const db = srsData[b]?.due_date || '0000-00-00';
    return da.localeCompare(db);
  });

  return due;
}

/**
 * Update srsData object after answering
 */
export function updateSRSData(srsData = {}, questionId, wasCorrect) {
  const current = srsData[questionId] || {};
  const next = calculateNextReview(current, wasCorrect);
  return { ...srsData, [questionId]: next };
}