import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const reveal = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45, ease: 'easeOut' },
};

/**
 * @param {{ highlights: Array<{ icon: any; title: string; description: string }> }} props
 */
export default function HeroSection({ highlights }) {
  return (
    <section className="grid gap-4 lg:grid-cols-[1.12fr_0.88fr]">
      <motion.div
        {...reveal}
        className="rounded-lg border border-slate-200 bg-transparent px-4 py-5 shadow-none dark:border-slate-800 dark:bg-slate-950 sm:px-6 sm:py-8"
      >
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-md border border-sky-200/80 bg-sky-50/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/40 dark:text-sky-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            Підготовка до іспиту ГСЦ МВС
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">Офіційні тести ПДР 2026</p>
            <h1 className="text-3xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white sm:text-4xl xl:text-5xl">
              Готуйтеся до іспиту спокійно, системно та без перевантаженого інтерфейсу
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base sm:leading-7">
              DrivePrep об’єднує офіційні питання, теорію, білети, відеолекції та аналітику в одному сервісі, який однаково зручно працює на комп’ютері й телефоні.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button asChild className="rounded-xl px-6 text-sm font-bold shadow-none">
              <Link to="/tests">
                Почати тестування
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl px-6 text-sm font-bold shadow-none">
              <Link to="/study">Перейти до теорії</Link>
            </Button>
          </div>

          <div className="grid gap-3 border-t border-slate-200 pt-4 dark:border-slate-800 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-900/50">
              <p className="font-bold text-slate-950 dark:text-white">Оновлено</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">5 січня 2026 року</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-900/50">
              <p className="font-bold text-slate-950 dark:text-white">Формат</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Теорія, білети, аналітика, відео</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-900/50">
              <p className="font-bold text-slate-950 dark:text-white">Доступ</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">ПК, планшет і телефон</p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-3">
        {highlights.map((item, index) => (
          <motion.div
            key={item.title}
            {...reveal}
            transition={{ ...reveal.transition, delay: index * 0.08 }}
            className="rounded-lg border border-slate-200 bg-transparent p-4 dark:border-slate-800 dark:bg-slate-950 sm:p-5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-primary dark:border-slate-700 dark:bg-slate-900">
              <item.icon className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.description}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
