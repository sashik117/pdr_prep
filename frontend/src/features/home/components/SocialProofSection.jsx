import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

const reveal = {
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.48, ease: 'easeOut' },
};

/**
 * @param {{ trustStats: any[]; testimonials: any[] }} props
 */
export default function SocialProofSection({ trustStats, testimonials }) {
  return (
    <section className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        {trustStats.map((item, index) => (
          <motion.div
            key={item.value}
            {...reveal}
            transition={{ ...reveal.transition, delay: index * 0.06 }}
            className="surface-glass rounded-lg p-4 sm:p-6"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {item.icon ? <item.icon className="h-5 w-5" /> : <Star className="h-5 w-5" />}
            </div>
            <div className="text-4xl font-semibold tracking-[-0.06em] text-slate-950 dark:text-white">{item.value}</div>
            <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{item.description}</p>
          </motion.div>
        ))}
      </div>

      <motion.div {...reveal}>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">Відгуки користувачів</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white">
          Сервіс, до якого повертаються через результат, а не через шум.
        </h2>
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-2">
        {testimonials.map((item, index) => (
          <motion.div
            key={item.name}
            {...reveal}
            transition={{ ...reveal.transition, delay: 0.05 + index * 0.04 }}
            className="surface-glass rounded-lg p-4 sm:p-6"
          >
            <div className="mb-4 flex items-center gap-1 text-amber-500">
              {Array.from({ length: 5 }).map((_, starIndex) => (
                <Star key={starIndex} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <p className="text-sm leading-7 text-slate-700 dark:text-slate-200">{item.text}</p>
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.08em] text-slate-950 dark:text-white">{item.name}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
