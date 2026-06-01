import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

const sections = [
  {
    title: '1. Реєстрація та акаунт',
    body: [
      'Після реєстрації користувач створює особистий акаунт DrivePrep і відповідає за збереження доступу до нього.',
      'Не можна передавати акаунт третім особам, продавати його або використовувати для нечесного проходження тестів.',
    ],
  },
  {
    title: '2. Контент і доступ',
    body: [
      'DrivePrep надає навчальні матеріали, тести, білети, аналітику, підтримку та інші функції залежно від типу акаунта.',
      'Окремі можливості можуть бути доступні лише користувачам Premium. Перелік функцій може оновлюватися разом із розвитком сервісу.',
    ],
  },
  {
    title: '3. Оплата Premium',
    body: [
      'Premium-доступ відкривається після підтвердження оплати й діє протягом строку обраного тарифу.',
      'Витрати на інтернет, пристрій або зв’язок користувач оплачує самостійно.',
    ],
  },
  {
    title: '4. Повернення коштів',
    body: [
      'Якщо підписка була придбана помилково, можна звернутися на pdr.preparation@gmail.com із запитом на повернення.',
      'Заявки розглядаються індивідуально з урахуванням строку звернення та фактичного використання сервісу.',
    ],
  },
  {
    title: '5. Правила поведінки',
    body: [
      'У сервісі заборонені спам, реклама, шахрайство, образи, маніпуляції результатами та дії, які заважають іншим користувачам.',
      'У разі порушень акаунт може бути тимчасово обмежено або заблоковано.',
    ],
  },
  {
    title: '6. Контакти',
    body: [
      'Питання щодо підписки, повернення коштів або доступу до Premium надсилайте на pdr.preparation@gmail.com.',
      'Актуальна редакція Угоди підписника DrivePrep діє з 29 квітня 2026 року.',
    ],
  },
];

export default function Terms() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="-ml-2 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Назад
      </button>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-7">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950/35 dark:text-violet-200">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-700 dark:text-violet-200">Угода підписника</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white sm:text-4xl">
          Умови використання DrivePrep та Premium-доступу
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-600 dark:text-slate-300 sm:text-base">
          Коротко й зрозуміло про акаунт, навчальний контент, оплату, повернення коштів і правила поведінки в сервісі.
        </p>
      </section>

      <div className="grid gap-4">
        {sections.map((section) => (
          <section key={section.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <h2 className="text-xl font-semibold tracking-[-0.01em] text-slate-950 dark:text-white">{section.title}</h2>
            <div className="mt-4 grid gap-4 text-sm leading-8 text-slate-600 dark:text-slate-300 sm:grid-cols-2">
              {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </section>
        ))}
      </div>

      <div className="flex pt-2">
        <Button asChild className="px-7">
          <Link to="/pricing">Зрозуміло, перейти до Premium</Link>
        </Button>
      </div>
    </div>
  );
}
