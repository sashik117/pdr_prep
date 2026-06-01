// @ts-nocheck
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const toneMap = {
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-200',
  green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-200',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-200',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-200',
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200',
};

export function AdminPageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">{eyebrow}</p>
        ) : null}
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, hint, tone = 'blue' }) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">{value}</p>
            {hint ? <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{hint}</p> : null}
          </div>
          <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', toneMap[tone] || toneMap.blue)}>
            <Icon className="h-5 w-5" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function LoadingState({ text = 'Завантажую дані...' }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      {text}
    </div>
  );
}

export function EmptyState({ text = 'Даних поки немає.' }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
      {text}
    </div>
  );
}
