import { Button } from '@/components/ui/button';

export default function ProtectedScreenFallback({
  loading = false,
  temporary = false,
  onRetry = undefined,
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      </div>
    );
  }

  if (temporary) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-20 text-center">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Зачекайте секунду</h2>
        <p className="text-sm text-slate-500 dark:text-slate-300">
          Сесію знайдено, але профіль ще не встиг підтягнутися із сервера. Спробуйте оновити стан ще раз.
        </p>
        {onRetry ? (
          <Button className="rounded-full px-6" onClick={() => void onRetry()}>
            Оновити сесію
          </Button>
        ) : null}
      </div>
    );
  }

  return null;
}
