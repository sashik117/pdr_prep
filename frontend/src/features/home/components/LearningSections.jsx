import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.22 },
  transition: { duration: 0.52, ease: 'easeOut' },
};

/**
 * @param {{ theoryItems: string[]; premiumFeatures: string[] }} props
 */
export default function LearningSections({ theoryItems, premiumFeatures }) {
  return (
    <section className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
      <motion.div {...reveal} className="surface-glass rounded-lg p-4 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">Теорія ПДР</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white">
          Повний теоретичний блок у зрозумілій структурі.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
          Вивчайте правила дорожнього руху, дорожні знаки, розмітку, сигнали регулювальника, світлофор і відеоматеріали без
          перевантаження інтерфейсу.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {theoryItems.map((item, index) => (
            <motion.div
              key={item}
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ delay: index * 0.04, duration: 0.35 }}
              className="surface-soft rounded-lg px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200"
            >
              {item}
            </motion.div>
          ))}
        </div>
        <Button asChild className="mt-6 h-11 rounded-xl px-6 text-sm font-bold shadow-none">
          <Link to="/study">Відкрити теорію</Link>
        </Button>
      </motion.div>

      <motion.div
        {...reveal}
        transition={{ ...reveal.transition, delay: 0.08 }}
        className="rounded-lg border border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,252,242,0.98),rgba(255,247,219,0.95))] p-4 shadow-sm dark:border-amber-500/20 dark:bg-[linear-gradient(180deg,rgba(44,28,8,0.9),rgba(20,15,9,0.96))] sm:p-8"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
          <Crown className="h-5 w-5" />
        </div>
        <p className="mt-4 text-sm font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-200">Premium-доступ</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white">
          Додаткові матеріали для глибшої та швидшої підготовки.
        </h2>
        <div className="mt-5 space-y-3">
          {premiumFeatures.map((item, index) => (
            <motion.div
              key={item}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ delay: 0.08 + index * 0.05, duration: 0.35 }}
              className="rounded-lg border border-amber-200/80 bg-white/75 px-4 py-3 text-sm leading-7 text-slate-700 dark:border-amber-500/15 dark:bg-slate-950/30 dark:text-slate-200"
            >
              {item}
            </motion.div>
          ))}
        </div>
        <Button asChild variant="outline" className="mt-6 h-11 rounded-xl border-amber-300 bg-white/80 px-6 text-sm font-bold text-amber-900 shadow-none hover:bg-white dark:border-amber-400/20 dark:bg-slate-950/30 dark:text-amber-100">
          <Link to="/pricing">Переглянути Premium</Link>
        </Button>
      </motion.div>
    </section>
  );
}
