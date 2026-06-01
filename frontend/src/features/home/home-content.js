import {
  BookMarked,
  BookOpen,
  BrainCircuit,
  Crown,
  FileCheck2,
  LineChart,
  MessageCircleHeart,
  PlayCircle,
  Save,
  ShieldCheck,
  Star,
  Ticket,
  TimerReset,
  TriangleAlert,
  UserCheck2,
  UsersRound,
} from 'lucide-react';

export const heroHighlights = [
  {
    icon: ShieldCheck,
    title: 'Офіційна база запитань',
    description: 'Працюйте з актуальними питаннями для підготовки до теоретичного іспиту в сервісному центрі МВС.',
  },
  {
    icon: UserCheck2,
    title: 'Один профіль на всіх пристроях',
    description: 'Ваш прогрес, налаштування й Premium-доступ залишаються з вами на телефоні, планшеті та комп’ютері.',
  },
  {
    icon: BrainCircuit,
    title: 'Пояснення, повторення, прогрес',
    description: 'Закріплюйте теорію через тести, білети, аналітику помилок і швидкий перехід до потрібного правила.',
  },
];

export const modeCards = [
  {
    title: 'Іспит МВС',
    description: 'Імітація теоретичного іспиту: 20 питань за блоками ПДР, безпеки, будови та домедичної допомоги.',
    bullets: ['Алгоритм підбирає питання під вашу категорію', 'Формат максимально наближений до сервісного центру'],
    icon: FileCheck2,
    to: '/tests?mode=mvs',
  },
  {
    title: 'Тренування 20 питань',
    description: 'Рандомна добірка з 20 питань для обраної категорії без імітації офіційного білета.',
    bullets: ['Швидка перевірка готовності', 'Підходить для щоденного повторення'],
    icon: BookOpen,
    to: '/tests?mode=full',
  },
  {
    title: 'Тренувальні білети',
    description: 'Окремий режим для перегляду й проходження білетів за вибраною категорією.',
    bullets: ['Кожен білет має власний набір питань', 'Зручно повторювати перед іспитом'],
    icon: Ticket,
    to: '/tickets',
  },
];

export const extraModes = [
  {
    title: 'Мої помилки',
    description: 'Поверніться до неправильних відповідей і спокійно закрийте слабкі теми.',
    icon: TriangleAlert,
    to: '/tests?mode=difficult',
  },
  {
    title: 'Топ помилок багатьох',
    description: 'Добірка питань, які найчастіше плутають під час підготовки.',
    icon: Star,
    to: '/tests?mode=top',
  },
  {
    title: 'Збережені запитання',
    description: 'Персональний список для повторення важливого матеріалу в будь-який момент.',
    icon: Save,
    to: '/saved-questions',
  },
];

export const theoryItems = [
  'Правила дорожнього руху',
  'Дорожні знаки',
  'Дорожня розмітка',
  'Регулювальник',
  'Світлофор',
  'Відеолекції',
];

export const trustStats = [
  {
    value: '900 000+',
    description: 'користувачів обрали цифрову підготовку до теоретичного іспиту',
    icon: UsersRound,
  },
  {
    value: '4.8',
    description: 'середня оцінка сервісу за відгуками учнів',
    icon: Star,
  },
  {
    value: '47 хв/день',
    description: 'середній щоденний темп навчання на платформі',
    icon: TimerReset,
  },
];

export const testimonials = [
  {
    name: 'Ігор',
    text: 'Платформа дає відчуття системності: проходиш теорію, одразу закріплюєш тестами й бачиш свій прогрес.',
  },
  {
    name: 'Галина',
    text: 'Найбільше допомогли пояснення після помилок. Зрозуміло, що саме треба повторити перед іспитом.',
  },
  {
    name: 'Уляна',
    text: 'Зручно, що все зібрано в одному місці: теорія, білети, аналітика та повторення складних тем.',
  },
  {
    name: 'Андрій',
    text: 'Корисно не лише для новачків, а й для водіїв, які хочуть освіжити знання без зайвого шуму.',
  },
];

export const premiumFeatures = [
  'Необмежені тести за темами та повний доступ до тренувальних білетів.',
  'Відеолекції й додаткові матеріали для системної підготовки.',
  'Поглиблена аналітика, історія проходжень і робота над помилками.',
  'Пріоритетний доступ до нових навчальних режимів.',
];

export const supportActions = [
  { label: 'Написати в підтримку', to: '/support', icon: MessageCircleHeart },
  { label: 'Відкрити відеолекції', to: '/lectures', icon: PlayCircle },
  { label: 'Переглянути Premium', to: '/pricing', icon: Crown },
];

export const bentoCards = [
  {
    title: 'Тести',
    description: 'Швидкі тренування, імітація іспиту МВС і проходження по розділах в одному місці.',
    to: '/tests',
    icon: FileCheck2,
    tone: 'primary',
  },
  {
    title: 'Теорія',
    description: 'Структурований довідник з ілюстраціями, відео та зручним читанням у світлій і темній темі.',
    to: '/study',
    icon: BookOpen,
    tone: 'neutral',
  },
  {
    title: 'Білети',
    description: 'Тренувальні білети для повторення перед іспитом і перевірки готовності.',
    to: '/tickets',
    icon: Ticket,
    tone: 'neutral',
  },
  {
    title: 'Збережене',
    description: 'Ваші важливі питання для повторення тоді, коли зручно повернутися до матеріалу.',
    to: '/saved-questions',
    icon: BookMarked,
    tone: 'accent',
  },
  {
    title: 'Аналітика',
    description: 'Результати, прогрес, слабкі теми та персональна робота над помилками.',
    to: '/analytics',
    icon: LineChart,
    tone: 'accent',
  },
];
