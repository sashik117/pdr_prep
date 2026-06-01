import { cn } from '@/lib/utils';

const variants = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
  secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-400 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
  outline: 'border-2 border-gray-300 bg-white text-gray-700 hover:border-primary-500 hover:text-primary-600 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100',
  ghost: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:ring-gray-400 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
};

export default function DiplomaButton({
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  children,
  ...props
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant] || variants.primary,
        sizes[size] || sizes.md,
        className,
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg className="-ml-1 mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      ) : null}
      {children}
    </button>
  );
}
