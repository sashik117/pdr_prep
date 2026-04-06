import { cn } from '@/lib/utils';

export default function ActivityCalendar({ dates = [] }) {
  const today = new Date();
  const dateSet = new Set(dates);

  // Generate last 12 weeks (84 days)
  const days = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }

  // Organize into weeks (7 days each)
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1 min-w-fit">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day) => (
              <div
                key={day}
                title={day}
                className={cn(
                  "w-4 h-4 rounded-sm transition-colors",
                  dateSet.has(day)
                    ? "bg-primary"
                    : "bg-muted"
                )}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
        <span>Менше</span>
        <div className="w-3 h-3 rounded-sm bg-muted" />
        <div className="w-3 h-3 rounded-sm bg-primary/40" />
        <div className="w-3 h-3 rounded-sm bg-primary" />
        <span>Більше</span>
      </div>
    </div>
  );
}