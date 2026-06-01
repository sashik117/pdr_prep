import { cn } from '@/lib/utils';

export default function DiplomaCard({ className, variant = 'default', children, ...props }) {
  const variants = {
    default: 'bg-white shadow-md dark:bg-slate-900',
    elevated: 'bg-white shadow-xl dark:bg-slate-900',
    outline: 'border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900',
  };

  return (
    <div className={cn('rounded-2xl p-6', variants[variant] || variants.default, className)} {...props}>
      {children}
    </div>
  );
}
