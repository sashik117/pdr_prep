const SAVED_QUESTIONS_KEY = 'driveprep_saved_questions';

function readSavedIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_QUESTIONS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeSavedIds(ids) {
  localStorage.setItem(SAVED_QUESTIONS_KEY, JSON.stringify(Array.from(new Set(ids.map(String)))));
  window.dispatchEvent(new CustomEvent('driveprep:saved-questions-change'));
}

export function getSavedQuestionIds() {
  return readSavedIds();
}

export function isQuestionSaved(questionId) {
  if (questionId === undefined || questionId === null) return false;
  return readSavedIds().includes(String(questionId));
}

export function toggleSavedQuestion(questionId) {
  if (questionId === undefined || questionId === null) return false;
  const id = String(questionId);
  const ids = readSavedIds();
  const exists = ids.includes(id);
  writeSavedIds(exists ? ids.filter((item) => item !== id) : [id, ...ids]);
  return !exists;
}
