// @ts-nocheck
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BookOpenText, Crown, FileQuestion, MessageCircleMore, ShieldCheck, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import api from '@/api/apiClient';
import { AdminPageHeader, LoadingState, StatCard } from '@admin/components/AdminCards';
import { buildRegistrationChart, formatAdminDate, percent, resolveUserName } from '@admin/admin-utils';

export default function OverviewPage() {
  const usersQuery = useQuery({ queryKey: ['admin-users'], queryFn: () => api.getAdminUsers() });
  const sectionsQuery = useQuery({ queryKey: ['admin-question-sections'], queryFn: () => api.getAdminQuestionSections() });
  const supportQuery = useQuery({
    queryKey: ['admin-support-conversations'],
    queryFn: () => api.getAdminSupportConversations(),
    refetchInterval: 20_000,
  });
  const theoryQuery = useQuery({ queryKey: ['admin-theory-summary'], queryFn: () => api.getAdminTheorySummary() });
  const promoQuery = useQuery({ queryKey: ['admin-promo-status'], queryFn: () => api.getPromoStatus() });

  const users = usersQuery.data || [];
  const questionSections = sectionsQuery.data || [];
  const conversations = supportQuery.data || [];
  const chartData = useMemo(() => buildRegistrationChart(users), [users]);
  const totalQuestions = questionSections.reduce((sum, section) => sum + Number(section.count || 0), 0);
  const premiumUsers = users.filter((user) => user.is_premium).length;
  const blockedUsers = users.filter((user) => user.is_blocked).length;
  const unreadSupport = conversations.reduce((sum, item) => sum + Number(item.unread_count || 0), 0);

  return (
    <div>
      <AdminPageHeader
        eyebrow="Адмін-панель"
        title="Огляд DrivePrep"
        description="Коротка картина продукту: користувачі, преміум, база питань, теорія ПДР і звернення в підтримку."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Користувачі" value={users.length} hint={`${premiumUsers} з Premium`} tone="blue" />
        <StatCard icon={FileQuestion} label="Питання" value={totalQuestions} hint={`${questionSections.length} розділів у базі`} tone="green" />
        <StatCard icon={BookOpenText} label="Теорія" value={theoryQuery.data?.sections || 0} hint={`${theoryQuery.data?.assets || 0} медіафайлів`} tone="violet" />
        <StatCard icon={MessageCircleMore} label="Підтримка" value={unreadSupport} hint="непрочитані звернення" tone="rose" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Реєстрації та Premium</CardTitle>
          </CardHeader>
          <CardContent>
            {usersQuery.isLoading ? (
              <LoadingState />
            ) : chartData.length ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 16, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="adminUsersFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.24} />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="adminPremiumFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} stroke="#64748b" />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="#64748b" allowDecimals={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="users" name="Користувачі" stroke="#2563eb" strokeWidth={3} fill="url(#adminUsersFill)" />
                    <Area type="monotone" dataKey="premium" name="Premium" stroke="#f59e0b" strokeWidth={3} fill="url(#adminPremiumFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <LoadingState text="Чекаю перші реєстрації для графіка." />
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Стан продукту</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatusRow label="Premium-конверсія" value={`${percent(premiumUsers, users.length)}%`} tone="amber" />
            <StatusRow label="Заблоковані акаунти" value={blockedUsers} tone="rose" />
            <StatusRow label="Акція" value={promoQuery.data?.is_active ? 'Активна' : 'Вимкнена'} tone={promoQuery.data?.is_active ? 'green' : 'slate'} />
            <StatusRow label="Категорії теорії" value={theoryQuery.data?.categories || 0} tone="blue" />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Останні користувачі</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(users.slice(0, 6)).map((user) => (
              <div key={user.id} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{resolveUserName(user)}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {user.is_admin ? <Badge className="bg-blue-600">Admin</Badge> : null}
                  {user.is_premium ? <Badge className="bg-amber-500">Premium</Badge> : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Підтримка</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(conversations.slice(0, 6)).map((item) => (
              <div key={item.user.id} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{resolveUserName(item.user)}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">{item.last_message?.content || 'Повідомлень немає'}</p>
                  </div>
                  {item.unread_count ? <Badge variant="destructive">{item.unread_count}</Badge> : <ShieldCheck className="h-4 w-4 text-emerald-500" />}
                </div>
                <p className="mt-2 text-xs text-slate-400">{formatAdminDate(item.last_message?.created_at)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusRow({ label, value, tone }) {
  const toneClass = {
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
    rose: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200',
    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200',
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  };
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
      <span className={`rounded-lg px-2.5 py-1 text-sm font-semibold ${toneClass[tone] || toneClass.slate}`}>{value}</span>
    </div>
  );
}
