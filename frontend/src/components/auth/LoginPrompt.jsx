import { Lock, LogIn, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';

export default function LoginPrompt({
  title = 'Потрібен акаунт',
  description = 'Увійдіть або зареєструйтеся, щоб користуватися цією функцією.',
}) {
  const { navigateToLogin, navigateToRegister } = useAuth();
  const redirectTo = `${window.location.pathname}${window.location.search}`;

  return (
    <div className="mx-auto max-w-xl py-20 text-center">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[28px] bg-slate-100 text-slate-500">
          <Lock className="h-9 w-9" />
        </div>
        <h2 className="text-2xl font-black text-slate-900">{title}</h2>
        <p className="mx-auto mt-3 max-w-md text-slate-500">{description}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button className="rounded-full px-6" onClick={() => navigateToLogin(redirectTo)}>
            <LogIn className="mr-2 h-4 w-4" />
            Увійти
          </Button>
          <Button variant="outline" className="rounded-full px-6" onClick={() => navigateToRegister(redirectTo)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Реєстрація
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
