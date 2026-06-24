// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Crown, Eye, EyeOff, KeyRound, Search, Shield, Star, Trash2, UserPlus, UserRoundCog, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api from '@/api/apiClient';
import { AdminPageHeader, EmptyState, LoadingState, StatCard } from '@admin/components/AdminCards';
import { clampNumber, formatAdminDate, percent, resolveUserName } from '@admin/admin-utils';

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
  const [createUserForm, setCreateUserForm] = useState({
    name: '',
    surname: '',
    username: '',
    email: '',
    password: '',
    is_premium: false,
    premium_months: 1,
    is_blocked: false,
    is_admin: false,
  });
  const [showCreatePassword, setShowCreatePassword] = useState(false);

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
    onSuccess: async (updatedUser) => {
      if (updatedUser?.id) {
        setDrafts((current) => {
          const next = { ...current };
          delete next[updatedUser.id];
          return next;
        });
        queryClient.setQueryData(['admin-users'], (current = []) => (
          Array.isArray(current)
            ? current.map((item) => (Number(item.id) === Number(updatedUser.id) ? { ...item, ...updatedUser } : item))
            : current
        ));
        queryClient.setQueryData(['admin-user-audit', updatedUser.id], (current) => (
          current ? { ...current, user: { ...(current.user || {}), ...updatedUser } } : current
        ));
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-user-audit', selectedUserId] }),
        queryClient.invalidateQueries({ queryKey: ['cabinet-stats'] }),
      ]);
    },
  });

  const createUserMutation = useMutation({
    mutationFn: (payload) => api.createAdminUser(payload),
    onSuccess: async (createdUser) => {
      setCreateUserForm({
        name: '',
        surname: '',
        username: '',
        email: '',
        password: '',
        is_premium: false,
        premium_months: 1,
        is_blocked: false,
      });
      setSelectedUserId(createdUser?.id || null);
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
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
        premium_months: 1,
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
        premium_months: clampNumber(draft.premium_months || 0),
        premium_waived: Boolean(draft.premium_waived),
        is_admin: Boolean(draft.is_admin),
        is_blocked: Boolean(draft.is_blocked),
      },
    });
  };

  const updateCreateUserForm = (key, value) => {
    setCreateUserForm((current) => ({ ...current, [key]: value }));
  };

  const submitCreateUser = (event) => {
    event.preventDefault();
    createUserMutation.mutate({
      ...createUserForm,
      username: createUserForm.username.replace(/^@/, '').trim(),
      email: createUserForm.email.trim(),
      password: createUserForm.password,
      premium_months: clampNumber(createUserForm.premium_months || 1),
    });
  };

  return (
    <div className="flex flex-col">
      <AdminPageHeader
        eyebrow="Користувачі"
        title="Керування акаунтами"
        description="Пошук, Premium-доступ, блокування, статистика, досягнення та аудит активності користувача."
      />

      <Card className="order-3 mt-4 border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <UserPlus className="h-5 w-5 text-blue-600" />
            Додати користувача
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <form onSubmit={submitCreateUser} autoComplete="off" className="grid gap-2 lg:grid-cols-6">
            <Input
              className="lg:col-span-1"
              placeholder="Ім'я"
              value={createUserForm.name}
              onChange={(event) => updateCreateUserForm('name', event.target.value)}
              required
            />
            <Input
              className="lg:col-span-1"
              placeholder="Прізвище"
              value={createUserForm.surname}
              onChange={(event) => updateCreateUserForm('surname', event.target.value)}
            />
            <Input
              className="lg:col-span-1"
              placeholder="@username"
              autoComplete="off"
              value={createUserForm.username}
              onChange={(event) => updateCreateUserForm('username', event.target.value.replace(/\s+/g, ''))}
              required
            />
            <Input
              className="lg:col-span-1"
              type="email"
              placeholder="email"
              autoComplete="off"
              value={createUserForm.email}
              onChange={(event) => updateCreateUserForm('email', event.target.value)}
              required
            />
            <div className="relative lg:col-span-1">
              <Input
                type={showCreatePassword ? 'text' : 'password'}
                placeholder="пароль"
                autoComplete="new-password"
                value={createUserForm.password}
                onChange={(event) => updateCreateUserForm('password', event.target.value)}
                required
                minLength={6}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                onClick={() => setShowCreatePassword((value) => !value)}
                aria-label={showCreatePassword ? 'Приховати пароль' : 'Показати пароль'}
              >
                {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button type="submit" disabled={createUserMutation.isPending} className="rounded-xl lg:col-span-1">
              {createUserMutation.isPending ? 'Створення...' : 'Створити'}
            </Button>

            <div className="flex flex-wrap gap-2 lg:col-span-6">
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={createUserForm.is_premium}
                  onChange={(event) => updateCreateUserForm('is_premium', event.target.checked)}
                />
                Premium
              </label>
              {createUserForm.is_premium ? (
                <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                  Місяців
                  <Input
                    type="number"
                    min="1"
                    max="120"
                    className="h-8 w-20"
                    value={createUserForm.premium_months}
                    onChange={(event) => updateCreateUserForm('premium_months', Number(event.target.value || 1))}
                  />
                </label>
              ) : null}
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={createUserForm.is_admin}
                  onChange={(event) => updateCreateUserForm('is_admin', event.target.checked)}
                />
                Адмін
              </label>
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={createUserForm.is_blocked}
                  onChange={(event) => updateCreateUserForm('is_blocked', event.target.checked)}
                />
                Заблокований
              </label>
              {createUserMutation.isError ? (
                <span className="inline-flex items-center text-sm font-medium text-rose-600">
                  {createUserMutation.error?.message || 'Не вдалося створити користувача'}
                </span>
              ) : null}
              {createUserMutation.isSuccess ? (
                <span className="inline-flex items-center text-sm font-medium text-emerald-600">Користувача створено</span>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="order-2 mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Усього" value={users.length} hint="зареєстровані акаунти" tone="blue" />
        <StatCard icon={Crown} label="Premium" value={premiumUsers} hint={`${percent(premiumUsers, users.length)}% від бази`} tone="amber" />
        <StatCard icon={Shield} label="Блокування" value={blockedUsers} hint="потребують уваги" tone="rose" />
        <StatCard icon={BadgeCheck} label="Середня точність" value={`${averageAccuracy}%`} hint="по всіх акаунтах" tone="green" />
      </div>

      <div className="order-4 mt-6 grid gap-6 xl:grid-cols-[1fr_0.9fr]">
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
                      {selectedUser.premium_expires_at ? (
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-200">
                          Premium до {formatAdminDate(selectedUser.premium_expires_at)}
                        </p>
                      ) : null}
                      {selectedUser.premium_waived ? (
                        <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-200">Premium приховано, доступ повний без upsell</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={draft.is_premium ? 'default' : 'outline'}
                        size="sm"
                        className="rounded-lg"
                        onClick={() => {
                          const nextPremium = !draft.is_premium;
                          updateDraft('is_premium', nextPremium);
                          updateDraft('premium_waived', !nextPremium);
                        }}
                      >
                        <Crown className="mr-2 h-4 w-4" />
                        {draft.is_premium ? 'Premium активний' : 'Відмінити Premium'}
                      </Button>
                      <label className="flex min-w-[150px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                        <span>Міс.</span>
                        <Input
                          type="number"
                          min="0"
                          max="120"
                          value={draft.premium_months ?? 1}
                          onChange={(event) => updateDraft('premium_months', Number(event.target.value || 0))}
                          className="h-8 w-20"
                        />
                      </label>
                      <Button
                        variant={draft.is_admin ? 'default' : 'outline'}
                        size="sm"
                        className="rounded-lg"
                        onClick={() => updateDraft('is_admin', !draft.is_admin)}
                      >
                        <Shield className="mr-2 h-4 w-4" />
                        {draft.is_admin ? 'Адмін' : 'Видати адмінку'}
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
