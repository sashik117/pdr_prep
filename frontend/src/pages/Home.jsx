import { Link } from 'react-router-dom';
import { ArrowRight, BellRing, BookMarked, CircleAlert, ClipboardCheck, FileCheck2, Swords, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const modes = [
  { title: 'Швидкий тест', desc: 'Ідеальний старт, коли є 5-10 хвилин. Запускаєте коротку сесію, швидко ловите темп і одразу бачите, де голова ще сумнівається.', to: '/tests', icon: ClipboardCheck, accent: 'from-sky-500 to-blue-600' },
  { title: 'Повний іспит', desc: 'Максимально близько до того, що відчуєте в ГСЦ. Повна концентрація, справжній ритм і хороша перевірка, чи готові ви вже без поблажок.', to: '/tests', icon: FileCheck2, accent: 'from-blue-600 to-indigo-600' },
  { title: 'Робота над помилками', desc: 'Найкорисніший режим після кількох спроб. Сайт повертає саме в ті теми, де ви вже спіткнулися, щоб слабкі місця реально перестали бути слабкими.', to: '/mistakes', icon: CircleAlert, accent: 'from-rose-500 to-orange-500' },
  { title: 'Виклик дня', desc: 'Режим для найзавзятіших і найрозумніших. Короткий щоденний челендж тримає форму, не дає випадати з навчання і красиво розігріває серію активності.', to: '/daily', icon: BellRing, accent: 'from-amber-400 to-orange-500' },
  { title: 'Батл', desc: 'Тут уже не просто навчання, а азарт. Запрошуйте друзів, змагайтесь по питаннях і дивіться, хто з вас тримає теорію впевненіше.', to: '/battle', icon: Swords, accent: 'from-violet-500 to-fuchsia-500' },
  { title: 'Знаки', desc: 'Окремий простір, щоб спокійно роздивитися дорожні знаки, збільшити їх і закріпити в пам’яті без поспіху та шуму великого тесту.', to: '/signs', icon: BookMarked, accent: 'from-emerald-500 to-teal-500' },
];

const reasons = [
  { title: 'Офіційні білети', text: 'Працюєте з реальними питаннями без вигаданої теорії.', icon: ClipboardCheck },
  { title: 'Розумне навчання', text: 'Сервіс підсвічує теми, де вам треба підсилитися.', icon: Trophy },
  { title: 'Детальна статистика', text: 'Одразу видно серію, активність і слабкі розділи.', icon: FileCheck2 },
  { title: 'Досягнення', text: 'Нагороди і прогрес видно прямо у вашому профілі.', icon: BookMarked },
];

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-[36px] border border-white/90 bg-[linear-gradient(135deg,rgba(13,71,161,0.12),rgba(255,255,255,0.98)_42%,rgba(239,246,255,0.94))] p-6 shadow-[0_34px_80px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(30,64,175,0.22),rgba(2,6,23,0.98)_42%,rgba(15,23,42,0.98))] sm:p-8 lg:p-12">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-primary">Офіційні білети ГСЦ МВС</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] text-slate-950 sm:text-5xl lg:text-6xl">
            Інтелектуальна система навчання, яка адаптується під вас.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            Тренуйтесь на реальних питаннях і здайте іспит з першого разу! Твій шлях до водійського посвідчення починається тут. Стань професіоналом без стресу та нудних підручників!
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
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
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950 sm:text-3xl">Оберіть свій формат</h2>
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
                className="group block rounded-[28px] border border-white/80 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)] transition-shadow hover:shadow-[0_22px_55px_rgba(15,23,42,0.08)]"
              >
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${mode.accent} text-white shadow-[0_12px_24px_rgba(15,23,42,0.14)]`}>
                  <mode.icon className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-xl font-black tracking-[-0.03em] text-slate-900">{mode.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{mode.desc}</p>
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
            <div key={reason.title} className="rounded-[24px] border border-slate-100 bg-slate-50/70 p-4">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900/5 text-slate-700">
                <reason.icon className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-slate-900">{reason.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{reason.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
