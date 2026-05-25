import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.5, ease: 'easeOut' },
};

/**
 * @param {{ modeCards: any[]; extraModes: any[] }} props
 */
export default function ModesSection({ modeCards, extraModes }) {
  return (
    <section className="space-y-5">
      <motion.div {...reveal}>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">Режими навчання</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white">
          Формати підготовки для різних сценаріїв і різного темпу.
        </h2>
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-3">
        {modeCards.map((item, index) => (
          <motion.div key={item.title} {...reveal} transition={{ ...reveal.transition, delay: index * 0.06 }}>
            <Link to={item.to} className="surface-glass reveal-card block h-full rounded-lg p-4 hover:border-primary/30 sm:p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{item.description}</p>
              <div className="mt-5 space-y-2.5">
                {item.bullets.map((bullet) => (
                  <div key={bullet} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-200">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {extraModes.map((item, index) => {
          const CardBody = (
            <>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{item.description}</p>
            </>
          );
          return (
          <motion.div
            key={item.title}
            {...reveal}
            transition={{ ...reveal.transition, delay: 0.12 + index * 0.05 }}
            className="surface-soft reveal-card rounded-lg p-4 sm:p-5"
          >
            {item.to ? <Link to={item.to} className="block">{CardBody}</Link> : CardBody}
          </motion.div>
          );
        })}
      </div>
    </section>
  );
}
