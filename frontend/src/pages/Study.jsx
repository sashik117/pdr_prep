import { BookOpen, Bus, Gavel, HeartPulse, LayoutList, Shield, TrafficCone, Wrench } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/** @typedef {'warn' | 'allow' | 'neutral'} Tone */

/** @type {{ title: string, icon: any, points: { text: string, tone: Tone }[] }[]} */
const modules = [
  {
    title: 'Офіційні ПДР України',
    icon: BookOpen,
    points: [
      { text: 'Базові визначення, права та обов’язки водія.', tone: 'allow' },
      { text: 'Пріоритетність, сигнали, маневрування і безпечний рух.', tone: 'neutral' },
      { text: 'Зупинка, стоянка та ключові обмеження.', tone: 'warn' },
    ],
  },
  {
    title: 'Дорожні знаки та розмітка',
    icon: TrafficCone,
    points: [
      { text: 'Попереджувальні, заборонні та наказові знаки.', tone: 'warn' },
      { text: 'Інформаційні знаки і логіка їх використання.', tone: 'allow' },
      { text: 'Горизонтальна та вертикальна розмітка.', tone: 'neutral' },
    ],
  },
  {
    title: 'Регулювальник та світлофори',
    icon: LayoutList,
    points: [
      { text: 'Жести регулювальника простими словами.', tone: 'neutral' },
      { text: 'Основні режими світлофорів.', tone: 'allow' },
      { text: 'Що має пріоритет: знаки, світлофор чи регулювальник.', tone: 'warn' },
    ],
  },
  {
    title: 'Безпека дорожнього руху',
    icon: Shield,
    points: [
      { text: 'Маневрування, обгін і дистанція.', tone: 'neutral' },
      { text: 'Рух у дощ, туман, ожеледицю та вночі.', tone: 'warn' },
      { text: 'Поведінка в аварійних ситуаціях.', tone: 'allow' },
    ],
  },
  {
    title: 'Технічний стан ТЗ',
    icon: Wrench,
    points: [
      { text: 'Гальма, кермо, колеса та світлотехніка.', tone: 'neutral' },
      { text: 'Що треба перевіряти перед виїздом.', tone: 'allow' },
      { text: 'Несправності, з якими рух заборонений.', tone: 'warn' },
    ],
  },
  {
    title: 'Перша медична допомога',
    icon: HeartPulse,
    points: [
      { text: 'Алгоритм дій при ДТП.', tone: 'neutral' },
      { text: 'Як безпечно зупинити кровотечу.', tone: 'allow' },
      { text: 'Що не можна робити до приїзду медиків.', tone: 'warn' },
    ],
  },
  {
    title: 'Адміністративна відповідальність',
    icon: Gavel,
    points: [
      { text: 'Типові порушення та штрафи.', tone: 'warn' },
      { text: 'Коли можна втратити право керування.', tone: 'warn' },
      { text: 'Відповідальність за ДТП та небезпечне водіння.', tone: 'neutral' },
    ],
  },
  {
    title: 'Спеціалізовані категорії',
    icon: Bus,
    points: [
      { text: 'Матеріали для C / C1.', tone: 'neutral' },
      { text: 'Матеріали для D / D1.', tone: 'neutral' },
      { text: 'Специфіка T та категорій з причепами.', tone: 'allow' },
    ],
  },
];

/** @type {Record<Tone, string>} */
const toneClass = {
  warn: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-950/25 dark:text-red-200',
  allow: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-950/25 dark:text-emerald-200',
  neutral: 'border-sky-100 bg-sky-50 text-slate-700 dark:border-sky-500/20 dark:bg-sky-950/25 dark:text-slate-100',
};

export default function Study() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Card className="overflow-hidden border-white/85 bg-[linear-gradient(135deg,rgba(20,107,255,0.06),rgba(255,255,255,1)_52%,rgba(239,246,255,0.96)_100%)] shadow-[0_24px_70px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(30,64,175,0.18),rgba(2,6,23,0.98)_52%,rgba(15,23,42,0.98))]">
        <CardContent className="p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-primary">Бібліотека</p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-950 dark:text-white sm:text-4xl">Довідник у книжковому стилі</h2>
          <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-600 dark:text-slate-300 sm:text-base">
            Це не суха сторінка з купою тексту, а зібраний довідник, де важливе одразу видно. Заборони виділені червоним, дозволені або корисні дії зеленим, а базові пояснення лишаються чистими й читабельними.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {modules.map((module) => (
          <Card key={module.title} className="overflow-hidden border-white/85 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950/92">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg font-black dark:text-white">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm dark:bg-slate-800">
                  <module.icon className="h-5 w-5" />
                </span>
                {module.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-7">
              {module.points.map((point) => (
                <div key={point.text} className={`rounded-2xl border px-4 py-3 ${toneClass[/** @type {Tone} */ (point.tone)]}`}>
                  {point.text}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
