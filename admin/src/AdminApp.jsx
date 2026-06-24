// @ts-nocheck
import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Loader2, LockKeyhole, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import api, { adminTokenStore, adminUserStore } from '@/api/apiClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import AdminShell from '@admin/components/AdminShell';
import OverviewPage from '@admin/pages/OverviewPage';
import UsersPage from '@admin/pages/UsersPage';
import TheoryPage from '@admin/pages/TheoryPage';
import QuestionsPage from '@admin/pages/QuestionsPage';
import PremiumPage from '@admin/pages/PremiumPage';
import SupportPage from '@admin/pages/SupportPage';

export default function AdminApp() {
  const [admin, setAdmin] = useState(adminUserStore.get());
  const [isChecking, setIsChecking] = useState(Boolean(adminTokenStore.get()));

  useEffect(() => {
    let alive = true;
    const token = adminTokenStore.get();
    if (!token) {
      setIsChecking(false);
      return () => {
        alive = false;
      };
    }

    api.adminMe()
      .then((currentAdmin) => {
        if (!alive) return;
        adminUserStore.set(currentAdmin, adminTokenStore.hasPersistent());
        setAdmin(currentAdmin);
      })
      .catch(() => {
        adminTokenStore.clear();
        adminUserStore.clear();
        if (alive) setAdmin(null);
      })
      .finally(() => {
        if (alive) setIsChecking(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const handleLogin = (payload, rememberMe) => {
    adminTokenStore.set(payload.token, rememberMe);
    adminUserStore.set(payload.admin, rememberMe);
    setAdmin(payload.admin);
  };

  const handleLogout = () => {
    adminTokenStore.clear();
    adminUserStore.clear();
    setAdmin(null);
  };

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Перевіряю адмін-доступ...
      </div>
    );
  }

  if (!admin) {
    return (
      <QueryClientProvider client={queryClientInstance}>
        <AdminLoginPage onLogin={handleLogin} />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClientInstance}>
      <AdminShell admin={admin} onLogout={handleLogout}>
        <Routes>
          <Route index element={<OverviewPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="theory" element={<TheoryPage />} />
          <Route path="questions" element={<QuestionsPage />} />
          <Route path="premium" element={<PremiumPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AdminShell>
    </QueryClientProvider>
  );
}

function AdminLoginPage({ onLogin }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const payload = await api.adminLogin(username.trim(), password.trim(), rememberMe);
      onLogin(payload, rememberMe);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося увійти в адмін-панель.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-white">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900 shadow-2xl">
        <CardContent className="p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Shield className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-blue-300">DrivePrep Admin</p>
              <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white">Службовий вхід</h1>
            </div>
          </div>

          <form className="mt-8 space-y-4" onSubmit={submit}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Нік адміністратора</span>
              <Input
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="border-slate-600 bg-slate-950 text-white placeholder:text-slate-500 focus-visible:border-blue-400 focus-visible:ring-blue-500/30"
                placeholder="admin"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Пароль</span>
              <Input
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="border-slate-600 bg-slate-950 text-white placeholder:text-slate-500 focus-visible:border-blue-400 focus-visible:ring-blue-500/30"
                placeholder="Пароль"
              />
            </label>

            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-950"
              />
              Запамʼятати цю адмін-сесію
            </label>

            {error ? (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                {error}
              </div>
            ) : null}

            <Button type="submit" disabled={isSubmitting || !username.trim() || !password.trim()} className="w-full rounded-lg">
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />}
              Увійти в адмінку
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

