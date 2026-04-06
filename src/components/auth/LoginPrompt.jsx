import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Lock, UserPlus, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function LoginPrompt({ title = 'Тільки для зареєстрованих', description = 'Увійдіть або зареєструйтесь щоб отримати доступ до цієї функції' }) {
  const navigate = useNavigate();
  return (
    <div className="max-w-xl mx-auto py-20 text-center space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center mx-auto mb-6">
          <Lock className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        <p className="text-muted-foreground mt-2 max-w-sm mx-auto">{description}</p>
        <div className="flex flex-col sm:flex-row justify-center gap-3 mt-8">
          <Button size="lg" className="gap-2 rounded-xl px-8" onClick={() => navigate('/login')}>
            <LogIn className="w-5 h-5" />
            Увійти
          </Button>
          <Button size="lg" variant="outline" className="gap-2 rounded-xl px-8" onClick={() => navigate('/login')}>
            <UserPlus className="w-5 h-5" />
            Зареєструватись
          </Button>
        </div>
      </motion.div>
    </div>
  );
}