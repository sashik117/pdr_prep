// @ts-nocheck
import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, AtSign, BarChart3, CheckCheck, CheckCircle2, Crown, Flame, Mail, Swords, Trophy, User2, XCircle } from 'lucide-react';
import api from '@/api/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ACHIEVEMENTS_DEF, TIER_COLORS } from '@/lib/achievements';
import { cn } from '@/lib/utils';

export default function UserProfile() {
  const params = useParams();
  const navigate = useNavigate();
  const profileQuery = useQuery({
    queryKey: ['guest-profile', params.userId, params.username],
    queryFn: () => (params.username ? api.getUserProfileByUsername(params.username) : api.getUserProfile(params.userId)),
    enabled: !!params.userId || !!params.username,
  });

  const profile = profileQuery.data;
  const leaderboardQuery = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => api.getLeaderboard(),
    staleTime: 120000,
  });
  const achievementLookup = useMemo(() => {
    const map = new Map();
    ACHIEVEMENTS_DEF.forEach((item) => map.set(item.id, item));
    return map;
  }, []);

  const achievements = useMemo(
    () => ((profile?.achievements || []).map((achievement) => {
      const fallback = achievementLookup.get(achievement.achievement_id);
      return {
        id: achievement.achievement_id,
        name: achievement.achievement_name || fallback?.name || achievement.achievement_id,
        description: achievement.achievement_desc || fallback?.desc || 'Досягнення відкрито',
        tier: fallback?.tier || 1,
      };
    }).slice(0, 8)),
    [achievementLookup, profile],
  );

  const showcasedAchievements = useMemo(() => {
    const selected = profile?.featured_achievements || [];
    if (!selected.length) return achievements.slice(0, 4);
    return selected.map((id) => achievements.find((achievement) => achievement.id === id)).filter(Boolean);
  }, [achievements, profile?.featured_achievements]);

  const accuracy = profile?.total_answers > 0 ? Math.round((profile.total_correct / profile.total_answers) * 100) : 0;
  const passedTests = profile?.passed_tests || 0;
  const totalWrong = profile?.total_wrong ?? Math.max(0, (profile?.total_answers || 0) - (profile?.total_correct || 0));
  const progressPercent = Math.min(100, Math.max(8, (profile?.total_tests || 0) * 2 + Math.round(accuracy * 0.4)));
  const battleWins = Number(profile?.battle_wins || 0);
  const battleFinished = Number(profile?.battle_finished || 0);

  const communityRanks = useMemo(() => {
    if (!profile) return [];
    const rows = leaderboardQuery.data || [];
    const isCurrentProfile = (row) => {
      if (profile.id && row.id) return Number(row.id) === Number(profile.id);
      if (profile.username && row.username) return String(row.username).toLowerCase() === String(profile.username).toLowerCase();
      if (profile.email && row.email) return String(row.email).toLowerCase() === String(profile.email).toLowerCase();
      return false;
    };
    const rankBy = (sorter, filter = () => true) => {
      const sorted = rows.filter(filter).sort(sorter);
      const index = sorted.findIndex(isCurrentProfile);
      return index >= 0 ? index + 1 : null;
    };
    const rankText = (rank) => {
      if (leaderboardQuery.isLoading) return '...';
      return rank ? `#${rank}` : 'поки без місця';
    };

    return [
      {
        icon: Trophy,
        label: 'Загальний рейтинг',
        value: rankText(rankBy((a, b) => (b.total_correct || 0) - (a.total_correct || 0) || (b.total_tests || 0) - (a.total_tests || 0))),
        hint: `${profile.total_correct || 0} правильних відповідей`,
        accent: 'blue',
      },
      {
        icon: CheckCheck,
        label: 'Складені іспити',
        value: rankText(rankBy((a, b) => (b.passed_tests || 0) - (a.passed_tests || 0) || (b.total_correct || 0) - (a.total_correct || 0))),
        hint: `${passedTests} успішних спроб`,
        accent: 'green',
      },
      {
        icon: Flame,
        label: 'Марафон',
        value: rankText(rankBy((a, b) => (b.marathon_best || 0) - (a.marathon_best || 0) || (b.passed_tests || 0) - (a.passed_tests || 0), (row) => (row.marathon_best || 0) > 0)),
        hint: `найкращий результат: ${profile.marathon_best || 0}`,
        accent: 'amber',
      },
      {
        icon: Swords,
        label: 'Батли',
        value: rankText(rankBy((a, b) => (b.battle_wins || 0) - (a.battle_wins || 0) || (b.battle_finished || 0) - (a.battle_finished || 0), (row) => (row.battle_finished || 0) > 0)),
        hint: `${battleWins} перемог із ${battleFinished} батлів`,
        accent: 'red',
      },
    ];
  }, [battleFinished, battleWins, leaderboardQuery.data, leaderboardQuery.isLoading, passedTests, profile]);

  if (profileQuery.isLoading) {
    return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" /></div>;
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Button type="button" variant="ghost" className="-ml-2 rounded-full px-3" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Назад
        </Button>
        <Card className="border-white/80 dark:border-slate-800 dark:bg-slate-950/92">
          <CardContent className="p-8 text-center text-slate-500 dark:text-slate-300">Профіль не знайдено.</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button
        type="button"
        variant="ghost"
        className="-ml-2 rounded-full px-3 text-slate-600 hover:text-slate-950 dark:text-slate-200 dark:hover:text-white"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Назад
      </Button>

      <Card className="overflow-hidden border-white/90 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(239,246,255,0.96))] shadow-[0_18px_45px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(8,47,73,0.9)_52%,rgba(15,23,42,0.98))]">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <ProfileAvatar profile={profile} />

            <div className="min-w-0 flex-1">
              <h2 className="inline-flex min-w-0 items-start gap-1.5 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white sm:text-3xl">
                <span className="min-w-0 truncate">{profile.full_name || `${profile.name || ''} ${profile.surname || ''}`.trim()}</span>
                {profile.is_premium ? <Crown className="mt-0.5 h-4 w-4 shrink-0 text-amber-500 sm:h-5 sm:w-5" /> : null}
              </h2>
              {profile.username ? (
                <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-sm font-semibold text-primary">
                  <AtSign className="h-4 w-4" />
                  {profile.username}
                </p>
              ) : null}
              {profile.email ? (
                <p className="mt-3 inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
                  <Mail className="h-4 w-4" />
                  {profile.email}
                </p>
              ) : null}
              <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">{profile.bio?.trim() || 'Користувач поки що не додав опис.'}</p>

              <div className="surface-glass mt-5 rounded-[24px] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Прогрес</p>
                  <span className="text-sm font-bold text-primary">{progressPercent}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,#1d4ed8_0%,#38bdf8_55%,#22c55e_100%)]" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>

              <div className="mt-5 rounded-[24px] border border-slate-100 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900/80">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Досягнення</p>
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{showcasedAchievements.length} на вітрині</span>
                </div>
                {showcasedAchievements.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {showcasedAchievements.map((achievement) => (
                      <AchievementBadge key={achievement.id} achievement={achievement} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-300">Нагороди ще не відкриті.</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={CheckCheck} label="Складено" value={String(passedTests)} accent="blue" />
        <StatCard icon={BarChart3} label="Точність" value={`${accuracy}%`} accent="amber" />
        <StatCard icon={CheckCircle2} label="Правильно" value={String(profile.total_correct || 0)} accent="green" />
        <StatCard icon={XCircle} label="Помилки" value={String(totalWrong)} accent="red" />
      </div>

      <Card className="border-white/85 shadow-[0_18px_45px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950/92">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="dark:text-white">Позиція в спільноті</CardTitle>
          <Button asChild variant="outline" className="rounded-xl border-slate-300 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <Link to="/leaderboard">До рейтингу</Link>
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {communityRanks.map((item) => (
            <CommunityRankCard key={item.label} {...item} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function CommunityRankCard({ icon: Icon, label, value, hint, accent = 'blue' }) {
  const accentMap = {
    blue: 'bg-sky-50 text-sky-700 dark:bg-sky-950/35 dark:text-sky-200',
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-200',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/35 dark:text-amber-200',
    red: 'bg-rose-50 text-rose-700 dark:bg-rose-950/35 dark:text-rose-200',
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${accentMap[accent] || accentMap.blue}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">{value}</p>
      <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-300">{hint}</p>
    </div>
  );
}

function ProfileAvatar({ profile }) {
  const frameClass = cn(
    'h-28 w-28 rounded-[28px] p-[3px] shadow-[0_12px_28px_rgba(15,23,42,0.08)]',
    profile?.active_frame === 'fire' && 'bg-[linear-gradient(135deg,#fb7185,#f97316)]',
    profile?.active_frame === 'sun' && 'bg-[linear-gradient(135deg,#facc15,#fb7185)]',
    profile?.active_frame === 'gold' && 'bg-[linear-gradient(135deg,#f59e0b,#fde68a)]',
    profile?.active_frame === 'diamond' && 'bg-[linear-gradient(135deg,#38bdf8,#22d3ee)]',
    profile?.active_frame === 'speed' && 'bg-[linear-gradient(135deg,#60a5fa,#2563eb)]',
    profile?.active_frame === 'crown' && 'bg-[linear-gradient(135deg,#fbbf24,#f59e0b)]',
    profile?.active_frame === 'galaxy' && 'bg-[linear-gradient(135deg,#312e81,#7c3aed,#ec4899)]',
    profile?.active_frame === 'platinum' && 'bg-[linear-gradient(135deg,#cbd5e1,#94a3b8)]',
    profile?.active_frame === 'mint' && 'bg-[linear-gradient(135deg,#34d399,#10b981)]',
    profile?.active_frame === 'sunset' && 'bg-[linear-gradient(135deg,#fb7185,#f59e0b)]',
    profile?.active_frame === 'neon' && 'bg-[linear-gradient(135deg,#d946ef,#8b5cf6)]',
    profile?.active_frame === 'aurora' && 'bg-[linear-gradient(135deg,#22d3ee,#34d399)]',
    (!profile?.active_frame || profile?.active_frame === 'default') && 'bg-[linear-gradient(135deg,#dbeafe,#93c5fd)]',
  );

  return (
    <div className={frameClass}>
      <div className="h-full w-full overflow-hidden rounded-[24px] bg-slate-100 dark:bg-slate-800">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt={profile.full_name || profile.name} width={192} height={192} decoding="async" className="h-full w-full object-cover [backface-visibility:hidden]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-400"><User2 className="h-12 w-12" /></div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent = 'blue' }) {
  const accentMap = {
    blue: 'bg-sky-100 text-sky-700 dark:bg-sky-950/30 dark:text-sky-200',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-200',
    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200',
    red: 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-200',
  };

  return (
    <Card className="border-white/85 shadow-[0_18px_45px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950/92">
      <CardContent className="p-5">
        <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${accentMap[accent] || accentMap.blue}`}>
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-2xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-white">{value}</p>
        <p className="text-sm text-slate-500 dark:text-slate-300">{label}</p>
      </CardContent>
    </Card>
  );
}

function AchievementBadge({ achievement }) {
  const tierStyle = TIER_COLORS[achievement.tier] || TIER_COLORS[1];
  return (
    <div
      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold shadow-sm ${tierStyle.bg} ${tierStyle.text} ${tierStyle.border}`}
      title={achievement.description}
    >
      {achievement.name}
    </div>
  );
}
