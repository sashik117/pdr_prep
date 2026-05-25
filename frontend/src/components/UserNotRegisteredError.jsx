export default function UserNotRegisteredError() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-page-gradient px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-card p-6 shadow-sm dark:border-slate-800 sm:p-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-orange-100">
            <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="mb-4 text-3xl font-semibold text-slate-900 dark:text-white">Доступ обмежено</h1>
          <p className="mb-8 text-slate-600 dark:text-slate-300">
            Ви ще не авторизовані в цьому застосунку. Увійдіть або зареєструйтесь, щоб продовжити.
          </p>
          <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
            <p>Що можна зробити:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Перевірити, чи ви увійшли під правильним email</li>
              <li>Спробувати вийти та зайти знову</li>
              <li>Створити новий акаунт, якщо ще не реєструвались</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
