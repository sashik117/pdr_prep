// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Crown, KeyRound, Search, Shield, Star, Trash2, UserRoundCog, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api from '@/api/apiClient';
import { AdminPageHeader, EmptyState, LoadingState, StatCard } from '@/features/admin/components/AdminCards';
import { clampNumber, formatAdminDate, percent, resolveUserName } from '@/features/admin/admin-utils';

const userFilters = [
  { value: 'all', label: 'Усі користувачі' },
  { value: 'premium', label: 'Premium' },
  { value: 'regular', label: 'Без Premium' },
  { value: 'admin', label: 'Адміни' },
  { value: 'blocked', label: 'Заблоковані' },
];

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [achievementDrafts, setAchievementDrafts] = useState({});

  const usersQuery = useQuery({ queryKey: ['admin-users'], queryFn: () => api.getAdminUsers() });
  const auditQuery = useQuery({
    queryKey: ['admin-user-audit', selectedUserId],
    queryFn: () => api.getAdminUserAudit(selectedUserId),
    enabled: Boolean(selectedUserId),
  });

  const users = usersQuery.data || [];
  const filteredUsers = useMemo(() => {
    const value = search.trim().toLowerCase();
    return users.filter((user) => {
      const haystack = [user.name, user.surname, user.username, user.email, user.full_name].join(' ').toLowerCase();
      const matchesSearch = !value || haystack.includes(value);
      const matchesFilter =
        filter === 'all' ||
        (filter === 'premium' && user.is_premium) ||
        (filter === 'regular' && !user.is_premium) ||
        (filter === 'admin' && user.is_admin) ||
        (filter === 'blocked' && user.is_blocked);
      return matchesSearch && matchesFilter;
    });
  }, [filter, search, users]);

  useEffect(() => {
    if (!selectedUserId && filteredUsers.length) {
      setSelectedUserId(filteredUsers[0].id);
    }
  }, [filteredUsers, selectedUserId]);

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, payload }) => api.updateAdminUser(userId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-user-audit', selectedUserId] }),
        queryClient.invalidateQueries({ queryKey: ['cabinet-stats'] }),
      ]);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId) => api.deleteAdminUser(userId),
    onSuccess: async () => {
      setSelectedUserId(null);
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (userId) => api.resetAdminUserPassword(userId),
  });

  const achievementMutation = useMutation({
    mutationFn: ({ userId, payload }) => api.updateAdminUserAchievements(userId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-user-audit', selectedUserId] }),
      ]);
    },
  });

  const selectedAudit = auditQuery.data;
  const selectedUser = selectedAudit?.user;
  const draft = selectedUser
    ? drafts[selectedUser.id] || {
        total_tests: selectedUser.total_tests || 0,
        total_correct: selectedUser.total_correct || 0,
        total_answers: selectedUser.total_answers || 0,
        marathon_best: selectedUser.marathon_best || 0,
        streak_days: selectedUser.streak_days || 0,
        manual_star_adjustment: selectedUser.manual_star_adjustment || 0,
        is_premium: Boolean(selectedUser.is_premium),
        is_blocked: Boolean(selectedUser.is_blocked),
      }
    : null;

  const premiumUsers = users.filter((user) => user.is_premium).length;
  const blockedUsers = users.filter((user) => user.is_blocked).length;
  const averageAccuracy = users.length
    ? Math.round(users.reduce((sum, user) => sum + percent(user.total_correct, user.total_answers), 0) / users.length)
    : 0;

  const updateDraft = (key, value) => {
    if (!selectedUser || !draft) return;
    setDrafts((current) => ({
      ...current,
      [selectedUser.id]: { ...draft, [key]: value },
    }));
  };

  const saveDraft = () => {
    if (!selectedUser || !draft) return;
    updateUserMutation.mutate({
      userId: selectedUser.id,
      payload: {
        total_tests: clampNumber(draft.total_tests),
        total_correct: clampNumber(draft.total_correct),
        total_answers: clampNumber(draft.total_answers),
        marathon_best: clampNumber(draft.marathon_best),
        streak_days: clampNumber(draft.streak_days),
        manual_star_adjustment: clampNumber(draft.manual_star_adjustment),
        is_premium: Boolean(draft.is_premium),
        is_blocked: Boolean(draft.is_blocked),
      },
    });
  };

  return (
    <div>
      <AdminPageHeader
        eyebrow="Користувачі"
        title="Керування акаунтами"
        description="Пошук, Premium-доступ, блокування, статистика, досягнення та аудит активності користувача."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Усього" value={users.length} hint="зареєстровані акаунти" tone="blue" />
        <StatCard icon={Crown} label="Premium" value={premiumUsers} hint={`${percent(premiumUsers, users.length)}% від бази`} tone="amber" />
        <StatCard icon={Shield} label="Блокування" value={blockedUsers} hint="потребують уваги" tone="rose" />
        <StatCard icon={BadgeCheck} label="Середня точність" value={`${averageAccuracy}%`} hint="по всіх акаунтах" tone="green" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <CardHeader className="space-y-4">
            <CardTitle className="text-lg font-semibold">Список користувачів</CardTitle>
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input className="pl-9" placeholder="Пошук за ім’ям, username або email" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Фільтр" />
                </SelectTrigger>
                <SelectContent>
                  {userFilters.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {usersQuery.isLoading ? (
              <div className="p-4"><LoadingState /></div>
            ) : filteredUsers.length ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Користувач</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead className="text-right">Тести</TableHead>
                      <TableHead className="text-right">Точність</TableHead>
                      <TableHead>Дата</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow
                        key={user.id}
                        className={selectedUserId === user.id ? 'bg-blue-50/70 dark:bg-blue-950/20' : 'cursor-pointer'}
                        onClick={() => setSelectedUserId(user.id)}
                      >
                        <TableCell>
                          <div className="min-w-56">
                            <p className="font-medium text-slate-950 dark:text-white">{resolveUserName(user)}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            {user.is_admin ? <Badge className="bg-blue-600">Admin</Badge> : <Badge variant="secondary">User</Badge>}
                            {user.is_premium ? <Badge className="bg-amber-500">Premium</Badge> : null}
                            {user.is_blocked ? <Badge variant="destructive">Blocked</Badge> : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{user.total_tests || 0}</TableCell>
                        <TableCell className="text-right">{percent(user.total_correct, user.total_answers)}%</TableCell>
                        <TableCell className="text-sm text-slate-500">{formatAdminDate(user.created_at, { hour: undefined, minute: undefined })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="p-4"><EmptyState text="Користувачів за цим фільтром не знайдено." /></div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Профіль та аудит</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {auditQuery.isLoading ? <LoadingState /> : null}
            {!auditQuery.isLoading && !selectedUser ? <EmptyState text="Оберіть користувача в таблиці." /> : null}
            {selectedUser && draft ? (
              <>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xl font-semibold tracking-[-0.03em]">{resolveUserName(selectedUser)}</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">@{selectedUser.username || 'user'} · {selectedUser.email}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={draft.is_premium ? 'default' : 'outline'}
                        size="sm"
                        className="rounded-lg"
                        onClick={() => updateDraft('is_premium', !draft.is_premium)}
                      >
                        <Crown className="mr-2 h-4 w-4" />
                        {draft.is_premium ? 'Premium активний' : 'Видати Premium'}
                      </Button>
                      <Button
                        variant={draft.is_blocked ? 'destructive' : 'outline'}
                        size="sm"
                        className="rounded-lg"
                        disabled={selectedUser.is_admin}
                        onClick={() => updateDraft('is_blocked', !draft.is_blocked)}
                      >
                        <Shield className="mr-2 h-4 w-4" />
                        {draft.is_blocked ? 'Заблоковано' : 'Заблокувати'}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['total_tests', 'Тестів'],
                    ['total_correct', 'Правильних'],
                    ['total_answers', 'Відповідей'],
                    ['marathon_best', 'Марафон'],
                    ['streak_days', 'Серія днів'],
                    ['manual_star_adjustment', 'Корекція зірок'],
                  ].map(([key, label]) => (
                    <label key={key} className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</span>
                      <Input type="number" value={draft[key] ?? ''} onChange={(event) => updateDraft(key, Number(event.target.value || 0))} />
                    </label>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button className="rounded-lg" disabled={updateUserMutation.isPending} onClick={saveDraft}>
                    <UserRoundCog className="mr-2 h-4 w-4" />
                    Зберегти
                  </Button>
                  <Button variant="outline" className="rounded-lg" disabled={resetPasswordMutation.isPending} onClick={() => resetPasswordMutation.mutate(selectedUser.id)}>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Скинути пароль
                  </Button>
                  <Button
                    variant="destructive"
                    className="rounded-lg"
                    disabled={selectedUser.is_admin || deleteUserMutation.isPending}
                    onClick={() => {
                      if (window.confirm(`Видалити користувача ${selectedUser.email}?`)) {
                        deleteUserMutation.mutate(selectedUser.id);
                      }
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Видалити
                  </Button>
                </div>

                {resetPasswordMutation.data?.message ? (
                  <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 dark:bg-blue-950/30 dark:text-blue-200">{resetPasswordMutation.data.message}</p>
                ) : null}

                <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="font-semibold">Досягнення</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Input
                      placeholder="achievement_id, наприклад perfect_1"
                      value={achievementDrafts[selectedUser.id] || ''}
                      onChange={(event) => setAchievementDrafts((current) => ({ ...current, [selectedUser.id]: event.target.value }))}
                    />
                    <Button
                      variant="outline"
                      className="rounded-lg"
                      disabled={!achievementDrafts[selectedUser.id]?.trim()}
                      onClick={() => achievementMutation.mutate({ userId: selectedUser.id, payload: { achievement_id: achievementDrafts[selectedUser.id], remove: false } })}
                    >
                      <Star className="mr-2 h-4 w-4" />
                      Видати
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-lg"
                      disabled={!achievementDrafts[selectedUser.id]?.trim()}
                      onClick={() => achievementMutation.mutate({ userId: selectedUser.id, payload: { achievement_id: achievementDrafts[selectedUser.id], remove: true } })}
                    >
                      Забрати
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(selectedAudit?.achievements || []).slice(0, 12).map((achievement) => (
                      <Badge key={achievement.achievement_id} variant="secondary">{achievement.achievement_name || achievement.achievement_id}</Badge>
                    ))}
                  </div>
                </div>

                <AuditTimeline audit={selectedAudit} />
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AuditTimeline({ audit }) {
  const groups = [
    ['Останні тести', audit?.tests || [], (item) => `${item.mode || 'test'} · ${item.correct}/${item.total}`],
    ['Батли', audit?.battles || [], (item) => `${item.status || 'pending'} · ${item.challenger_name || item.challenger_email} vs ${item.opponent_name || item.opponent_email}`],
    ['Повідомлення', audit?.messages || [], (item) => item.content || '(порожньо)'],
  ];

  return (
    <div className="grid gap-3">
      {groups.map(([title, items, getTitle]) => (
        <div key={title} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <p className="font-semibold">{title}</p>
          <div className="mt-3 space-y-2">
            {items.slice(0, 4).map((item) => (
              <div key={`${title}-${item.id}`} className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950/60">
                <p className="line-clamp-1 font-medium">{getTitle(item)}</p>
                <p className="mt-1 text-xs text-slate-500">{formatAdminDate(item.created_at)}</p>
              </div>
            ))}
            {!items.length ? <p className="text-sm text-slate-500">Поки що порожньо.</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
