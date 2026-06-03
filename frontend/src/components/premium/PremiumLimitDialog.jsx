import { Crown, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

export default function PremiumLimitDialog({
  open,
  onOpenChange,
  title = 'Ви вичерпали денний ліміт',
  description = 'Безкоштовний доступ дозволяє зробити одну спробу на день. Premium відкриває навчання без денних обмежень, усі білети та повну аналітику.',
  homeLabel = 'Повернутися на головну',
  primaryLabel = 'Отримати Premium',
  primaryTo = '/pricing',
}) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border-0 bg-white p-0 text-slate-950 shadow-2xl dark:bg-slate-950 dark:text-white sm:max-w-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <DialogTitle className="text-xl font-semibold tracking-[-0.03em]">Daily Limit Reached</DialogTitle>
          <button
            type="button"
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-100"
            onClick={() => onOpenChange(false)}
            aria-label="Закрити"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-8 text-center sm:px-10">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose-100 text-rose-600 shadow-inner dark:bg-rose-500/15 dark:text-rose-200">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-fuchsia-600 text-white shadow-lg">
              <Crown className="h-5 w-5" />
            </span>
          </div>

          <h2 className="mt-6 text-2xl font-semibold tracking-[-0.04em]">{title}</h2>
          <DialogDescription className="mx-auto mt-4 max-w-md text-base leading-7 text-slate-600 dark:text-slate-300">
            {description}
          </DialogDescription>

          <div className="mt-8 grid gap-3">
            <Button
              className="min-h-14 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-base font-semibold text-white shadow-lg shadow-orange-500/20 hover:from-amber-500 hover:to-orange-600"
              onClick={() => navigate(primaryTo)}
            >
              {primaryLabel}
            </Button>
            <Button
              variant="outline"
              className="min-h-14 rounded-xl border-2 border-blue-500 bg-transparent text-base font-medium text-blue-600 hover:bg-blue-50 dark:border-sky-400 dark:text-sky-200 dark:hover:bg-sky-500/10"
              onClick={() => navigate('/')}
            >
              {homeLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
