import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * @param {{ fallbackTo?: string, className?: string }} props
 */
export default function InternalBackButton({ fallbackTo = '/cabinet', className = '' }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(fallbackTo);
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={`inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-background px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800 dark:hover:text-white ${className}`.trim()}
      aria-label="Назад"
    >
      <ArrowLeft className="h-4 w-4" />
      Назад
    </button>
  );
}
