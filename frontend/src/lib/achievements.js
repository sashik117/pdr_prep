// @ts-nocheck
/** @typedef {import('@/types/app').StatsResponse} StatsResponse */
/** @typedef {import('@/types/app').TestResult} TestResult */

export const ACHIEVEMENTS_DEF = [
  // ── Тести (Твоя кар'єра водія) ──────────────────────────────
  {
    id: 'first_test', tier: 1, category: 'tests',
    name: '🐣 Ще не збив жодного конуса', desc: 'Перший тест пройдено!',
    check: (/** @type {StatsResponse} */ p) => (p.total_tests || 0) >= 1,
  },
  {
    id: 'ten_tests', tier: 2, category: 'tests',
    name: '🛴 Король самокатів', desc: '10 тестів за плечима',
    check: (/** @type {StatsResponse} */ p) => (p.total_tests || 0) >= 10,
  },
  {
    id: 'fifty_tests', tier: 3, category: 'tests',
    name: '🚕 Таксист на мінімалках', desc: 'Пройти 50 тестів',
    check: (/** @type {StatsResponse} */ p) => (p.total_tests || 0) >= 50,
  },
  {
    id: 'hundred_tests', tier: 4, category: 'tests',
    name: '🏎️ Шумахер на зв\'язку', desc: '100 тестів. Ти взагалі спиш?',
    check: (/** @type {StatsResponse} */ p) => (p.total_tests || 0) >= 100,
    frame: 'crown',
  },

  // ── Правильні відповіді (Твій інтелект) ──────────────────────
  {
    id: 'correct_100', tier: 1, category: 'correct',
    name: '🧐 Знаю, де головна', desc: '100 правильних відповідей',
    check: (/** @type {StatsResponse} */ p) => (p.total_correct || 0) >= 100,
  },
  {
    id: 'correct_1000', tier: 3, category: 'correct',
    name: '🧙‍♂️ ПДР-Магістр', desc: '1000 правильних відповідей',
    check: (/** @type {StatsResponse} */ p) => (p.total_correct || 0) >= 1000,
    frame: 'gold',
  },
  {
    id: 'correct_5000', tier: 4, category: 'correct',
    name: '🧠 Ходяча енциклопедія МВС', desc: '5000 правильних! Можеш йти викладати',
    check: (/** @type {StatsResponse} */ p) => (p.total_correct || 0) >= 5000,
    frame: 'galaxy',
  },

  // ── Стрік (Твоя витримка) ──────────────────────────────────
  {
    id: 'streak_3', tier: 1, category: 'streak',
    name: '🌱 Паросток дисципліни', desc: '3 дні активності підряд',
    check: (/** @type {StatsResponse} */ p) => (p.streak_days || 0) >= 3,
  },
  {
    id: 'streak_28', tier: 3, category: 'streak',
    name: '🌋 ПДР-залежність', desc: 'Майже місяць щодня. Це любов?',
    check: (/** @type {StatsResponse} */ p) => (p.streak_days || 0) >= 28,
    frame: 'fire',
  },
  {
    id: 'streak_90', tier: 4, category: 'streak',
    name: '💎 Сталевий хребет', desc: '90 днів підряд. Ти як швейцарський годинник',
    check: (/** @type {StatsResponse} */ p) => (p.streak_days || 0) >= 90,
    frame: 'sun',
  },

  // ── Марафон (Твоя швидкість) ────────────────────────────────
  {
    id: 'marathon_10', tier: 1, category: 'marathon',
    name: '🏃 Не задихаюсь', desc: '10 правильних у марафоні підряд',
    check: (/** @type {StatsResponse} */ p) => (p.marathon_best || 0) >= 10,
  },
  {
    id: 'marathon_100', tier: 3, category: 'marathon',
    name: '⚡ Ультраінстинкт', desc: '100 правильних. Як ти це робиш?',
    check: (/** @type {StatsResponse} */ p) => (p.marathon_best || 0) >= 100,
    frame: 'speed',
  },

  // ── Ідеальні результати та точність ──────────────────────────
  {
    id: 'perfect_1', tier: 1, category: 'perfect',
    name: '✨ Чистий як дзеркало', desc: 'Перший тест без жодної помилки',
    check: (/** @type {StatsResponse} */ _, /** @type {TestResult[]=} */ r) => r?.some((t) => t.score_percent === 100),
  },
  {
    id: 'accuracy_90', tier: 2, category: 'accuracy',
    name: '🎯 Снайпер', desc: 'Загальна точність понад 90%',
    check: (/** @type {StatsResponse} */ p) => {
      const total = p.total_questions_answered || p.total_answers || 0;
      return total > 20 && ((p.total_correct || 0) / total) >= 0.9;
    },
  },
  {
    id: 'perfect_20', tier: 3, category: 'perfect',
    name: '🎓 Золота голова', desc: '20 тестів без помилок',
    check: (/** @type {StatsResponse} */ _, /** @type {TestResult[]=} */ r) => (r ?? []).filter((t) => t.score_percent === 100).length >= 20,
    frame: 'diamond',
  },

  // ── Спеціальні (Студентські реалії) ──────────────────────────
  {
    id: 'night_owl', tier: 2, category: 'special',
    name: '🦉 Нічний гонщик', desc: 'Вчив правила після 22:00. Кава замість сну?',
    check: (/** @type {StatsResponse} */ _, /** @type {TestResult[]=} */ r) => r?.some(t => {
      const h = new Date(t.created_date).getHours();
      return h >= 22 || h < 4;
    }),
  },
  {
    id: 'speed_demon', tier: 3, category: 'special',
    name: '🏎️ Форсаж: Ужгородський дрифт', desc: 'Тест за 5 хв. Куди поспішаєш?',
    check: (/** @type {StatsResponse} */ _, /** @type {TestResult[]=} */ r) => r?.some(t => t.passed && t.time_spent_seconds < 300 && t.total_questions >= 20),
    frame: 'speed',
  },
  {
    id: 'close_call', tier: 2, category: 'special',
    name: '🧘 На грані фолу', desc: 'Скласти екзамен з 2 дозволеними помилками',
    check: (/** @type {StatsResponse} */ _, /** @type {TestResult[]=} */ r) => r?.some(t => t.test_type === 'exam' && t.passed && t.errors_count === 2),
  },
  {
    id: 'exam_perfect', tier: 4, category: 'exam',
    name: '🕶️ Агент 0 помилок', desc: 'Ідеальний екзамен. Посвідчення вже в кишені!',
    check: (/** @type {StatsResponse} */ _, /** @type {TestResult[]=} */ r) => r?.some(t => t.test_type === 'exam' && t.score_percent === 100),
    frame: 'platinum',
  },
];

export const TIER_COLORS = {
  1: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', label: 'Бронза' },
  2: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300', label: 'Срібло' },
  3: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300', label: 'Золото' },
  4: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300', label: 'Легенда' },
};

export const FRAMES = {
  default: { label: 'Стандартна', style: 'ring-2 ring-primary' },
  fire: { label: '🔥 Вогняна', style: 'ring-4 ring-orange-500 ring-offset-2 shadow-lg shadow-orange-500/50' },
  sun: { label: '☀️ Сонячна', style: 'ring-4 ring-yellow-400 ring-offset-2 shadow-lg shadow-yellow-400/50' },
  gold: { label: '👑 Золота', style: 'ring-4 ring-yellow-600 ring-offset-2' },
  diamond: { label: '💎 Алмазна', style: 'ring-4 ring-cyan-400 ring-offset-2 shadow-lg shadow-cyan-400/50' },
  speed: { label: '💨 Швидкість', style: 'ring-4 ring-blue-400 ring-offset-2' },
  crown: { label: '👑 Корона', style: 'ring-4 ring-amber-500 ring-offset-4' },
  galaxy: { label: '🌌 Галактика', style: 'ring-4 ring-purple-600 ring-offset-2 shadow-xl shadow-purple-500/50' },
  platinum: { label: '🏅 Платина', style: 'ring-4 ring-slate-300 ring-offset-2' },
};

/** @param {string[]} earnedIds */
export function getUnlockedFrames(earnedIds) {
  const set = new Set(earnedIds);
  const unlocked = ['default'];
  ACHIEVEMENTS_DEF.forEach((achievement) => {
    if (achievement.frame && set.has(achievement.id)) unlocked.push(achievement.frame);
  });
  return unlocked;
}
