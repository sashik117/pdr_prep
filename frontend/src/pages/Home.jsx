import { Link } from 'react-router-dom';
import { ArrowRight, BellRing, BookMarked, CircleAlert, ClipboardCheck, FileCheck2, ShieldCheck, Swords, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const modes = [
  {
    title: 'Швидкий тест',
    desc: 'Ідеальний старт, коли є лише кілька хвилин. Коротка сесія швидко показує, що вже впевнено знаєте, а де ще варто підкрутити базу.',
    to: '/tests',
    icon: ClipboardCheck,
    accent: 'from-sky-500 to-blue-600',
  },
  {
    title: 'Повний іспит',
    desc: 'Формат максимально близький до реального іспиту в ГСЦ. Тут добре перевіряти не тільки знання, а й витримку, темп і концентрацію.',
    to: '/tests',
    icon: FileCheck2,
    accent: 'from-blue-600 to-indigo-600',
  },
  {
    title: 'Робота над помилками',
    desc: 'Найкорисніший режим після кількох спроб. Система повертає саме ті питання, на яких ви вже спіткнулися, щоб слабкі місця перестали бути слабкими.',
    to: '/mistakes',
    icon: CircleAlert,
    accent: 'from-rose-500 to-orange-500',
  },
  {
    title: 'Виклик дня',
    desc: 'Щоденний міні-челендж для тих, хто хоче тримати форму. Добре гріє серію активності й не дає випадати з навчання навіть у зайняті дні.',
    to: '/daily',
    icon: BellRing,
    accent: 'from-amber-400 to-orange-500',
  },
  {
    title: 'Батл',
    desc: 'Тут уже не просто навчання, а азарт. Кидайте виклик друзям або іншим користувачам і дивіться, хто спокійніше тримає теорію під тиском.',
    to: '/battle',
    icon: Swords,
    accent: 'from-violet-500 to-fuchsia-500',
  },
  {
    title: 'Знаки',
    desc: 'Окремий простір, щоб спокійно роздивитися дорожні знаки, збільшити їх і закріпити в пам’яті без поспіху великого тесту.',
    to: '/signs',
    icon: BookMarked,
    accent: 'from-emerald-500 to-teal-500',
  },
];

const reasons = [
  { title: 'Офіційні білети', text: 'Тренуєтесь на реальних питаннях без вигаданих “авторських” підбірок.', icon: ClipboardCheck },
  { title: 'Розумне навчання', text: 'Сервіс підсвічує, де ви вже сильні, а де ще потрібна практика.', icon: Trophy },
  { title: 'Детальна статистика', text: 'Видно темп, точність, активність і розділи, які ще варто підтягнути.', icon: FileCheck2 },
  { title: 'Досягнення', text: 'Нагороди, зірки, рамки та прогрес прямо в профілі мотивують не зупинятися.', icon: BookMarked },
];

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-[36px] border border-white/90 bg-[linear-gradient(135deg,rgba(13,71,161,0.12),rgba(255,255,255,0.98)_42%,rgba(239,246,255,0.94))] p-6 text-center shadow-[0_34px_80px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(30,64,175,0.22),rgba(2,6,23,0.98)_42%,rgba(15,23,42,0.98))] sm:p-8 lg:p-12">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-5xl">
          <div className="inline-flex items-center gap-3 rounded-full border border-primary/15 bg-white/80 px-5 py-2 text-sm font-black uppercase tracking-[0.22em] text-primary shadow-sm dark:bg-slate-950/75">
            <ShieldCheck className="h-5 w-5" />
            Офіційні білети ГСЦ МВС
          </div>
          <h1 className="mt-6 text-4xl font-black tracking-[-0.05em] text-slate-950 dark:text-white sm:text-5xl lg:text-6xl">
            Інтелектуальна система навчання, яка адаптується під вас.
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
            Тренуйтесь на реальних питаннях і здайте іспит з першого разу. Твій шлях до водійського посвідчення починається тут: без нудних підручників, зайвого стресу та хаосу в голові.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild className="rounded-full px-6 text-base shadow-[0_14px_30px_rgba(20,107,255,0.22)]">
              <Link to="/tests">
                Розпочати підготовку
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full border-slate-300 bg-white px-6 text-base shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
              <Link to="/cabinet">Відкрити профіль</Link>
            </Button>
          </div>
        </motion.div>
      </section>

      <section>
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Режими тестування</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950 dark:text-white sm:text-3xl">Оберіть свій формат</h2>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modes.map((mode, index) => (
            <motion.div
              key={mode.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              whileHover={{ y: -4 }}
            >
              <Link
                to={mode.to}
                className="group block rounded-[28px] border border-white/80 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)] transition-shadow hover:shadow-[0_22px_55px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/92"
              >
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${mode.accent} text-white shadow-[0_12px_24px_rgba(15,23,42,0.14)]`}>
                  <mode.icon className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-xl font-black tracking-[-0.03em] text-slate-900 dark:text-white">{mode.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-300">{mode.desc}</p>
                <div className="mt-5 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-4 py-2 text-sm font-bold text-primary">
                    Розпочати
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="rounded-[32px] border border-slate-200/80 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-950/92 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Чому ми?</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {reasons.map((reason) => (
            <div key={reason.title} className="rounded-[24px] border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/80">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900/5 text-slate-700 dark:bg-white/10 dark:text-slate-100">
                <reason.icon className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white">{reason.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-300">{reason.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
