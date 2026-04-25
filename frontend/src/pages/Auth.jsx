// @ts-nocheck
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AtSign, CopyCheck, Eye, EyeOff, Lock, LogIn, Mail, User, UserPlus } from 'lucide-react';
import api from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';

/**
 * @typedef {'login' | 'register' | 'verify' | 'forgot' | 'reset'} AuthView
 */

const usernameHint = 'Тільки латиниця, цифри та _';

function looksLikeEmail(value) {
  return /@/.test(String(value || '').trim());
}

function isEmailVerificationError(error) {
  const message = (error instanceof Error ? error.message : String(error || '')).toLowerCase();
  return message.includes('підтвердіть email');
}

function normalizeAuthError(error, context = 'generic') {
  const message = (error instanceof Error ? error.message : String(error || '')).toLowerCase();

  if (message.includes('цей нікнейм вже зайнятий')) return 'Цей нікнейм вже зайнятий';
  if (message.includes('ця пошта вже зареєстрована')) return 'Ця пошта вже зареєстрована';
  if (message.includes('username уже зайнятий')) return 'Цей нікнейм вже зайнятий';
  if (message.includes('email уже зареєстровано')) return 'Ця пошта вже зареєстрована';
  if (message.includes('такого e-mail не існує')) return 'Такого E-mail не існує';
  if (message.includes('такого нікнейму не існує')) return 'Такого нікнейму не існує';
  if (message.includes('невірний пароль')) return 'Невірний пароль';
  if (message.includes('невірний email або пароль')) {
    return looksLikeEmail(context) ? 'Невірний пароль або такої пошти не існує' : 'Невірний пароль або такого нікнейму не існує';
  }
  if (message.includes('невірний код')) return 'Невірний код підтвердження';
  if (message.includes('код застарів')) return 'Код вже застарів, запросіть новий';
  if (message.includes('невалідний email')) return 'Вкажіть коректну пошту';
  if (message.includes('підтвердьте email')) return 'Спочатку підтвердіть пошту';
  if (message.includes('пароль має містити')) return 'Пароль має містити щонайменше 6 символів';
  if (message.includes("вкажіть ім'я")) return "Вкажіть ім'я";
  if (message.includes('вкажіть прізвище')) return 'Вкажіть прізвище';
  if (message.includes('username має містити')) return 'Нікнейм має бути латиницею, можна цифри та _';
  if (message.includes('користувача не знайдено')) return 'Такого користувача не існує';
  if (message.includes('failed to fetch') || message.includes('підключитися до сервер')) return 'Не вдалося підключитися до сервера';

  return 'Не вдалося виконати дію. Спробуйте ще раз.';
}

export default function Auth() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialTab = params.get('tab') === 'register' ? 'register' : 'login';
  const redirectTo = params.get('redirect') || '/cabinet';

  const [view, setView] = useState(/** @type {AuthView} */ (initialTab));
  const [tab, setTab] = useState(/** @type {'login' | 'register'} */ (initialTab));
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [username, setUsername] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  if (isAuthenticated) {
    navigate(redirectTo, { replace: true });
    return null;
  }

  const clearStatus = () => {
    setError('');
    setInfo('');
  };

  const setMessageFromError = (value, context) => {
    setError(normalizeAuthError(value, context));
  };

  const switchTab = (nextTab) => {
    clearStatus();
    if (nextTab === 'register' && looksLikeEmail(identifier) && !email) {
      setEmail(identifier.trim());
    }
    if (nextTab === 'login' && email && !identifier) {
      setIdentifier(email.trim());
    }
    setTab(nextTab);
    setView(nextTab);
  };

  const openForgot = () => {
    clearStatus();
    if (looksLikeEmail(identifier) && !email) {
      setEmail(identifier.trim());
    }
    setView('forgot');
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    clearStatus();
    setLoading(true);
    try {
      const response = await api.login(identifier, password, rememberMe);
      login(response.token, response.user, rememberMe);
      navigate(redirectTo, { replace: true });
    } catch (value) {
      if (value?.status === 403 && looksLikeEmail(identifier) && isEmailVerificationError(value)) {
        if (looksLikeEmail(identifier) && !email) setEmail(identifier.trim());
        setView('verify');
        setInfo('Пошта ще не підтверджена. Введіть код із листа або надішліть новий.');
      } else {
        setMessageFromError(value, identifier);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    clearStatus();
    if (password.length < 6) {
      setError('Пароль має містити щонайменше 6 символів');
      return;
    }
    if (!name.trim()) {
      setError("Вкажіть ім'я");
      return;
    }
    if (!surname.trim()) {
      setError('Вкажіть прізвище');
      return;
    }
    if (!normalizedUsername) {
      setError('Нікнейм має бути латиницею, можна цифри та _');
      return;
    }
    setLoading(true);
    try {
      const response = await api.register({
        name: name.trim(),
        surname: surname.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
      });
      setIdentifier(email.trim());
      setInfo(`Код підтвердження надіслано на ${email}.${response?.dev_code ? ` dev: ${response.dev_code}` : ''}`);
      setView('verify');
    } catch (value) {
      setMessageFromError(value, email);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    clearStatus();
    setLoading(true);
    try {
      const response = await api.verifyEmail(email, code);
      login(response.token, response.user);
      navigate(redirectTo, { replace: true });
    } catch (value) {
      setMessageFromError(value, email);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (event) => {
    event.preventDefault();
    clearStatus();
    setLoading(true);
    try {
      const response = await api.forgotPassword(email);
      setInfo(response?.message || 'Якщо така пошта існує, код уже надіслано.');
      setView('reset');
    } catch (value) {
      setMessageFromError(value, email);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (event) => {
    event.preventDefault();
    clearStatus();
    setLoading(true);
    try {
      await api.resetPassword(email, code, newPassword);
      setInfo('Пароль змінено. Тепер можна увійти.');
      setView('login');
      setTab('login');
      setIdentifier(email.trim());
      setPassword('');
      setNewPassword('');
      setCode('');
    } catch (value) {
      setMessageFromError(value, email);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    clearStatus();
    setLoading(true);
    try {
      const response = await api.resendVerification(email);
      setInfo(response?.message || 'Новий код надіслано.');
    } catch (value) {
      setMessageFromError(value, email);
    } finally {
      setLoading(false);
    }
  };

  const normalizedUsername = username.trim().replace(/^@/, '');
  const titleMap = {
    login: 'Вхід',
    register: 'Реєстрація',
    verify: 'Підтвердження пошти',
    forgot: 'Відновлення доступу',
    reset: 'Новий пароль',
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#f8fbff_0%,_#eef4ff_100%)] px-4 py-10">
      <div className="mx-auto max-w-md">
        <button
          type="button"
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="h-4 w-4" />
          На головну
        </button>

        <div className="mb-8 text-center">
          <img src="/logo-wordmark.png" alt="PDRPrep" className="mx-auto h-12 w-auto object-contain" />
          <h1 className="mt-4 text-2xl font-black tracking-[-0.03em] text-slate-950">{titleMap[view]}</h1>
        </div>

        <div className="overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.08)]">
          {(view === 'login' || view === 'register') && (
            <div className="grid grid-cols-2 border-b border-slate-100">
              {[
                ['login', 'Увійти'],
                ['register', 'Реєстрація'],
              ].map(([next, label]) => (
                <button
                  key={next}
                  type="button"
                  className={`px-4 py-4 text-sm font-bold transition-colors ${tab === next ? 'bg-primary text-primary-foreground' : 'text-slate-600'}`}
                  onClick={() => switchTab(next)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-4 p-6 sm:p-7">
            {info && <Info text={info} />}
            {error && <Error text={error} />}

            {view === 'login' && (
              <form className="space-y-4" onSubmit={(event) => void handleLogin(event)}>
                <Field icon={Mail} label="Пошта або нікнейм" value={identifier} onChange={setIdentifier} />
                <PasswordField label="Пароль" value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword((value) => !value)} />
                <label className="flex items-center gap-2 text-sm text-slate-500">
                  <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
                  Запам'ятати мене
                </label>
                <Button type="submit" className="h-11 w-full rounded-full" disabled={loading}>
                  <LogIn className="mr-2 h-4 w-4" />
                  {loading ? 'Вхід...' : 'Увійти'}
                </Button>
                <button type="button" className="w-full text-sm font-semibold text-primary" onClick={openForgot}>
                  Забули пароль?
                </button>
              </form>
            )}

            {view === 'register' && (
              <form className="space-y-4" onSubmit={(event) => void handleRegister(event)}>
                <Field icon={User} label="Ім'я" value={name} onChange={setName} />
                <Field icon={User} label="Прізвище" value={surname} onChange={setSurname} />
                <Field icon={AtSign} label="Нікнейм" value={username} onChange={(value) => setUsername(value.replace(/\s+/g, ''))} />
                <p className="-mt-2 text-xs text-slate-400">{usernameHint}</p>
                {normalizedUsername ? (
                  <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-primary">
                    Ваш нік: @{normalizedUsername}
                  </div>
                ) : null}
                <Field icon={Mail} label="Пошта" type="email" value={email} onChange={setEmail} />
                <PasswordField label="Пароль" value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword((value) => !value)} />
                <Button type="submit" className="h-11 w-full rounded-full" disabled={loading}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  {loading ? 'Створення...' : 'Створити акаунт'}
                </Button>
              </form>
            )}

            {view === 'verify' && (
              <form className="space-y-4" onSubmit={(event) => void handleVerify(event)}>
                <Field icon={Mail} label="Пошта" type="email" value={email} onChange={setEmail} />
                <Field label="Код із листа" value={code} onChange={setCode} />
                <Button type="submit" className="h-11 w-full rounded-full" disabled={loading}>
                  {loading ? 'Перевірка...' : 'Підтвердити'}
                </Button>
                <Button type="button" variant="outline" className="h-11 w-full rounded-full" disabled={loading} onClick={() => void handleResend()}>
                  Надіслати код ще раз
                </Button>
              </form>
            )}

            {view === 'forgot' && (
              <form className="space-y-4" onSubmit={(event) => void handleForgot(event)}>
                <Field icon={Mail} label="Пошта" type="email" value={email} onChange={setEmail} />
                <Button type="submit" className="h-11 w-full rounded-full" disabled={loading}>
                  {loading ? 'Надсилання...' : 'Надіслати код'}
                </Button>
              </form>
            )}

            {view === 'reset' && (
              <form className="space-y-4" onSubmit={(event) => void handleReset(event)}>
                <Field icon={Mail} label="Пошта" type="email" value={email} onChange={setEmail} />
                <Field label="Код із листа" value={code} onChange={setCode} />
                <PasswordField label="Новий пароль" value={newPassword} onChange={setNewPassword} show={showPassword} onToggle={() => setShowPassword((value) => !value)} />
                <Button type="submit" className="h-11 w-full rounded-full" disabled={loading}>
                  {loading ? 'Оновлення...' : 'Оновити пароль'}
                </Button>
              </form>
            )}

            {view !== tab && (
              <button
                type="button"
                className="mx-auto block text-sm font-semibold text-slate-500"
                onClick={() => {
                  clearStatus();
                  setView(tab);
                }}
              >
                Назад
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-[28px] border border-white/70 bg-white/80 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <CopyCheck className="h-4 w-4 text-primary" />
            Нікнейм буде вашим публічним @іменем
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500">Його можна буде копіювати в профілі для друзів, чатів і батлів.</p>
        </div>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, onChange, ...props }) {
  let placeholder = props.placeholder;
  if (!placeholder && props.type === 'email') placeholder = 'johndoe@example.com';
  if (!placeholder && Icon === AtSign) placeholder = 'Тільки англійська, мінімум 3 символи';
  if (!placeholder && Icon === Mail && props.type !== 'email') placeholder = 'johndoe@example.com або @johndoe';
  if (!placeholder && Icon === User) placeholder = label === "Ім'я" ? 'Іван' : label === 'Прізвище' ? 'Петренко' : '';
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-600">{label}</span>
      <div className="relative">
        {Icon ? <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /> : null}
        <input
          {...props}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={`h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-primary focus:bg-white ${Icon ? 'pl-10' : ''}`}
        />
      </div>
    </label>
  );
}

function PasswordField({ label, value, onChange, show, onToggle, placeholder = 'Мінімум 6 символів' }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-600">{label}</span>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm outline-none transition focus:border-primary focus:bg-white"
        />
        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" onClick={onToggle}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );
}

function Info({ text }) {
  return <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">{text}</div>;
}

function Error({ text }) {
  return <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{text}</div>;
}
