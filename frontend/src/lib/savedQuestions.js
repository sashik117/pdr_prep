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
  if (user) {
    const request = nextSaved ? api.saveQuestion(id) : api.unsaveQuestion(id);
    request
      .then((response) => {
        if (Array.isArray(response?.ids)) writeSavedIds(response.ids);
      })
      .catch(() => {
        writeSavedIds(ids);
      });
  }
  return nextSaved;
}

export async function loadSavedQuestionIds(user = null) {
  const localIds = readSavedIds();
  if (!user) return localIds;
  const response = await api.getSavedQuestionIds();
  const serverIds = Array.isArray(response?.ids) ? response.ids.map(String).filter(Boolean) : [];
  const mergedIds = Array.from(new Set([...localIds, ...serverIds]));
  writeSavedIds(mergedIds);
  if (localIds.some((id) => !serverIds.includes(id))) {
    api.syncSavedQuestionIds(mergedIds).catch(() => {});
  }
  return mergedIds;
}
