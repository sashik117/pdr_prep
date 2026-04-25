import api from '@/api/apiClient';

export const IMAGE_BASE_PATH = '/images/questions_img/';

/** @param {string | null | undefined} filename */
export function getImageUrl(filename) {
  if (!filename) return null;
  if (filename.startsWith('http')) return filename;
  return `${IMAGE_BASE_PATH}${filename}`;
}

/**
 * @param {import('@/types/questions').FetchQuestionsParams} [paramsArg]
 */
export async function fetchQuestions({ section, category, topic, ids, limit = 20, offset = 0, search } = {}) {
  /** @type {Record<string, string>} */
  const params = {};
  if (section) params.section = String(section);
  if (category) params.category = String(category);
  if (topic) params.topic = String(topic);
  if (ids?.length) params.ids = ids.join(',');
  if (search) params.search = String(search);
  params.limit = String(limit);
  params.offset = String(offset);
  return api.getQuestions(params);
}

/**
 * @param {{
 *   count?: number,
 *   section?: string | number,
 *   category?: string,
 *   topic?: string,
 *   excludeIds?: Array<string | number>,
 *   difficultOnly?: boolean,
 *   seed?: string
 * }} [paramsArg]
 */
export async function fetchRandomQuestions({
  count = 20,
  section,
  category,
  topic,
  excludeIds = [],
  difficultOnly = false,
  seed,
} = {}) {
  /** @type {Record<string, string>} */
  const params = { count: String(count) };
  if (section) params.section = String(section);
  if (category) params.category = String(category);
  if (topic) params.topic = String(topic);
  if (excludeIds.length > 0) params.exclude_ids = excludeIds.join(',');
  if (difficultOnly) params.difficult_only = 'true';
  if (seed) params.seed = seed;
  return api.getRandomQuestions(params);
}

/** @param {string | null | undefined} [category] */
export async function fetchSections(category) {
  return api.getSections(category);
}

/**
 * @param {{
 *   id?: number|string,
 *   question_text?: string,
 *   text?: string,
 *   options?: unknown[],
 *   correct_answer?: string,
 *   correct_ans?: number,
 *   explanation?: string,
 *   images?: unknown[],
 *   image_url?: string,
 *   category?: string,
 *   section_name?: string,
 *   topic?: string,
 *   section?: string|number,
 *   difficulty?: string,
 *   num_in_section?: number
 * } | null | undefined} q
 */
export function normalizeQuestion(q) {
  if (!q) return null;

  const idRaw = q.id ?? q.num_in_section;
  if (idRaw === undefined || idRaw === null) return null;
  /** @type {string | number} */
  const id = idRaw;

  /**
   * @param {unknown} raw
   * @returns {string}
   */
  const optionText = (raw) => {
    if (typeof raw === 'string') return raw;
    if (raw && typeof raw === 'object' && 'text' in raw) {
      const inner = /** @type {{ text?: unknown }} */ (raw).text;
      if (typeof inner === 'string') return inner;
      if (inner != null) return String(inner);
    }
    return '';
  };

  const options = (q.options || []).map((/** @type {unknown} */ text, /** @type {number} */ idx) => ({
    label: ['A', 'B', 'C', 'D', 'E', 'F'][idx] || String(idx + 1),
    text: optionText(text),
  }));

  const correctAnswer = typeof q.correct_answer === 'string'
    ? q.correct_answer
    : options[(q.correct_ans || 1) - 1]?.label || 'A';

  const images = Array.isArray(q.images) ? q.images : q.image_url ? [q.image_url] : [];
  const firstImg = images[0];
  const imageFilename = typeof firstImg === 'string' ? firstImg : firstImg != null ? String(firstImg) : undefined;

  return {
    id,
    question_number: q.num_in_section ?? id,
    text: q.question_text || q.text || '',
    options,
    correct_answer: correctAnswer,
    explanation: q.explanation || '',
    image_url: images.length > 0 ? getImageUrl(imageFilename) : '',
    category: q.category || 'B',
    topic: q.section_name || q.topic || `Розділ ${q.section}`,
    section: q.section,
    difficulty: q.difficulty || 'medium',
  };
}
