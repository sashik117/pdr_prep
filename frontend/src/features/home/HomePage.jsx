import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import HeroSection from '@/features/home/components/HeroSection';
import LearningSections from '@/features/home/components/LearningSections';
import ModesSection from '@/features/home/components/ModesSection';
import SignupSection from '@/features/home/components/SignupSection';
import SocialProofSection from '@/features/home/components/SocialProofSection';
import {
  bentoCards,
  extraModes,
  heroHighlights,
  modeCards,
  premiumFeatures,
  supportActions,
  testimonials,
  theoryItems,
  trustStats,
} from '@/features/home/home-content';

const reveal = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.18 },
  transition: { duration: 0.4, ease: 'easeOut' },
};

export default function HomePage() {
  return (
    <div className="space-y-6 px-4 pb-6 sm:space-y-8 sm:px-6">
      <HeroSection highlights={heroHighlights} />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {bentoCards.map((card, index) => (
          <motion.div
            key={card.title}
            {...reveal}
            transition={{ ...reveal.transition, delay: index * 0.05 }}
          >
            <Link
              to={card.to}
              className="block rounded-2xl border border-slate-200 bg-transparent p-4 transition-colors hover:border-primary/30 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-sky-500/30 sm:p-5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                <card.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">{card.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{card.description}</p>
            </Link>
          </motion.div>
        ))}
      </section>

      <ModesSection modeCards={modeCards} extraModes={extraModes} />
      <LearningSections theoryItems={theoryItems} premiumFeatures={premiumFeatures} />
      <SocialProofSection trustStats={trustStats} testimonials={testimonials} />
      <SignupSection supportActions={supportActions} />
    </div>
  );
}
