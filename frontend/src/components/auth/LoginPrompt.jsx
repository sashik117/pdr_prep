import { ArrowLeft, Lock, LogIn, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';

export default function LoginPrompt({
  title = 'Потрібен акаунт',
  description = 'Увійдіть або зареєструйтеся, щоб користуватися цією функцією.',
  showBack = true,
}) {
  const { navigateToLogin, navigateToRegister } = useAuth();
  const navigate = useNavigate();
  const redirectTo = `${window.location.pathname}${window.location.search}`;

  return (
    <div className="mx-auto w-full max-w-xl py-8 text-center sm:py-20">
      {showBack ? (
        <div className="mb-6 text-left">
          <Button type="button" variant="ghost" className="rounded-full px-3 text-slate-600 hover:text-slate-950 dark:text-slate-200 dark:hover:text-white" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад
          </Button>
        </div>
      ) : null}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[28px] bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-300">
          <Lock className="h-9 w-9" />
        </div>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{title}</h2>
        <p className="mx-auto mt-3 max-w-md text-slate-500 dark:text-slate-300">{description}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button className="min-h-12 rounded-full px-8 text-base" onClick={() => navigateToLogin(redirectTo)}>
            <LogIn className="mr-2 h-5 w-5" />
            Увійти
          </Button>
          <Button variant="outline" className="min-h-12 rounded-full px-8 text-base" onClick={() => navigateToRegister(redirectTo)}>
            <UserPlus className="mr-2 h-5 w-5" />
            Реєстрація
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
