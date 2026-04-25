import { ShieldCheck, LockKeyhole, Database, LogOut } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const items = [
  {
    icon: LockKeyhole,
    title: 'Паролі не лежать відкритим текстом',
    text: 'Пароль проходить хешування перед збереженням, тому ніхто не бачить його як звичайний текст. Навіть усередині системи пароль не читається у відкритому вигляді.',
  },
  {
    icon: Database,
    title: 'Пошта та профіль потрібні тільки для роботи сервісу',
    text: 'Email, username, прогрес, аватарка й результати використовуються лише для входу, статистики, друзів, батлів і навчання всередині PDRPrep.',
  },
  {
    icon: ShieldCheck,
    title: 'Все чікі-пікі з листуванням і даними',
    text: 'Особисті повідомлення, переписка з підтримкою й дані профілю не передаються третім особам. Вони потрібні тільки для того, щоб сервіс працював нормально й зручно саме для вас.',
  },
  {
    icon: LogOut,
    title: 'Кнопка Log out чистить збережений вхід на цьому пристрої',
    text: 'Після виходу локально прибирається токен сесії, і браузер більше не відкриває профіль автоматично, поки ви не увійдете знову.',
  },
];

export default function Privacy() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Card className="overflow-hidden border-white/85 bg-[linear-gradient(135deg,rgba(20,107,255,0.08),rgba(255,255,255,1)_50%,rgba(239,246,255,0.95)_100%)] shadow-[0_24px_70px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(8,47,73,0.92)_52%,rgba(15,23,42,0.98))]">
        <CardContent className="p-8">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Конфіденційність</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.03em] text-slate-900 dark:text-white">
            Як PDRPrep захищає ваші дані
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
            Тут без сухої юрщини: ваші паролі ніхто не бачить, особиста переписка не гуляє по сторонніх сервісах,
            а дані профілю використовуються тільки для навчання, статистики, друзів і батлів.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <Card key={item.title} className="border-white/85 shadow-[0_18px_45px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950/92">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg text-slate-900 dark:text-white">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:bg-sky-500/15">
                  <item.icon className="h-5 w-5" />
                </span>
                {item.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-7 text-slate-600 dark:text-slate-300">{item.text}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
