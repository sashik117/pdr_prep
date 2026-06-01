// @ts-nocheck

export const ACHIEVEMENTS_DEF = [
  { id: 'first_step', tier: 1, category: 'tests', name: 'Перший виїзд', desc: 'Пройти перший тест', target: 1 },
  { id: 'rookie', tier: 2, category: 'tests', name: 'Новачок', desc: 'Пройти 10 тестів', target: 10 },
  { id: 'driver', tier: 3, category: 'tests', name: 'Водій', desc: 'Пройти 50 тестів', target: 50 },
  { id: 'pro_driver', tier: 4, category: 'tests', name: 'Профі', desc: 'Пройти 100 тестів', target: 100 },
  { id: 'veteran_driver', tier: 4, category: 'tests', name: 'Досвідчений водій', desc: 'Пройти 250 тестів', target: 250 },
  { id: 'hundred', tier: 1, category: 'correct', name: 'Сотня', desc: '100 правильних відповідей', target: 100 },
  { id: 'five_hundred', tier: 2, category: 'correct', name: "П'ятисотня", desc: '500 правильних відповідей', target: 500 },
  { id: 'thousand', tier: 3, category: 'correct', name: 'Тисячник', desc: '1000 правильних відповідей', target: 1000 },
  { id: 'legend', tier: 4, category: 'correct', name: 'Легенда', desc: '5000 правильних відповідей', target: 5000 },
  { id: 'streak_3', tier: 1, category: 'streak', name: 'Розігрів', desc: '3 дні підряд', target: 3 },
  { id: 'streak_7', tier: 2, category: 'streak', name: 'Темп', desc: '7 днів підряд', target: 7 },
  { id: 'streak_28', tier: 3, category: 'streak', name: 'Вогонь', desc: '28 днів підряд', target: 28 },
  { id: 'streak_90', tier: 4, category: 'streak', name: 'Стабільний темп', desc: '90 днів активності підряд', target: 90 },
  { id: 'marathon_10', tier: 1, category: 'marathon', name: 'Бігун', desc: '10 у марафоні', target: 10 },
  { id: 'marathon_50', tier: 2, category: 'marathon', name: 'Спринтер', desc: '50 у марафоні', target: 50 },
  { id: 'marathon_100', tier: 3, category: 'marathon', name: 'Блискавка', desc: '100 у марафоні', target: 100 },
  { id: 'perfect_1', tier: 1, category: 'perfect', name: 'Без помилок', desc: 'Перший ідеальний тест', target: 1 },
  { id: 'perfect_5', tier: 2, category: 'perfect', name: 'Відмінник', desc: '5 ідеальних тестів', target: 5 },
  { id: 'perfect_20', tier: 3, category: 'perfect', name: 'Чиста серія', desc: '20 тестів без помилок', target: 20 },
  { id: 'exam_passed', tier: 2, category: 'exam', name: 'Іспит складено', desc: 'Скласти перший іспит МВС або білет', target: 1 },
  { id: 'exam_5', tier: 3, category: 'exam', name: 'Стабільний іспит', desc: 'Скласти 5 іспитів МВС або білетів', target: 5 },
  { id: 'exam_20', tier: 4, category: 'exam', name: 'Екзаменаційний темп', desc: 'Скласти 20 іспитів МВС або білетів', target: 20 },
  { id: 'exam_perfect', tier: 4, category: 'exam', name: 'Ідеальний іспит', desc: 'Скласти іспит МВС або білет без помилок', target: 1 },
  { id: 'exam_perfect_5', tier: 4, category: 'exam', name: "П'ять чистих іспитів", desc: 'Скласти 5 іспитів або білетів без помилок', target: 5 },
  { id: 'accuracy_70', tier: 1, category: 'accuracy', name: 'Рівна їзда', desc: 'Тримати загальну точність від 70%', target: 70 },
  { id: 'accuracy_80', tier: 2, category: 'accuracy', name: 'Впевнена точність', desc: 'Тримати загальну точність від 80%', target: 80 },
  { id: 'accuracy_90', tier: 3, category: 'accuracy', name: 'Точний маршрут', desc: 'Тримати загальну точність від 90%', target: 90 },
  { id: 'accuracy_95', tier: 4, category: 'accuracy', name: 'Ювелірна точність', desc: 'Тримати загальну точність від 95%', target: 95 },
  { id: 'battle_first', tier: 1, category: 'battle', name: 'Перший батл', desc: 'Завершити перший батл', target: 1 },
  { id: 'battle_5', tier: 2, category: 'battle', name: 'Батл-серія', desc: 'Завершити 5 батлів', target: 5 },
  { id: 'battle_20', tier: 3, category: 'battle', name: 'Арена досвіду', desc: 'Завершити 20 батлів', target: 20 },
  { id: 'battle_winner', tier: 2, category: 'battle_wins', name: 'Перемога в батлі', desc: 'Виграти перший батл', target: 1 },
  { id: 'battle_wins_5', tier: 3, category: 'battle_wins', name: "П'ять перемог", desc: 'Виграти 5 батлів', target: 5 },
  { id: 'battle_champion', tier: 3, category: 'battle_wins', name: 'Чемпіон батлів', desc: 'Виграти 10 батлів', target: 10 },
  { id: 'battle_wins_25', tier: 4, category: 'battle_wins', name: 'Лідер батлів', desc: 'Виграти 25 батлів', target: 25 },
];

export const TIER_COLORS = {
  1: { bg: 'bg-orange-50 dark:bg-orange-950/25', text: 'text-orange-700 dark:text-orange-200', border: 'border-orange-200 dark:border-orange-500/30', label: 'Бронза' },
  2: { bg: 'bg-slate-100 dark:bg-slate-800/80', text: 'text-slate-700 dark:text-slate-100', border: 'border-slate-300 dark:border-slate-600', label: 'Срібло' },
  3: { bg: 'bg-amber-50 dark:bg-amber-950/25', text: 'text-amber-700 dark:text-amber-200', border: 'border-amber-200 dark:border-amber-500/30', label: 'Золото' },
  4: { bg: 'bg-violet-50 dark:bg-violet-950/25', text: 'text-violet-700 dark:text-violet-200', border: 'border-violet-200 dark:border-violet-500/30', label: 'Легендарне' },
};

export const FRAMES = {
  default: { label: 'Без рамки', style: '' },
  fire: { label: 'Вогняна', style: 'ring-4 ring-orange-500 ring-offset-2 shadow-lg shadow-orange-500/40' },
  sun: { label: 'Сонячна', style: 'ring-4 ring-yellow-400 ring-offset-2 shadow-lg shadow-yellow-400/40' },
  gold: { label: 'Золота', style: 'ring-4 ring-yellow-600 ring-offset-2' },
  diamond: { label: 'Діамантова', style: 'ring-4 ring-cyan-400 ring-offset-2 shadow-lg shadow-cyan-400/40' },
  speed: { label: 'Швидкість', style: 'ring-4 ring-blue-400 ring-offset-2' },
  crown: { label: 'Корона', style: 'ring-4 ring-amber-500 ring-offset-4' },
  galaxy: { label: 'Галактика', style: 'ring-4 ring-purple-600 ring-offset-2 shadow-xl shadow-purple-500/40' },
  platinum: { label: 'Платина', style: 'ring-4 ring-slate-300 ring-offset-2' },
  mint: { label: "М'ятна", style: 'ring-4 ring-emerald-400 ring-offset-2' },
  sunset: { label: 'Захід сонця', style: 'ring-4 ring-rose-400 ring-offset-2' },
  neon: { label: 'Неон', style: 'ring-4 ring-fuchsia-500 ring-offset-2' },
  aurora: { label: 'Аврора', style: 'ring-4 ring-teal-400 ring-offset-2' },
};

const FRAME_BY_ACHIEVEMENT = {
  streak_28: 'fire',
  streak_90: 'sun',
  thousand: 'gold',
  perfect_20: 'diamond',
  marathon_100: 'speed',
  pro_driver: 'crown',
  legend: 'galaxy',
  exam_perfect: 'platinum',
};

export function getUnlockedFrames(earnedIds) {
  const set = new Set(earnedIds);
  const unlocked = ['default'];
  Object.entries(FRAME_BY_ACHIEVEMENT).forEach(([achievementId, frameId]) => {
    if (set.has(achievementId)) unlocked.push(frameId);
  });
  return unlocked;
}
