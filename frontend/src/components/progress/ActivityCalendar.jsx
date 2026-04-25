import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/** @param {Date} date */
function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** @param {Date} date */
function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** @param {Date} date */
function getMonthEnd(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/** @param {Date} date */
function getCalendarStart(date) {
  const start = getMonthStart(date);
  const day = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - day);
  return start;
}

/** @param {Date} date */
function getCalendarEnd(date) {
  const end = getMonthEnd(date);
  const day = (end.getDay() + 6) % 7;
  end.setDate(end.getDate() + (6 - day));
  return end;
}

/**
 * @param {Date} monthDate
 * @returns {Date[][]}
 */
function buildMonthGrid(monthDate) {
  const cursor = getCalendarStart(monthDate);
  const last = getCalendarEnd(monthDate);
  const weeks = [];

  while (cursor <= last) {
    const week = [];
    for (let i = 0; i < 7; i += 1) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
}

const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

/**
 * @param {{ dates?: string[], startDate?: string | null }} props
 */
export default function ActivityCalendar({ dates = [], startDate = null }) {
  const today = useMemo(() => new Date(), []);
  const latestMonth = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today]);
  const earliestMonth = useMemo(() => {
    if (!startDate) return latestMonth;
    const parsed = new Date(startDate);
    if (Number.isNaN(parsed.getTime())) return latestMonth;
    return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
  }, [latestMonth, startDate]);
  const initialOffset = (latestMonth.getFullYear() - earliestMonth.getFullYear()) * 12 + (latestMonth.getMonth() - earliestMonth.getMonth());
  const [monthOffset, setMonthOffset] = useState(0);
  const currentMonth = useMemo(() => new Date(latestMonth.getFullYear(), latestMonth.getMonth() - monthOffset, 1), [latestMonth, monthOffset]);

  const minReached = currentMonth.getFullYear() === earliestMonth.getFullYear() && currentMonth.getMonth() === earliestMonth.getMonth();
  const maxReached = monthOffset <= 0;
  const dateSet = useMemo(() => new Set([...new Set(dates)]), [dates]);
  const todayKey = formatLocalDate(today);
  const weeks = useMemo(() => buildMonthGrid(currentMonth), [currentMonth]);
  const monthLabel = currentMonth.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });

  return (
    <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[22px] border border-slate-200 bg-white/95 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950/85 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setMonthOffset((value) => Math.min(initialOffset, value + 1))}
          disabled={minReached}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          aria-label="Попередній місяць"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <p className="text-center text-xs font-black uppercase tracking-[0.18em] text-slate-700 dark:text-slate-100 sm:text-sm">
          {monthLabel}
        </p>

        <button
          type="button"
          onClick={() => setMonthOffset((value) => Math.max(0, value - 1))}
          disabled={maxReached}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          aria-label="Наступний місяць"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {weekDays.map((day) => (
          <div key={day} className="pb-1 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500 sm:text-[10px]">
            {day}
          </div>
        ))}

        {weeks.flat().map((date) => {
          const dayKey = formatLocalDate(date);
          const isCurrentMonth = date.getMonth() === currentMonth.getMonth() && date.getFullYear() === currentMonth.getFullYear();
          const isActive = dateSet.has(dayKey);
          const isToday = dayKey === todayKey;

          return (
            <div
              key={dayKey}
              title={dayKey}
              className={cn(
                'aspect-square min-h-[30px] rounded-[10px] border text-[10px] font-bold transition-all sm:min-h-[36px] sm:text-xs',
                'flex items-center justify-center',
                isCurrentMonth
                  ? 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100'
                  : 'border-transparent bg-slate-50/40 text-slate-300 dark:bg-slate-900/50 dark:text-slate-700',
                isActive && 'border-sky-300 bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_55%,#22c55e_100%)] text-white shadow-[0_8px_18px_rgba(37,99,235,0.32)] dark:border-sky-300 dark:bg-[linear-gradient(135deg,#60a5fa_0%,#2563eb_55%,#34d399_100%)] dark:text-white dark:shadow-[0_10px_20px_rgba(59,130,246,0.4)]',
                isToday && !isActive && 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-600 dark:bg-sky-950/60 dark:text-sky-200',
              )}
            >
              {date.getDate()}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-300">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-[4px] border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900" />
          Без активності
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-[4px] border border-primary/30 bg-primary" />
          Активний день
        </span>
      </div>
    </div>
  );
}
