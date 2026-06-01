import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';

const sections = [
  {
    title: '1. Загальні положення',
    body: [
      'DrivePrep поважає право відвідувачів і користувачів на конфіденційність. Ми збираємо лише ті дані, які потрібні для роботи акаунта, навчання, оплати та підтримки.',
      'Політика пояснює, які дані обробляються, як вони використовуються і як користувач може керувати своїм профілем.',
    ],
  },
  {
    title: '2. Які дані ми збираємо',
    body: [
      'Під час реєстрації можуть зберігатися ім’я, прізвище, username, пошта, захищений пароль, аватар, налаштування, статистика навчання, результати тестів і Premium-статус.',
      'Також можуть використовуватися технічні й агреговані дані, які допомагають покращувати стабільність, аналітику та якість навчального контенту.',
    ],
  },
  {
    title: '3. Як використовуються дані',
    body: [
      'Дані потрібні для входу, відновлення доступу, збереження прогресу, показу статистики, платежів, підтримки, соціальних функцій і персоналізації навчання.',
      'DrivePrep не продає персональні дані третім особам і не передає їх для стороннього маркетингу без згоди користувача.',
    ],
  },
  {
    title: '4. Публічність профілю',
    body: [
      'Користувач сам керує частиною даних профілю, які можуть бути видимі іншим користувачам. Пошту можна приховати в налаштуваннях.',
      'Власник акаунта завжди бачить власні дані у профілі та кабінеті.',
    ],
  },
  {
    title: '5. Платежі та Premium',
    body: [
      'Під час оформлення Premium обробляються службові дані замовлення: тариф, статус оплати, термін дії доступу та технічний ідентифікатор платежу.',
      'Платіжні реквізити карток не зберігаються у DrivePrep у відкритому вигляді.',
    ],
  },
  {
    title: '6. Cookie та локальні дані',
    body: [
      'Сервіс може використовувати cookie, localStorage і sessionStorage для сесії, теми, шрифту, лімітів, входу та стабільної роботи застосунку.',
      'Ці механізми не використовуються для несанкціонованого доступу до персональних даних.',
    ],
  },
  {
    title: '7. Контроль і видалення',
    body: [
      'Користувач може звернутися щодо оновлення, обмеження або видалення персональних даних на pdr.preparation@gmail.com.',
      'Дата редакції: 29 квітня 2026 року.',
    ],
  },
];

export default function Privacy() {
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
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950/35 dark:text-sky-200">
          <LockKeyhole className="h-6 w-6" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700 dark:text-sky-200">Політика конфіденційності</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white sm:text-4xl">
          Як DrivePrep обробляє та захищає персональні дані
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-600 dark:text-slate-300 sm:text-base">
          Ми пояснюємо правила простими словами, щоб користувач розумів, які дані потрібні сервісу і як ними можна керувати.
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
          <Link to="/tests">Зрозуміло, до навчання</Link>
        </Button>
      </div>
    </div>
  );
}
