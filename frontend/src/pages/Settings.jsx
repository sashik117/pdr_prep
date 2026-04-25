// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { Bell, BookMarked, LogOut, Monitor, Moon, Palette, Shield, Sun, Type, Volume2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import LoginPrompt from '@/components/auth/LoginPrompt';
import api, { tokenStore } from '@/api/apiClient';

const themes = [
  { id: 'light', label: 'Світла', icon: Sun },
  { id: 'dark', label: 'Темна', icon: Moon },
  { id: 'system', label: 'Системна', icon: Monitor },
];

const guideModules = [
  'Офіційні ПДР України',
  'Дорожні знаки та розмітка',
  'Регулювальник та світлофори',
  'Безпека дорожнього руху',
  'Технічний стан ТЗ',
  'Перша медична допомога',
  'Адміністративна відповідальність',
  'Спеціалізовані категорії',
];

function applyTheme(theme) {
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
}

export default function Settings() {
  const { user, login, logout } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || user?.theme_preference || 'system');
  const [fontSize, setFontSize] = useState(() => parseInt(localStorage.getItem('fontSize') || String(user?.font_size || 16), 10));
  const [soundEnabled, setSoundEnabled] = useState(() => JSON.parse(localStorage.getItem('soundEnabled') || String(user?.sound_enabled ?? true)));
  const [pushEnabled, setPushEnabled] = useState(() => JSON.parse(localStorage.getItem('pushEnabled') || String(user?.push_enabled ?? false)));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) {
      setTheme(user.theme_preference || localStorage.getItem('theme') || 'system');
      setFontSize(user.font_size || parseInt(localStorage.getItem('fontSize') || '16', 10));
      setSoundEnabled(user.sound_enabled ?? true);
      setPushEnabled(user.push_enabled ?? false);
    }
  }, [user]);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('theme', theme);
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

  const dirty = useMemo(() => (
    !!user && (
      theme !== (user.theme_preference || 'system')
      || fontSize !== (user.font_size || 16)
      || soundEnabled !== (user.sound_enabled ?? true)
      || pushEnabled !== (user.push_enabled ?? false)
    )
  ), [fontSize, pushEnabled, soundEnabled, theme, user]);

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
      login(tokenStore.get() || '', updated, !!localStorage.getItem('pdr_token'));
      setMessage('Налаштування збережено');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не вдалося зберегти налаштування');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <LoginPrompt
        title="Налаштування"
        description="Увійдіть, щоб керувати темою, шрифтом і сповіщеннями для свого профілю."
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Card className="border-white/80 shadow-[0_18px_45px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950/92">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Оформлення та доступність
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Тема сайту</p>
              <div className="grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 sm:grid-cols-3">
                {themes.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTheme(id)}
                    className={`min-w-0 rounded-2xl border px-4 py-4 text-left shadow-sm transition-all ${
                      theme === id
                        ? 'border-primary bg-primary/5 shadow-[0_14px_30px_rgba(20,107,255,0.12)]'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${theme === id ? 'text-primary' : 'text-slate-500 dark:text-slate-300'}`} />
                      <p className="min-w-0 break-words text-sm font-semibold text-slate-900 dark:text-white sm:text-base">{label}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                <Type className="h-4 w-4" />
                Розмір тексту
              </p>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button variant="outline" className="shadow-sm" onClick={() => setFontSize((value) => Math.max(14, value - 1))}>
                    -
                  </Button>
                  <span className="text-2xl font-extrabold tracking-[-0.03em] text-slate-900 dark:text-white">{fontSize}px</span>
                  <Button variant="outline" className="shadow-sm" onClick={() => setFontSize((value) => Math.min(20, value + 1))}>
                    +
                  </Button>
                </div>
                <p className="mt-4 text-slate-600 dark:text-slate-300" style={{ fontSize: `${fontSize}px` }}>
                  Так буде виглядати основний текст на сайті.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ToggleCard
              icon={Volume2}
              title="Звуки"
              description="Увімкніть або вимкніть звукові сповіщення й короткі сигнали."
              checked={soundEnabled}
              onChange={setSoundEnabled}
            />
            <ToggleCard
              icon={Bell}
              title="Пуші та нові події"
              description="Керуйте сповіщеннями про друзів, батли та підтримку."
              checked={pushEnabled}
              onChange={setPushEnabled}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-300">{message || 'Тема, шрифт і сповіщення зберігаються для вашого профілю та цього пристрою.'}</p>
            <Button
              className="rounded-xl shadow-[0_14px_28px_rgba(20,107,255,0.18)]"
              disabled={!dirty || saving}
              onClick={() => void persistSettings()}
            >
              {saving ? 'Збереження...' : 'Зберегти налаштування'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/80 shadow-[0_18px_45px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950/92">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookMarked className="h-5 w-5 text-primary" />
            Довідники
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {guideModules.map((item) => (
            <a
              key={item}
              href="/study"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-primary/25 hover:bg-sky-50 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              {item}
            </a>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-white/80 shadow-[0_18px_45px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950/92">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Підказки
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            <p>Краще проходити хоча б один короткий тест щодня, щоб не губився вогник серії.</p>
            <p>Після помилок одразу заходьте в розділ «Помилки» — так слабкі теми закриваються значно швидше.</p>
          </CardContent>
        </Card>

        <Card className="border-white/80 shadow-[0_18px_45px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950/92">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Все чікі-пікі
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            <p>Паролі зберігаються не у відкритому вигляді, а дані профілю потрібні тільки для навчання, друзів, батлів і статистики.</p>
            <p>Особиста переписка не віддається стороннім сервісам, а кнопка `Log out` очищає збережений вхід саме на цьому пристрої.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-red-200 bg-red-50 shadow-[0_18px_45px_rgba(239,68,68,0.08)] dark:border-red-500/30 dark:bg-red-950/30">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">Вихід з акаунту</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">Кнопка винесена окремо внизу, щоб не губилася серед інших дій.</p>
          </div>
          <Button variant="destructive" className="w-full rounded-xl px-5 shadow-[0_12px_24px_rgba(239,68,68,0.18)] sm:w-auto" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />
            Вийти
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ToggleCard({ icon: Icon, title, description, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-start gap-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm transition hover:border-primary/25 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">{title}</p>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-300">{description}</p>
          </div>
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${checked ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>
            {checked ? 'Увімкнено' : 'Вимкнено'}
          </span>
        </div>
      </div>
      <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}
