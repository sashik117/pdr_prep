/**
 * questionsApi.js — сервіс для запитів до FastAPI бекенду
 *
 * Якщо бекенд не налаштований — використовується Base44 SDK (поточна БД).
 * Для підключення власного бекенду:
 *   1. Задеплой backend/ на Render
 *   2. Встанови VITE_API_URL=https://your-api.onrender.com у Netlify
 */

const API_URL = import.meta.env.VITE_API_URL || null;

// Базовий шлях до картинок (фронтенд)
export const IMAGE_BASE_PATH = "/images/pdr/";

/**
 * Повертає URL картинки за ім'ям файлу.
 * Якщо є бекенд — можна змінити на `/api/images/${filename}`
 */
export function getImageUrl(filename) {
  if (!filename) return null;
  return `${IMAGE_BASE_PATH}${filename}`;
}

/**
 * Отримати список питань з фільтрацією та пагінацією.
 */
export async function fetchQuestions({ section, limit = 20, offset = 0, search } = {}) {
  if (!API_URL) {
    throw new Error("VITE_API_URL не задано. Використовуйте Base44 SDK.");
  }
  const params = new URLSearchParams();
  if (section)  params.set("section", section);
  if (search)   params.set("search", search);
  params.set("limit", limit);
  params.set("offset", offset);

  const res = await fetch(`${API_URL}/questions?${params}`);
  if (!res.ok) throw new Error(`Помилка API: ${res.status}`);
  return res.json();
}

/**
 * Отримати випадкові питання (для Марафону).
 * excludeIds — масив ID вже побачених питань (щоб не повторювались).
 */
export async function fetchRandomQuestions({ count = 20, section, excludeIds = [] } = {}) {
  if (!API_URL) {
    throw new Error("VITE_API_URL не задано. Використовуйте Base44 SDK.");
  }
  const params = new URLSearchParams();
  params.set("count", count);
  if (section) params.set("section", section);
  if (excludeIds.length > 0) params.set("exclude_ids", excludeIds.join(","));

  const res = await fetch(`${API_URL}/questions/random?${params}`);
  if (!res.ok) throw new Error(`Помилка API: ${res.status}`);
  return res.json();
}

/**
 * Отримати список розділів зі статистикою.
 */
export async function fetchSections() {
  if (!API_URL) return [];
  const res = await fetch(`${API_URL}/sections`);
  if (!res.ok) throw new Error(`Помилка API: ${res.status}`);
  return res.json();
}

/**
 * Конвертує питання з формату API/БД у формат компонентів.
 * options — масив рядків ["Варіант 1", "Варіант 2", ...]
 * correct_ans — 1-based індекс
 */
export function normalizeQuestion(q) {
  const options = (q.options || []).map((text, idx) => ({
    label: ["A", "B", "C", "D", "E", "F"][idx] || String(idx + 1),
    text: typeof text === "string" ? text : text.text || "",
  }));

  const correctLabel =
    typeof q.correct_answer === "string"
      ? q.correct_answer
      : options[( (q.correct_ans || 1) - 1)]?.label || "A";

  const images = Array.isArray(q.images) ? q.images : (q.image_url ? [q.image_url] : []);

  return {
    id: q.id,
    question_number: q.id,
    text: q.question_text || q.text || "",
    options,
    correct_answer: correctLabel,
    explanation: q.explanation || "",
    image_url: images.length > 0 ? getImageUrl(images[0]) : "",
    category: q.category || "B",
    topic: q.section_name || q.topic || `Розділ ${q.section}`,
    section: q.section,
    difficulty: q.difficulty || "medium",
  };
}