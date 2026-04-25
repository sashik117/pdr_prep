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
      className={`inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-white/88 px-4 py-2 text-sm font-bold text-slate-700 shadow-[0_14px_30px_rgba(59,130,246,0.10)] backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:text-slate-950 ${className}`.trim()}
      aria-label="Назад"
    >
      <ArrowLeft className="h-4 w-4" />
      Назад
    </button>
  );
}
