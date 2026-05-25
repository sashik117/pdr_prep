// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { Bell, LogOut, Moon, Palette, Shield, Sun, Type, Volume2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import api, { tokenStore } from '@/api/apiClient';
import { applyTheme, notifyThemeChange } from '@/lib/theme';
import { useAuth } from '@/lib/AuthContext';

const themes = [
  { id: 'light', label: 'Світла', icon: Sun },
  { id: 'dark', label: 'Темна', icon: Moon },
];

export default function Settings() {
  const { user, isAuthenticated, login, logout } = useAuth();
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem('theme');
    return stored === 'dark' ? 'dark' : 'light';
  });
  const [fontSize, setFontSize] = useState(() => parseInt(localStorage.getItem('fontSize') || String(user?.font_size || 16), 10));
  const [soundEnabled, setSoundEnabled] = useState(() => JSON.parse(localStorage.getItem('soundEnabled') || String(user?.sound_enabled ?? true)));
  const [pushEnabled, setPushEnabled] = useState(() => JSON.parse(localStorage.getItem('pushEnabled') || String(user?.push_enabled ?? false)));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user) return;
    const stored = localStorage.getItem('theme');
    setTheme(stored === 'dark' ? 'dark' : user.theme_preference === 'dark' ? 'dark' : 'light');
    setFontSize(user.font_size || parseInt(localStorage.getItem('fontSize') || '16', 10));
    setSoundEnabled(user.sound_enabled ?? true);
    setPushEnabled(user.push_enabled ?? false);
  }, [user]);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('theme', theme);
    notifyThemeChange(theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
    localStorage.setItem('fontSize', String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem('soundEnabled', JSON.stringify(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem('pushEnabled', JSON.stringify(pushEnabled));
  }, [pushEnabled]);

  const dirty = useMemo(
    () =>
      !!user &&
      (theme !== (user.theme_preference === 'dark' ? 'dark' : 'light') ||
        fontSize !== (user.font_size || 16) ||
        soundEnabled !== (user.sound_enabled ?? true) ||
        pushEnabled !== (user.push_enabled ?? false)),
    [fontSize, pushEnabled, soundEnabled, theme, user],
  );

  const persistSettings = async (next = {}) => {
    if (!user) return;
    const payload = {
      theme_preference: next.theme ?? theme,
      font_size: next.fontSize ?? fontSize,
      sound_enabled: next.soundEnabled ?? soundEnabled,
      push_enabled: next.pushEnabled ?? pushEnabled,
    };

    setSaving(true);
    setMessage('');
    try {
      const updated = await api.updateProfile(payload);
      login(tokenStore.get() || '', updated, tokenStore.hasPersistent());
      setMessage('Налаштування збережено.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не вдалося зберегти налаштування.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Card className="surface-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Оформлення та доступність
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Тема сайту</p>
              <div className="grid grid-cols-1 gap-3 min-[460px]:grid-cols-2">
                {themes.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTheme(id)}
                    className={`min-w-0 rounded-lg border px-4 py-4 text-left shadow-sm transition-colors ${
                      theme === id
                        ? 'border-primary bg-primary/5 dark:bg-primary/10'
                        : 'border-slate-200 bg-background hover:border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${theme === id ? 'text-primary' : 'text-slate-500 dark:text-slate-300'}`} />
                      <p className="min-w-0 break-words text-sm font-medium text-slate-900 dark:text-white sm:text-base">{label}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                <Type className="h-4 w-4" />
                Розмір тексту
              </p>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button variant="outline" onClick={() => setFontSize((value) => Math.max(14, value - 1))}>
                    -
                  </Button>
                  <span className="text-2xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-white">{fontSize}px</span>
                  <Button variant="outline" onClick={() => setFontSize((value) => Math.min(20, value + 1))}>
                    +
                  </Button>
                </div>
                <p className="mt-4 text-slate-600 dark:text-slate-300" style={{ fontSize: `${fontSize}px` }}>
                  Так виглядатиме основний текст на сайті.
                </p>
              </div>
            </div>
          </div>

          {isAuthenticated ? (
            <div className="grid gap-4 md:grid-cols-2">
              <ToggleCard
                icon={Volume2}
                title="Звуки"
                description="Короткі сигнали після відповідей і завершення тесту."
                checked={soundEnabled}
                onChange={setSoundEnabled}
              />
              <ToggleCard
                icon={Bell}
                title="Сповіщення"
                description="Повідомлення про друзів, батли та відповіді підтримки."
                checked={pushEnabled}
                onChange={setPushEnabled}
              />
            </div>
          ) : null}

          {isAuthenticated ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-300">
                {message || 'Тема, шрифт і сповіщення зберігаються для профілю та цього пристрою.'}
              </p>
              <Button className="rounded-lg" disabled={!dirty || saving} onClick={() => void persistSettings()}>
                {saving ? 'Збереження...' : 'Зберегти налаштування'}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {isAuthenticated ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="surface-glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Підказки
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              <p>Починайте з короткого тесту на 10 питань, якщо маєте лише кілька вільних хвилин.</p>
              <p>Після помилки відкрийте пояснення і поверніться до відповідного правила в теорії.</p>
            </CardContent>
          </Card>

          <Card className="surface-glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Безпека
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              <p>Дані профілю використовуються для прогресу, друзів, батлів і статистики.</p>
              <p>Використовуйте особистий пристрій для навчання, якщо хочете зберігати стабільний прогрес.</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {isAuthenticated ? (
        <Card className="border-red-200 bg-red-50 shadow-sm dark:border-red-500/30 dark:bg-red-950/30">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:p-6">
            <div>
              <p className="font-medium text-slate-900 dark:text-white">Вихід з акаунту</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">Завершіть сеанс на цьому пристрої, якщо він більше не ваш.</p>
            </div>
            <Button variant="destructive" className="w-full rounded-lg px-5 sm:w-auto" onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              Вийти
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ToggleCard({ icon: Icon, title, description, checked, onChange }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-background p-4 shadow-sm dark:border-slate-700">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" />
            <p className="font-medium text-slate-900 dark:text-white">{title}</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
        </div>
        <button
          type="button"
          aria-pressed={checked}
          onClick={() => onChange(!checked)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}
        >
          <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${checked ? 'left-6' : 'left-1'}`} />
        </button>
      </div>
    </div>
  );
}
