import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle,
  ClipboardList,
  Database,
  FileCheck2,
  MessageCircleHeart,
  PlayCircle,
  Save,
  ShieldCheck,
  Smartphone,
  Star,
  Target,
  TimerReset,
  Trophy,
  UsersRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { hasPremiumAccess } from '@/lib/accessLimits';

const reveal = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.18 },
  transition: { duration: 0.45, ease: 'easeOut' },
};

const advantages = [
  {
    icon: Database,
    title: 'Офіційна база запитань',
    description: 'Працюйте з актуальними питаннями та темами, які потрібні для підготовки до теоретичного іспиту.',
  },
  {
    icon: Smartphone,
    title: 'Зручно з будь-якого пристрою',
    description: 'Навчання, білети, збережені питання та прогрес доступні на телефоні, планшеті й комп’ютері.',
  },
  {
    icon: ShieldCheck,
    title: 'Спокійний темп навчання',
    description: 'Теорія, практика й повторення зібрані в одному місці, щоб Ви впевнено рухались до іспиту.',
  },
];

const modes = [
  {
    icon: FileCheck2,
    title: 'Іспит МВС',
    description: 'Симуляція формату сервісного центру: 20 питань із потрібних блоків для Вашої категорії.',
    bullets: ['Питання добираються з нашої бази', 'Підходить для фінальної перевірки готовності'],
    to: '/tests?mode=mvs',
  },
  {
    icon: BookOpen,
    title: 'Тренування 20 питань',
    description: 'Швидка добірка для щоденної практики без зайвого напруження.',
    bullets: ['Підходить для коротких занять', 'Одразу видно сильні та слабкі теми'],
    to: '/tests?mode=full',
  },
  {
    icon: ClipboardList,
    title: 'Білети',
    description: 'Окремі офіційні тренувальні білети для спокійного повторення перед іспитом.',
    bullets: ['Кожен білет проходиться окремо', 'Зручно повторювати матеріал без поспіху', 'Добре підходить для контрольної перевірки перед сервісним центром'],
    to: '/tickets',
  },
];

const extraModes = [
  {
    icon: Brain,
    title: 'Топ помилок багатьох',
    description: 'Добірка питань, у яких найчастіше помиляються під час підготовки до іспиту.',
    to: '/tests?mode=top',
  },
  {
    icon: Save,
    title: 'Збережені запитання',
    description: 'Питання, які Ви відклали для спокійного повторення перед наступною спробою.',
    to: '/saved-questions',
  },
  {
    icon: UsersRound,
    title: 'Батли з друзями',
    description: 'Короткі змагання у форматі тесту, щоб тренування було живим і мотивувало рухатись далі.',
    to: '/battle',
  },
];

const theoryTopics = [
  { title: 'Правила дорожнього руху', icon: BookOpen, to: '/study/rules' },
  { title: 'Дорожні знаки', icon: ShieldCheck, to: '/signs' },
  { title: 'Дорожня розмітка', icon: Target, to: '/study/road-markings' },
  { title: 'Регулювальник', icon: UsersRound, to: '/study/regulator' },
  { title: 'Світлофор', icon: CheckCircle, to: '/study/traffic-light' },
  { title: 'Відеолекції', icon: PlayCircle, to: '/study/video-lectures' },
];

const stats = [
  {
    value: '1 000+',
    label: 'користувачів обрали цифрову підготовку до теоретичного іспиту',
    icon: UsersRound,
  },
  {
    value: '4.8',
    label: 'середня оцінка сервісу за відгуками учнів',
    icon: Star,
  },
  {
    value: '47 хв/день',
    label: 'середній щоденний темп навчання на платформі',
    icon: TimerReset,
  },
];

const testimonials = [
  {
    name: 'Ігор',
    text: 'Зручно, що теорія й тести поруч. Прочитав тему, одразу закріпив питаннями й бачу, що варто повторити.',
  },
  {
    name: 'Галина',
    text: 'Найбільше допомогли пояснення після помилок. Стало зрозуміло, де саме плуталась перед іспитом.',
  },
  {
    name: 'Уляна',
    text: 'На телефоні все швидко відкривається, а збережені питання дуже виручили перед повторенням.',
  },
];

const supportActions = [
  { label: 'Написати в підтримку', to: '/support', icon: MessageCircleHeart, auth: true },
  { label: 'Відкрити відеолекції', to: '/study/video-lectures', icon: PlayCircle },
  { label: 'Переглянути Premium', to: '/pricing', icon: Trophy },
  { label: 'Перейти в кабінет', to: '/cabinet', icon: Target, auth: true },
];

export default function HomePage() {
  const { isAuthenticated, user } = useAuth();
  const premiumAccess = hasPremiumAccess(user);
  const visibleExtraModes = extraModes;
  const visibleSupportActions = supportActions.filter((action) => {
    if (action.to === '/pricing' && premiumAccess) return false;
    return !action.auth || isAuthenticated;
  });
  const accountCta = isAuthenticated
    ? { to: '/cabinet', label: 'До профілю' }
    : { to: '/auth?tab=register', label: 'Зареєструватися' };

  return (
    <div className="overflow-hidden bg-white text-slate-950 dark:bg-slate-950 dark:text-white">
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-blue-950 text-white">
        <div className="absolute inset-0 opacity-15 [background-image:linear-gradient(rgba(255,255,255,.22)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.22)_1px,transparent_1px)] [background-size:42px_42px]" />
        <div className="absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-sky-400/25 blur-3xl" />
        <div className="absolute -left-24 top-16 h-64 w-64 rounded-full bg-blue-300/20 blur-3xl" />

        <div className="relative ml-auto mr-auto w-full max-w-[1400px] px-5 py-16 sm:px-6 md:py-24 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="mb-6 inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-center text-sm font-medium leading-6 text-blue-50 backdrop-blur"
            >
              <CheckCircle className="h-4 w-4" />
              База питань і теорії оновлена для підготовки 2026 року
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
              className="mx-auto max-w-4xl text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl"
            >
              Підготовка до теоретичного іспиту ПДР без зайвого шуму
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1 }}
              className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-blue-100 sm:text-xl"
            >
              DrivePrep поєднує теорію, тести, білети, аналітику й збережені питання, щоб Ви спокійно та впевнено готувалися до іспиту.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.2 }}
              className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
            >
              <Button asChild size="lg" className="rounded-full bg-yellow-400 px-8 text-slate-950 shadow-xl shadow-yellow-500/20 hover:bg-yellow-300">
                <Link to="/tests">
                  Почати тренування
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full border-white/30 bg-white/10 px-8 text-white hover:bg-white/15 hover:text-white">
                <Link to={accountCta.to}>{accountCta.label}</Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50 py-12 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="ml-auto mr-auto w-full max-w-[1400px] px-5 sm:px-6 lg:px-8">
          <div className="grid gap-5 md:grid-cols-3">
            {advantages.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  {...reveal}
                  transition={{ ...reveal.transition, delay: index * 0.06 }}
                  className="rounded-2xl bg-white p-6 text-center shadow-md shadow-slate-200/60 dark:bg-slate-950 dark:shadow-black/20"
                >
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                    <Icon className="h-7 w-7" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 dark:bg-slate-950 md:py-20">
        <div className="ml-auto mr-auto w-full max-w-[1400px] px-5 sm:px-6 lg:px-8">
          <motion.div {...reveal} className="mb-10 max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">Практика</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
              Оберіть формат, який підходить саме Вам
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">
              Тренуйтеся короткими підходами, проходьте повний формат іспиту або відкривайте окремі офіційні тренувальні білети, коли потрібно повторити матеріал по-людськи й без поспіху.
            </p>
          </motion.div>

          <div className="grid gap-6 lg:grid-cols-3">
            {modes.map((mode, index) => {
              const Icon = mode.icon;
              return (
                <motion.div key={mode.title} {...reveal} transition={{ ...reveal.transition, delay: index * 0.06 }}>
                  <Link
                    to={mode.to}
                    className="group flex h-full flex-col rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-blue-500 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-400 sm:p-6"
                  >
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-500/15 dark:text-blue-300">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-950 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-300">
                      {mode.title}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{mode.description}</p>
                    <ul className="mt-5 hidden space-y-2 text-sm text-slate-600 dark:text-slate-300 sm:block">
                      {mode.bullets.map((bullet) => (
                        <li key={bullet} className="flex gap-2">
                          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                    <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-300">
                      Перейти
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </Link>
                </motion.div>
              );
            })}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {visibleExtraModes.map((mode, index) => {
              const Icon = mode.icon;
              return (
                <motion.div key={mode.title} {...reveal} transition={{ ...reveal.transition, delay: 0.18 + index * 0.05 }}>
                  <Link
                    to={mode.to}
                    className="flex h-full items-start gap-4 rounded-2xl bg-slate-50 p-5 transition-colors hover:bg-blue-50 dark:bg-slate-900 dark:hover:bg-blue-950/30"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm dark:bg-slate-950 dark:text-blue-300">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block font-semibold text-slate-950 dark:text-white">{mode.title}</span>
                      <span className="mt-1 block text-sm leading-6 text-slate-600 dark:text-slate-300">{mode.description}</span>
                    </span>
                  </Link>
                </motion.div>
              );
            })}
          </div>

        </div>
      </section>

      <section className="bg-slate-50 py-16 dark:bg-slate-900/60 md:py-20">
        <div className="ml-auto mr-auto w-full max-w-[1400px] px-5 sm:px-6 lg:px-8">
          <motion.div {...reveal} className="mb-10 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-300">Теорія</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
              Чистий доступ до всього матеріалу ПДР
            </h2>
            <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-slate-600 dark:text-slate-300">
              Розділи правил, дорожні знаки, розмітка та відеоматеріали зібрані в спокійній структурі, яку зручно читати з телефона й комп’ютера.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {theoryTopics.map((topic, index) => {
              const Icon = topic.icon;
              return (
                <motion.div key={topic.title} {...reveal} transition={{ ...reveal.transition, delay: index * 0.04 }}>
                  <div className="flex h-full flex-col items-center justify-center rounded-2xl bg-white p-5 text-center shadow-md shadow-slate-200/60 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-200/60 dark:bg-slate-950 dark:shadow-black/20 dark:hover:shadow-blue-950/30">
                    <Icon className="mb-3 h-8 w-8 text-blue-600 dark:text-blue-300" />
                    <span className="text-sm font-semibold text-slate-950 dark:text-white">{topic.title}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <motion.div {...reveal} className="mt-8 flex justify-center">
            <Button asChild size="lg" className="rounded-full px-8 shadow-lg shadow-blue-600/15">
              <Link to="/study">
                Вчити теорію
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </motion.div>

          <motion.div
            {...reveal}
            className="mt-10 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white shadow-xl shadow-blue-900/15 md:p-8"
          >
            <div className="grid gap-8 md:grid-cols-[1.7fr_1fr] md:items-center">
              <div>
                <PlayCircle className="mb-4 h-11 w-11 text-blue-100" />
                <h3 className="text-2xl font-semibold">Відеолекції для складних тем</h3>
                <p className="mt-3 max-w-2xl leading-7 text-blue-100">
                  Короткі пояснення допомагають швидше розібрати правила, знаки, розмітку та типові дорожні ситуації. Це зручно, коли тексту недостатньо і хочеться побачити приклад.
                </p>
              </div>
              <div className="rounded-2xl border border-white/20 bg-white/10 p-4 text-sm leading-6 text-blue-50">
                Дивіться урок, повертайтеся до теми й одразу закріплюйте матеріал тестами. Усе зібрано в одному місці, без зайвого пошуку.
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="bg-white py-16 dark:bg-slate-950 md:py-20">
        <div className="ml-auto mr-auto w-full max-w-[1400px] px-5 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-3">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div key={stat.value} {...reveal} transition={{ ...reveal.transition, delay: index * 0.06 }} className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                    <Icon className="h-8 w-8" />
                  </div>
                  <div className="text-4xl font-semibold tracking-tight text-blue-600 dark:text-blue-300">{stat.value}</div>
                  <p className="mx-auto mt-2 max-w-sm text-base leading-7 text-slate-600 dark:text-slate-300">{stat.label}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16 dark:bg-slate-900/60 md:py-20">
        <div className="ml-auto mr-auto w-full max-w-[1400px] px-5 sm:px-6 lg:px-8">
          <motion.div {...reveal} className="mb-10 text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">Учні цінують спокійну підготовку</h2>
            <div className="mt-4 flex items-center justify-center gap-2 text-xl font-semibold text-slate-950 dark:text-white">
              <Star className="h-7 w-7 fill-yellow-400 text-yellow-400" />
              <span>4.8</span>
              <span className="text-sm font-normal text-slate-500 dark:text-slate-400">за відгуками користувачів</span>
            </div>
          </motion.div>

          <div className="grid gap-5 md:grid-cols-3">
            {testimonials.map((item, index) => (
              <motion.div
                key={item.name}
                {...reveal}
                transition={{ ...reveal.transition, delay: index * 0.06 }}
                className="rounded-2xl bg-white p-6 shadow-md shadow-slate-200/60 dark:bg-slate-950 dark:shadow-black/20"
              >
                <div className="mb-3 flex gap-1">
                  {Array.from({ length: 5 }).map((_, starIndex) => (
                    <Star key={starIndex} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="leading-7 text-slate-600 dark:text-slate-300">{item.text}</p>
                <p className="mt-4 font-semibold text-slate-950 dark:text-white">{item.name}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-br from-blue-600 to-blue-900 py-16 text-white md:py-20">
        <div className="ml-auto mr-auto w-full max-w-[1000px] px-5 text-center sm:px-6 lg:px-8">
          <motion.h2 {...reveal} className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Почніть підготовку тоді, коли Вам зручно
          </motion.h2>
          <motion.p {...reveal} transition={{ ...reveal.transition, delay: 0.06 }} className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-blue-100">
            Створіть профіль, збережіть прогрес і повертайтеся до навчання без втрати результатів.
          </motion.p>
          <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.12 }} className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-full bg-yellow-400 px-9 text-slate-950 hover:bg-yellow-300">
              <Link to="/auth?tab=register">Створити акаунт</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full border-white/30 bg-white/10 px-9 text-white hover:bg-white/15 hover:text-white">
              <Link to="/tests">Спробувати тест</Link>
            </Button>
          </motion.div>
        </div>
      </section>

      <section className="bg-slate-50 py-12 dark:bg-slate-900/60">
        <div className="ml-auto mr-auto grid w-full max-w-[1100px] gap-3 px-5 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
          {visibleSupportActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                to={action.to}
                className="flex items-center justify-center gap-3 rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:text-blue-600 dark:bg-slate-950 dark:text-slate-200 dark:hover:text-blue-300"
              >
                <Icon className="h-5 w-5" />
                {action.label}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
