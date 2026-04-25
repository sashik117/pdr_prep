// @ts-nocheck
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AtSign, BookMarked, CheckCheck, CheckCircle2, ChevronDown, ChevronUp, CircleAlert, Copy, Flame, LogOut, Mail, MessageCircleMore, PencilLine, Save, Settings, ShieldCheck, Sparkles, Star, Target, Users, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '@/lib/AuthContext';
import api, { tokenStore } from '@/api/apiClient';
import AvatarUpload from '@/components/profile/AvatarUpload';
import FramePicker from '@/components/profile/FramePicker';
import LoginPrompt from '@/components/auth/LoginPrompt';
import ActivityCalendar from '@/components/progress/ActivityCalendar';
import { TIER_COLORS, getUnlockedFrames } from '@/lib/achievements';
import AdminPanel from '@/pages/AdminPanel';

const profileLinks = [
  { to: '/study', label: 'Бібліотека', icon: BookMarked, badgeKey: null },
  { to: '/mistakes', label: 'Помилки', icon: CircleAlert, badgeKey: null },
  { to: '/friends', label: 'Друзі', icon: Users, badgeKey: 'friends' },
  { to: '/support', label: 'Підтримка', icon: MessageCircleMore, badgeKey: 'support' },
  { to: '/settings', label: 'Налаштування', icon: Settings, badgeKey: null },
  { to: '/privacy', label: 'Конфіденційність', icon: ShieldCheck, badgeKey: null },
];

const onboardingSections = [
  {
    title: 'Як проходити тести',
    text: 'Відкрийте розділ з тестами, оберіть формат і просто відповідайте на питання. За ідеальний результат без жодної помилки ви отримуєте зірку. Саме ці зірки потім можна витрачати на рамки профілю.',
  },
  {
    title: 'Як працюють батли',
    text: 'У батлах можна кликати друзів і змагатися на однаковому наборі питань. Перемагає той, хто відповість точніше, а якщо результат однаковий — вирішує час.',
  },
  {
    title: 'Що таке зірки і рамки',
    text: 'Зірки даються тільки за 100% правильні проходження тестів. Частина рамок відкривається за досягнення, а частину можна купити за зірки прямо в редагуванні профілю.',
  },
  {
    title: 'Навіщо потрібні помилки й аналітика',
    text: 'Розділ помилок збирає слабкі місця, щоб не ганяти все підряд. Аналітика показує динаміку балів, активність по місяцях і теми, які ще варто підтягнути.',
  },
  {
    title: 'Для чого друзі і підтримка',
    text: 'Через друзів зручно спілкуватися і ділитися результатами, а підтримка потрібна, якщо щось ламається або хочеться запропонувати нову ідею для сайту.',
  },
];

export default function Progress() {
  const { user, isLoadingAuth, login, logout } = useAuth();
  const queryClient = useQueryClient();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [name, setName] = useState(user?.name || '');
  const [surname, setSurname] = useState(user?.surname || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [activeFrame, setActiveFrame] = useState(user?.active_frame || 'default');
  const [emailVisible, setEmailVisible] = useState(Boolean(user?.email_visible ?? true));
  const [saving, setSaving] = useState(false);
  const [copyInfo, setCopyInfo] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [restoringStreak, setRestoringStreak] = useState(false);
  const [purchasingFrameId, setPurchasingFrameId] = useState(null);
  const [streakAnimating, setStreakAnimating] = useState(false);
  const previousStreakRef = useRef(/** @type {number | null} */ (null));

  const statsQuery = useQuery({
    queryKey: ['cabinet-stats'],
    queryFn: () => api.getStats(),
    enabled: !!user,
  });
  const notificationsQuery = useQuery({
    queryKey: ['notification-summary'],
    queryFn: () => api.getNotificationSummary(),
    enabled: !!user,
    staleTime: 20_000,
    refetchInterval: 20_000,
  });

  const stats = statsQuery.data;
  const profile = { ...(stats?.user || {}), ...(user || {}) };
  const notificationSummary = notificationsQuery.data || { friends: 0, support: 0, battles: 0 };
  const totalTests = stats?.total_tests || 0;
  const totalCorrect = stats?.total_correct || 0;
  const totalAnswers = stats?.total_answers || 0;
  const accuracy = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0;
  const streak = stats?.streak_days || profile?.streak_days || 0;
  const streakStatus = stats?.streak_status || profile?.streak_status || 'inactive';
  const streakRestoresLeft = stats?.streak_restores_left ?? profile?.streak_restores_left ?? 0;
  const totalStars = stats?.total_stars || 0;
  const availableStars = stats?.available_stars ?? totalStars;
  const passedTests = stats?.passed_tests || 0;
  const totalWrong = stats?.total_wrong ?? Math.max(0, totalAnswers - totalCorrect);
  const progressPercent = Math.min(100, Math.max(8, totalTests * 2 + Math.round(accuracy * 0.4)));
  const usernameChangeBlocked = Boolean(profile?.username_change_blocked);
  const usernameChangeAvailableAt = profile?.username_change_available_at ? new Date(profile.username_change_available_at) : null;
  const usernameHintText = usernameChangeBlocked && usernameChangeAvailableAt
    ? `Наступна зміна нікнейму буде доступна після ${usernameChangeAvailableAt.toLocaleDateString('uk-UA')} о ${usernameChangeAvailableAt.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}.`
    : 'Наступна зміна нікнейму буде доступна лише через 7 днів.';

  const weakTopics = useMemo(() => (
    (stats?.by_section || [])
      .map((topic) => ({
        id: String(topic.section || topic.section_name || 'topic'),
        name: topic.section_name || `Розділ ${topic.section || ''}`,
        total: topic.total || 0,
        accuracy: topic.total ? Math.round(((topic.correct || 0) / topic.total) * 100) : 0,
      }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5)
  ), [stats]);

  const achievements = useMemo(() => (
    (stats?.achievements || []).map((achievement) => ({
      id: achievement.achievement_id,
      name: achievement.achievement_name || achievement.achievement_id,
      description: achievement.achievement_desc || 'Досягнення відкрито',
      tier: achievement.tier || 1,
    }))
  ), [stats]);
  const totalAchievements = 20;
  const featuredAchievements = useMemo(() => {
    const selected = profile?.featured_achievements || [];
    if (!selected.length) return achievements.slice(0, 4);
    return selected.map((id) => achievements.find((achievement) => achievement.id === id)).filter(Boolean);
  }, [achievements, profile?.featured_achievements]);

  const unlockedFrames = useMemo(
    () => getUnlockedFrames((stats?.achievements || []).map((achievement) => achievement.achievement_id)),
    [stats],
  );

  const performanceChart = useMemo(() => (
    (stats?.recent_tests || [])
      .slice(0, 8)
      .reverse()
      .map((result, index) => ({
        name: `Спроба ${index + 1}`,
        score: result.total ? Math.round(((result.correct || 0) / result.total) * 100) : 0,
      }))
  ), [stats]);

  useEffect(() => {
    if (previousStreakRef.current === null) {
      previousStreakRef.current = streak;
      return undefined;
    }
    if (previousStreakRef.current !== streak) {
      previousStreakRef.current = streak;
      setStreakAnimating(true);
      const timeout = window.setTimeout(() => setStreakAnimating(false), 900);
      return () => window.clearTimeout(timeout);
    }
    previousStreakRef.current = streak;
    return undefined;
  }, [streak]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setProfileMessage('');
    try {
      const updated = await api.updateProfile({ name, surname, username, bio, active_frame: activeFrame, email_visible: emailVisible });
      login(apiToken(), updated, hasPersistentLogin());
      queryClient.setQueryData(['cabinet-stats'], (current) => current ? { ...current, user: { ...(current.user || {}), ...updated } } : current);
      setIsEditingProfile(false);
      setProfileMessage('Профіль оновлено');
      await queryClient.invalidateQueries({ queryKey: ['cabinet-stats'] });
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : 'Не вдалося зберегти профіль');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (updatedUser) => {
    if (!user) return;
    const nextUser = updatedUser ? { ...profile, ...updatedUser } : profile;
    login(apiToken(), nextUser, hasPersistentLogin());
    queryClient.setQueryData(['cabinet-stats'], (current) => current ? { ...current, user: { ...(current.user || {}), ...nextUser } } : current);
    await queryClient.invalidateQueries({ queryKey: ['cabinet-stats'] });
  };

  const handlePurchaseFrame = async (frameId) => {
    setPurchasingFrameId(frameId);
    setProfileMessage('');
    try {
      await api.purchaseFrame(frameId);
      setProfileMessage('Рамку відкрито. Тепер її можна одразу вибрати.');
      await queryClient.invalidateQueries({ queryKey: ['cabinet-stats'] });
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : 'Не вдалося купити рамку');
    } finally {
      setPurchasingFrameId(null);
    }
  };

  const startEdit = () => {
    setName(profile?.name || '');
    setSurname(profile?.surname || '');
    setUsername(profile?.username || '');
    setBio(profile?.bio || '');
    setActiveFrame(profile?.active_frame || 'default');
    setEmailVisible(Boolean(profile?.email_visible ?? true));
    setProfileMessage('');
    setIsEditingProfile(true);
  };

  const copyNickname = async () => {
    if (!profile?.username) return;
    await navigator.clipboard.writeText(`@${profile.username}`);
    setCopyInfo('Нікнейм скопійовано');
    setTimeout(() => setCopyInfo(''), 2000);
  };

  const handleRestoreStreak = async () => {
    setRestoringStreak(true);
    setProfileMessage('');
    try {
      await api.restoreStreak();
      setProfileMessage('Сірий вогник відновлено. Серія врятована.');
      await queryClient.invalidateQueries({ queryKey: ['cabinet-stats'] });
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : 'Не вдалося відновити серію');
    } finally {
      setRestoringStreak(false);
    }
  };

  if (isLoadingAuth || (!!user && statsQuery.isLoading)) {
    return <CenteredSpinner />;
  }

  if (!user) {
    return (
      <LoginPrompt
        title="Особистий кабінет"
        description="Увійдіть або створіть акаунт, щоб бачити статистику, прогрес, досягнення та керувати профілем."
      />
    );
  }

  if (profile?.is_admin) {
    return <AdminPanel />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Card className="overflow-hidden border-white/90 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(239,246,255,0.96))] shadow-[0_24px_60px_rgba(37,99,235,0.08)] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(2,6,23,0.96),rgba(15,23,42,0.98))]">
        <CardContent className="space-y-6 p-4 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
            <AvatarUpload avatarUrl={profile?.avatar_url} activeFrame={isEditingProfile ? activeFrame : (profile?.active_frame || 'default')} onAvatarChange={handleAvatarChange} editable={isEditingProfile} />

            <div className="min-w-0 flex-1">
              {!isEditingProfile ? (
                <>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <h2 className="text-2xl font-black tracking-[-0.04em] text-slate-950 dark:text-white sm:text-3xl">
                        {user.full_name || `${user.name || ''} ${user.surname || ''}`.trim() || 'Користувач'}
                      </h2>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-300">
                        <span className="inline-flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          {profile?.email_visible ? profile?.email : 'Пошта прихована'}
                        </span>
                        {user.username ? (
                          <button type="button" className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-primary" onClick={() => void copyNickname()}>
                            <AtSign className="h-4 w-4" />
                            {user.username}
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                      {copyInfo ? <p className="mt-2 text-xs font-semibold text-primary">{copyInfo}</p> : null}
                      {profileMessage ? <p className="mt-2 text-sm font-semibold text-primary">{profileMessage}</p> : null}

                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <StatusPill icon={Flame} value={streak} label="вогник" active={streakStatus === 'active'} animate={streakAnimating} palette="orange" />
                        <StatusPill icon={Star} value={totalStars} label="зірочки" active animate={false} palette="amber" filled />
                        {streakStatus === 'restorable' ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-full border-orange-200 bg-white px-4 py-2 font-semibold text-orange-600 shadow-sm hover:bg-orange-50 dark:border-orange-500/30 dark:bg-slate-900 dark:text-orange-300"
                            disabled={restoringStreak}
                            onClick={() => void handleRestoreStreak()}
                          >
                            <Sparkles className="mr-2 h-4 w-4" />
                            {restoringStreak ? 'Відновлення...' : `Відновити вогник (${streakRestoresLeft})`}
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <Button className="w-full rounded-xl border border-primary/20 bg-primary shadow-[0_14px_28px_rgba(20,107,255,0.18)] sm:w-auto" onClick={startEdit}>
                      <PencilLine className="mr-2 h-4 w-4" />
                      Змінити профіль
                    </Button>
                  </div>

                  <div className="mt-5 rounded-[24px] border border-sky-100 bg-white/80 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900/80">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-600 dark:text-sky-300">Про себе</p>
                    <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{user.bio?.trim() || 'Тут можна коротко написати про себе або просто залишити профіль чистим і лаконічним.'}</p>
                  </div>

                  <div className="mt-5 rounded-[24px] border border-slate-100 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-900 dark:text-white">Досягнення</p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                          Досягнення: {achievements.length}/{totalAchievements}
                        </p>
                      </div>
                      <Button asChild variant="outline" className="rounded-xl dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                        <Link to="/achievements">Переглянути всі</Link>
                      </Button>
                    </div>
                    {featuredAchievements.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {featuredAchievements.map((achievement) => (
                          <AchievementBadge key={achievement.id} achievement={achievement} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-slate-300">Перші нагороди з’являються після тестів, серії активності та хороших результатів.</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-2xl font-black tracking-[-0.03em] text-slate-950 dark:text-white">Редагування профілю</h2>
                    <Button variant="outline" className="w-full rounded-xl border-slate-300 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 sm:w-auto" onClick={() => setIsEditingProfile(false)}>
                      Скасувати
                    </Button>
                  </div>
                  <Field label="Ім'я" value={name} onChange={setName} />
                  <Field label="Прізвище" value={surname} onChange={setSurname} />
                  <Field label="Username" value={username} onChange={(value) => setUsername(value.replace(/\s+/g, ''))} />
                  {usernameChangeBlocked ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200">
                      <p className="font-bold">Зміна нікнейму</p>
                      <p>{usernameHintText}</p>
                    </div>
                  ) : null}
                  <Field label="Пошта" value={user.email || ''} readOnly className="bg-slate-50 dark:bg-slate-900" />
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    <input type="checkbox" checked={emailVisible} onChange={(event) => setEmailVisible(event.target.checked)} />
                    Показувати пошту в профілі
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-200">Коротко про себе</span>
                    <Textarea value={bio} onChange={(event) => setBio(event.target.value)} rows={4} />
                  </label>
                  <FramePicker
                    unlockedFrames={unlockedFrames}
                    activeFrame={activeFrame}
                    onSelect={setActiveFrame}
                    shopItems={stats?.frame_shop || []}
                    availableStars={availableStars}
                    onPurchase={(frameId) => void handlePurchaseFrame(frameId)}
                    purchasingFrameId={purchasingFrameId}
                  />
                  {profileMessage ? <p className="text-sm font-semibold text-primary">{profileMessage}</p> : null}
                  <Button className="w-full rounded-xl border border-primary/20 px-5 shadow-[0_14px_28px_rgba(20,107,255,0.18)] sm:w-auto" disabled={saving} onClick={() => void handleSave()}>
                    {saving ? <Save className="mr-2 h-4 w-4" /> : <PencilLine className="mr-2 h-4 w-4" />}
                    Зберегти зміни
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 lg:grid lg:gap-4 lg:grid-cols-[1.15fr_repeat(4,minmax(0,1fr))] lg:space-y-0">
            <div className="rounded-[24px] border border-sky-100 bg-[linear-gradient(135deg,rgba(20,107,255,0.08),rgba(255,255,255,0.98)_42%,rgba(236,253,245,0.9))] p-4 shadow-[0_16px_40px_rgba(37,99,235,0.08)] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(30,64,175,0.22),rgba(2,6,23,0.96)_48%,rgba(6,78,59,0.4))]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-black text-slate-900 dark:text-white">Коротко про статистику</p>
                <span className="rounded-full border border-primary/15 bg-white/80 px-3 py-1 text-sm font-bold text-primary dark:bg-slate-900/80">{progressPercent}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/80 dark:bg-slate-950/80">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#2563eb_0%,#38bdf8_42%,#22c55e_100%)] shadow-[0_8px_18px_rgba(37,99,235,0.24)] transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:contents">
              <MetricCard icon={CheckCheck} label="Складено іспитів" value={String(passedTests)} accent="blue" />
              <MetricCard icon={Target} label="Точність" value={`${accuracy}%`} accent="amber" />
              <MetricCard icon={CheckCircle2} label="Правильних" value={String(totalCorrect)} accent="green" />
              <MetricCard icon={XCircle} label="Помилки" value={String(totalWrong)} accent="red" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="overflow-hidden border-white/90 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950/92">
          <CardHeader>
            <CardTitle className="dark:text-white">Меню профілю</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {profileLinks.map(({ to, label, icon: Icon, badgeKey }) => (
              <Link
                key={to}
                to={to}
                className="relative inline-flex min-h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-sky-200 hover:bg-sky-50 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-sky-500/40 dark:hover:bg-slate-800"
              >
                <Icon className="h-4 w-4 text-primary" />
                {label}
                {badgeKey && notificationSummary[badgeKey] > 0 ? (
                  <span className="absolute right-3 top-3 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-black text-white">
                    {Math.min(notificationSummary[badgeKey], 9)}
                  </span>
                ) : null}
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-white/90 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950/92">
          <CardHeader>
            <CardTitle className="dark:text-white">Активність по місяцях</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityCalendar dates={stats?.activity_days || []} startDate={profile?.created_at || user?.created_at || null} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <Card className="overflow-hidden border-white/90 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950/92">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="dark:text-white">Слабкі теми</CardTitle>
            <Button asChild variant="ghost" className="h-auto rounded-xl border border-primary/10 bg-primary/5 px-3 py-2 text-primary shadow-sm hover:bg-primary/10">
              <Link to="/tests">Потренувати</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {weakTopics.length > 0 ? weakTopics.map((topic) => (
              <div key={topic.id}>
                <div className="mb-1 flex items-center justify-between gap-4">
                  <span className="truncate text-sm font-semibold text-slate-700 dark:text-slate-100">{topic.name}</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{topic.accuracy}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-2 rounded-full bg-[linear-gradient(90deg,#fb7185_0%,#f59e0b_48%,#38bdf8_100%)]" style={{ width: `${topic.accuracy}%` }} />
                </div>
              </div>
            )) : <EmptyState text="Після кількох тестів тут покажуться теми, які варто підтягнути." />}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-white/90 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950/92">
          <CardHeader>
            <CardTitle className="dark:text-white">Динаміка результатів</CardTitle>
          </CardHeader>
          <CardContent>
            {performanceChart.length > 1 ? (
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performanceChart} margin={{ top: 12, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.42} />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.08} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} stroke="#94a3b8" />
                    <YAxis tickLine={false} axisLine={false} domain={[0, 100]} fontSize={12} stroke="#94a3b8" />
                    <Tooltip />
                    <Area type="monotone" dataKey="score" stroke="#60a5fa" strokeWidth={3} fill="url(#scoreFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState text="Пройдіть кілька тестів, і тут з’явиться плавний графік вашої динаміки." />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-white/90 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(239,246,255,0.96))] shadow-[0_18px_45px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(2,6,23,0.96),rgba(15,23,42,0.98))]">
        <CardHeader>
          <CardTitle className="dark:text-white">Довідник по сайту</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border-slate-300 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            onClick={() => setShowOnboarding((value) => !value)}
          >
            {showOnboarding ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
            {showOnboarding ? 'Сховати гайд' : 'Показати гайд'}
          </Button>

          {showOnboarding ? (
            <div className="grid gap-4 md:grid-cols-2">
              {onboardingSections.map((section) => (
                <div key={section.title} className="rounded-[22px] border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                  <p className="font-black text-slate-900 dark:text-white">{section.title}</p>
                  <p className="mt-2">{section.text}</p>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-red-200 bg-red-50 shadow-[0_18px_45px_rgba(239,68,68,0.08)] dark:border-red-500/20 dark:bg-red-950/25">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">Вихід з акаунту</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">Кнопка `Log out` завершує сесію та очищає збережені дані входу на цьому пристрої.</p>
          </div>
          <Button variant="destructive" className="w-full rounded-xl px-5 shadow-[0_12px_24px_rgba(239,68,68,0.18)] sm:w-auto" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function apiToken() {
  return tokenStore.get() || '';
}

function hasPersistentLogin() {
  return Boolean(localStorage.getItem('pdr_token'));
}

function Field(props) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold text-slate-600 dark:text-slate-200">{props.label}</span>
      <Input {...props} />
    </label>
  );
}

function StatusPill({ icon: Icon, value, label, active, animate, palette, filled = false }) {
  const paletteMap = {
    orange: active ? 'border-orange-200 bg-orange-50 text-orange-600 dark:border-orange-500/30 dark:bg-orange-950/35 dark:text-orange-300' : 'border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
    amber: 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/30 dark:bg-amber-950/35 dark:text-amber-300',
  };
  return (
    <div className={`inline-flex items-center gap-3 rounded-full border px-4 py-2 ${paletteMap[palette] || paletteMap.orange}`}>
      <Icon className={`h-5 w-5 transition-all duration-500 ${filled ? 'fill-amber-400 text-amber-500' : active ? 'fill-orange-500 text-orange-500' : 'text-slate-400'} ${animate ? 'scale-125 drop-shadow-[0_0_14px_rgba(249,115,22,0.55)] animate-pulse' : ''}`} />
      <span className={`text-base font-black transition-all duration-500 ${animate ? 'translate-y-[-2px] scale-110 text-orange-600' : ''}`}>{value}</span>
      <span className="text-sm font-semibold">{label}</span>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, accent = 'blue', filledIcon = false }) {
  const accentMap = {
    blue: {
      card: 'border-sky-100 bg-[linear-gradient(135deg,rgba(14,165,233,0.12),rgba(255,255,255,0.98)_52%,rgba(219,234,254,0.92))] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(14,165,233,0.16),rgba(15,23,42,0.98)_52%,rgba(30,41,59,0.96))]',
      icon: 'from-sky-500 to-blue-600',
      glow: 'shadow-[0_12px_28px_rgba(14,165,233,0.18)]',
    },
    orange: {
      card: 'border-orange-100 bg-[linear-gradient(135deg,rgba(251,146,60,0.14),rgba(255,255,255,0.98)_52%,rgba(255,237,213,0.92))] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(249,115,22,0.18),rgba(15,23,42,0.98)_52%,rgba(30,41,59,0.96))]',
      icon: 'from-amber-400 to-orange-500',
      glow: 'shadow-[0_12px_28px_rgba(249,115,22,0.18)]',
    },
    green: {
      card: 'border-emerald-100 bg-[linear-gradient(135deg,rgba(34,197,94,0.14),rgba(255,255,255,0.98)_52%,rgba(209,250,229,0.92))] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(34,197,94,0.18),rgba(15,23,42,0.98)_52%,rgba(30,41,59,0.96))]',
      icon: 'from-emerald-500 to-teal-500',
      glow: 'shadow-[0_12px_28px_rgba(16,185,129,0.18)]',
    },
    amber: {
      card: 'border-amber-100 bg-[linear-gradient(135deg,rgba(251,191,36,0.16),rgba(255,255,255,0.98)_52%,rgba(254,243,199,0.92))] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(245,158,11,0.2),rgba(15,23,42,0.98)_52%,rgba(30,41,59,0.96))]',
      icon: 'from-amber-400 to-yellow-500',
      glow: 'shadow-[0_12px_28px_rgba(245,158,11,0.22)]',
    },
    red: {
      card: 'border-rose-100 bg-[linear-gradient(135deg,rgba(244,63,94,0.14),rgba(255,255,255,0.98)_52%,rgba(255,228,230,0.92))] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(244,63,94,0.18),rgba(15,23,42,0.98)_52%,rgba(30,41,59,0.96))]',
      icon: 'from-rose-500 to-orange-500',
      glow: 'shadow-[0_12px_28px_rgba(244,63,94,0.16)]',
    },
  };
  const palette = accentMap[accent] || accentMap.blue;

  return (
    <div className={`rounded-[22px] border p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] ${palette.card}`}>
      <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white ${palette.icon} ${palette.glow}`}>
        <Icon className={`h-5 w-5 ${filledIcon ? 'fill-current' : ''}`} />
      </div>
      <p className="text-2xl font-black tracking-[-0.03em] text-slate-900 dark:text-white">{value}</p>
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{label}</p>
    </div>
  );
}

function AchievementBadge({ achievement }) {
  const tierStyle = TIER_COLORS[achievement.tier] || TIER_COLORS[1];
  return (
    <div className={`rounded-full border px-3 py-1.5 text-xs font-bold ${tierStyle.bg} ${tierStyle.text} ${tierStyle.border}`} title={achievement.description}>
      {achievement.name}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
      {text}
    </div>
  );
}

function CenteredSpinner() {
  return (
    <div className="flex justify-center py-24">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
    </div>
  );
}
