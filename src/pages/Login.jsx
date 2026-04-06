import { useState } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Mail, Lock, LogIn, UserPlus } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('login'); // login | register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError('Невірний email або пароль');
    } else {
      navigate('/');
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
    } else {
      setSuccess('Перевірте email для підтвердження реєстрації!');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-foreground">🚗 ПДР Тренажер</h1>
          <p className="text-muted-foreground mt-2">Готуйся до іспиту разом з нами</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            {/* Tabs */}
            <div className="flex rounded-xl bg-muted p-1">
              <button
                onClick={() => { setTab('login'); setError(''); setSuccess(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'login' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}
              >
                Увійти
              </button>
              <button
                onClick={() => { setTab('register'); setError(''); setSuccess(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'register' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}
              >
                Зареєструватись
              </button>
            </div>
          </CardHeader>

          <CardContent>
            {success ? (
              <div className="text-center py-6 space-y-3">
                <div className="text-4xl">📧</div>
                <p className="font-semibold text-foreground">Майже готово!</p>
                <p className="text-sm text-muted-foreground">{success}</p>
                <Button variant="outline" className="w-full mt-4" onClick={() => setSuccess('')}>
                  Назад
                </Button>
              </div>
            ) : (
              <form onSubmit={tab === 'login' ? handleLogin : handleRegister} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="pl-9"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Пароль</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pl-9"
                      minLength={6}
                    />
                  </div>
                  {tab === 'register' && (
                    <p className="text-xs text-muted-foreground mt-1">Мінімум 6 символів</p>
                  )}
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <Button type="submit" disabled={loading} className="w-full h-11 gap-2">
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  ) : tab === 'login' ? (
                    <><LogIn className="w-4 h-4" /> Увійти</>
                  ) : (
                    <><UserPlus className="w-4 h-4" /> Зареєструватись</>
                  )}
                </Button>

                <Button type="button" variant="ghost" className="w-full" onClick={() => navigate('/')}>
                  Продовжити без реєстрації
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}