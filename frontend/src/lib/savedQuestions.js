import api from '@/api/apiClient';

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

export function toggleSavedQuestion(questionId, user = null) {
  if (!user) return false;
  if (questionId === undefined || questionId === null) return false;
  const id = String(questionId);
  const ids = readSavedIds();
  const exists = ids.includes(id);
  const nextSaved = !exists;
  writeSavedIds(exists ? ids.filter((item) => item !== id) : [id, ...ids]);

  const request = nextSaved ? api.saveQuestion(id) : api.unsaveQuestion(id);
  request.catch(() => {
    // Keep optimistic local state; server will catch up on next sync.
  });

  return nextSaved;
}

export async function loadSavedQuestionIds(user = null) {
  const localIds = readSavedIds();
  if (!user) return localIds;

  let response;
  try {
    response = await api.getSavedQuestionIds();
  } catch {
    return localIds;
  }

  const serverIds = Array.isArray(response?.ids) ? response.ids.map(String).filter(Boolean) : [];
  const freshLocalIds = readSavedIds();
  const mergedIds = Array.from(new Set([...serverIds, ...freshLocalIds]));
  writeSavedIds(mergedIds);

  const unsynced = mergedIds.filter((item) => !serverIds.includes(item));
  if (unsynced.length) {
    api.syncSavedQuestionIds(mergedIds.map((item) => Number(item)).filter((item) => Number.isFinite(item))).catch(() => {});
  }

  return mergedIds;
}
