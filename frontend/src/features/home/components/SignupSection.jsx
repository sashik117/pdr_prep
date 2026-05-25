import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const reveal = {
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.5, ease: 'easeOut' },
};

/**
 * @param {{ supportActions: any[] }} props
 */
export default function SignupSection({ supportActions }) {
  return (
    <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
      <motion.div {...reveal} className="surface-glass rounded-lg p-4 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">Профіль і прогрес</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white">
          Реєструйтеся, щоб зберігати результати й навчатися системно.
        </h2>
        <div className="mt-5 grid gap-3 text-sm leading-7 text-slate-700 dark:text-slate-300">
          <div className="surface-soft rounded-lg px-4 py-3">Збереження всіх пройдених тестів і білетів.</div>
          <div className="surface-soft rounded-lg px-4 py-3">Аналітика помилок, історія спроб і персональний прогрес.</div>
          <div className="surface-soft rounded-lg px-4 py-3">Швидке повернення до тем, де потрібно більше повторення.</div>
        </div>
        <Button asChild className="mt-6 h-11 rounded-xl px-6 text-sm font-bold shadow-none">
          <Link to="/auth">Створити профіль</Link>
        </Button>
      </motion.div>

      <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.08 }} className="surface-soft rounded-lg p-4 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">Додаткові розділи</p>
        <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
          Підтримка, відеолекції та Premium-можливості — без зайвих переходів і плутанини.
        </h3>
        <div className="mt-5 flex flex-wrap gap-3">
          {supportActions.map((item, index) => (
            <motion.div
              key={item.to}
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ delay: index * 0.05, duration: 0.28 }}
            >
              <Button asChild variant="outline" className="h-11 rounded-xl px-5 text-sm font-bold shadow-none">
                <Link to={item.to}>
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Link>
              </Button>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
