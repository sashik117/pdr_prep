import {
  BarChart3,
  BookMarked,
  BookOpen,
  ClipboardCheck,
  Crown,
  Flame,
  LifeBuoy,
  ListChecks,
  LockKeyhole,
  MessageCircleMore,
  PlayCircle,
  Settings,
  ShieldCheck,
  Swords,
  Ticket,
  TriangleAlert,
  Trophy,
  UserCircle2,
} from 'lucide-react';

export const primaryNavItems = [
  { path: '/tests', label: 'Тести', icon: ClipboardCheck },
  { path: '/marathon', label: 'Марафон', icon: Flame },
  { path: '/battle', label: 'Батли', icon: Swords, badgeKey: 'battles' },
  { path: '/leaderboard', label: 'Рейтинг', icon: Trophy },
  { path: '/analytics', label: 'Аналітика', icon: BarChart3, premium: true },
];

export const profileMenuItems = [
  { path: '/tickets', label: 'Білети', icon: Ticket },
  { path: '/tests', label: 'Тести', icon: ClipboardCheck },
  { path: '/section-tests', label: 'Тести по розділах', icon: ListChecks },
  { path: '/study', label: 'Теорія', icon: BookOpen },
  { path: '/signs', label: 'Дорожні знаки', icon: TriangleAlert },
  { path: '/lectures', label: 'Відеолекції', icon: PlayCircle, premium: true },
  { path: '/saved-questions', label: 'Збережені запитання', icon: BookMarked },
  { path: '/friends', label: 'Друзі', icon: MessageCircleMore, badgeKey: 'friends' },
  { path: '/support', label: 'Підтримка', icon: LifeBuoy },
  { path: '/settings', label: 'Налаштування', icon: Settings, compact: true },
  { path: '/privacy', label: 'Конфіденційність', icon: LockKeyhole },
  { path: '/terms', label: 'Угода підписника', icon: ShieldCheck },
  { path: '/pricing', label: 'Premium', icon: Crown },
  { path: '/cabinet', label: 'Профіль', icon: UserCircle2 },
];

export const desktopSidebarGroups = [
  {
    title: 'Навчання',
    icon: BookOpen,
    items: [
      { path: '/tests', label: 'Тести', icon: ClipboardCheck },
      { path: '/section-tests', label: 'Тести по розділах', icon: ListChecks },
      { path: '/tickets', label: 'Білети', icon: Ticket },
      { path: '/study', label: 'Теорія', icon: BookOpen },
      { path: '/signs', label: 'Дорожні знаки', icon: TriangleAlert },
      { path: '/lectures', label: 'Відеолекції', icon: PlayCircle, premium: true },
      { path: '/saved-questions', label: 'Збережені', icon: BookMarked },
    ],
  },
  {
    title: 'Практика',
    icon: Trophy,
    items: [
      { path: '/marathon', label: 'Марафон', icon: Flame },
      { path: '/battle', label: 'Батли', icon: Swords, badgeKey: 'battles' },
      { path: '/analytics', label: 'Аналітика', icon: BarChart3, premium: true },
      { path: '/leaderboard', label: 'Рейтинг', icon: Trophy },
    ],
  },
  {
    title: 'Акаунт',
    icon: UserCircle2,
    items: [
      { path: '/cabinet', label: 'Профіль', icon: UserCircle2 },
      { path: '/friends', label: 'Друзі', icon: MessageCircleMore, badgeKey: 'friends' },
      { path: '/settings', label: 'Налаштування', icon: Settings },
      { path: '/privacy', label: 'Конфіденційність', icon: LockKeyhole },
      { path: '/terms', label: 'Угода підписника', icon: ShieldCheck },
      { path: '/pricing', label: 'Premium', icon: Crown },
    ],
  },
];

export const footerGroups = [
  {
    title: 'Навчання',
    links: [
      { label: 'Тести', to: '/tests' },
      { label: 'Тести по розділах', to: '/section-tests' },
      { label: 'Білети', to: '/tickets' },
      { label: 'Теорія', to: '/study' },
      { label: 'Дорожні знаки', to: '/signs' },
      { label: 'Збережені запитання', to: '/saved-questions' },
    ],
  },
  {
    title: 'Практика',
    links: [
      { label: 'Марафон', to: '/marathon' },
      { label: 'Батли', to: '/battle' },
      { label: 'Аналітика', to: '/analytics' },
      { label: 'Premium', to: '/pricing' },
    ],
  },
  {
    title: 'Документи',
    links: [
      { label: 'Конфіденційність', to: '/privacy' },
      { label: 'Угода підписника', to: '/terms' },
      { label: 'Підтримка', to: '/support' },
      { label: 'Профіль', to: '/cabinet' },
    ],
  },
];
