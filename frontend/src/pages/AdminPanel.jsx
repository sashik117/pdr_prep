// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, Flame, KeyRound, LogOut, MessageCircleMore, PencilLine, Search, Shield, Star, Trash2, UserCog, Users } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import api from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';

export default function AdminPanel() {
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const [tab, setTab] = useState('support');
  const [selectedSupportUserId, setSelectedSupportUserId] = useState(null);
  const [reply, setReply] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [questionSearch, setQuestionSearch] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [questionDrafts, setQuestionDrafts] = useState({});
  const [userDrafts, setUserDrafts] = useState({});
  const [achievementDrafts, setAchievementDrafts] = useState({});

  const supportConversationsQuery = useQuery({
    queryKey: ['admin-support-conversations'],
    queryFn: () => api.getAdminSupportConversations(),
    refetchInterval: 20_000,
  });

  const supportThreadQuery = useQuery({
    queryKey: ['admin-support-thread', selectedSupportUserId],
    queryFn: () => api.getAdminSupportConversation(selectedSupportUserId),
    enabled: !!selectedSupportUserId,
    refetchInterval: 20_000,
  });

  const adminUsersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.getAdminUsers(),
  });

  const userAuditQuery = useQuery({
    queryKey: ['admin-user-audit', selectedUserId],
    queryFn: () => api.getAdminUserAudit(selectedUserId),
    enabled: !!selectedUserId,
  });

  const sectionsQuery = useQuery({
    queryKey: ['admin-question-sections'],
    queryFn: () => api.getAdminQuestionSections(),
  });

  const adminQuestionsQuery = useQuery({
    queryKey: ['admin-questions', selectedSection, questionSearch],
    queryFn: () => api.searchAdminQuestions({ section: selectedSection, search: questionSearch }),
  });

  useEffect(() => {
    if (!selectedSupportUserId && supportConversationsQuery.data?.length) {
      setSelectedSupportUserId(supportConversationsQuery.data[0].user.id);
    }
  }, [selectedSupportUserId, supportConversationsQuery.data]);

  useEffect(() => {
    if (!selectedUserId && adminUsersQuery.data?.length) {
      setSelectedUserId(adminUsersQuery.data[0].id);
    }
  }, [adminUsersQuery.data, selectedUserId]);

  useEffect(() => {
    if (supportThreadQuery.isSuccess) {
      queryClient.invalidateQueries({ queryKey: ['notification-summary'] });
    }
  }, [queryClient, supportThreadQuery.isSuccess]);

  const replyMutation = useMutation({
    mutationFn: () => api.replyAdminSupport(selectedSupportUserId, reply),
    onSuccess: async () => {
      setReply('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-support-conversations'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-support-thread', selectedSupportUserId] }),
        queryClient.invalidateQueries({ queryKey: ['notification-summary'] }),
      ]);
    },
  });

  const userMutation = useMutation({
    mutationFn: ({ userId, payload }) => api.updateAdminUser(userId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-user-audit', selectedUserId] }),
        queryClient.invalidateQueries({ queryKey: ['leaderboard'] }),
        queryClient.invalidateQueries({ queryKey: ['cabinet-stats'] }),
      ]);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId) => api.deleteAdminUser(userId),
    onSuccess: async () => {
      setSelectedUserId(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
        queryClient.invalidateQueries({ queryKey: ['leaderboard'] }),
      ]);
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

  const questionMutation = useMutation({
    mutationFn: ({ questionId, payload }) => api.updateAdminQuestion(questionId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-questions', selectedSection, questionSearch] });
    },
  });

  const filteredUsers = useMemo(() => {
    const search = userSearch.trim().toLowerCase();
    if (!search) return adminUsersQuery.data || [];
    return (adminUsersQuery.data || []).filter((item) => {
      const haystack = [item.name, item.surname, item.username, item.email].join(' ').toLowerCase();
      return haystack.includes(search);
    });
  }, [adminUsersQuery.data, userSearch]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Card className="border-white/90 bg-[linear-gradient(135deg,rgba(20,107,255,0.12),rgba(255,255,255,1)_48%,rgba(224,242,254,0.92))] shadow-[0_24px_60px_rgba(37,99,235,0.08)] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(2,6,23,0.96),rgba(15,23,42,0.98))]">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-600 dark:text-sky-300">Суперкористувач</p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950 dark:text-white">Панель керування</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                Тут зібрані звернення в підтримку, аудит користувачів і зручний менеджер тестових питань по розділах.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <CompactMetric icon={MessageCircleMore} label="Чати" value={supportConversationsQuery.data?.length || 0} tone="sky" />
              <CompactMetric icon={Users} label="Користувачі" value={adminUsersQuery.data?.length || 0} tone="violet" />
              <CompactMetric icon={BellRing} label="Нові звернення" value={(supportConversationsQuery.data || []).reduce((sum, item) => sum + (item.unread_count || 0), 0)} tone="rose" />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="destructive" className="rounded-xl px-5 shadow-[0_12px_24px_rgba(239,68,68,0.18)]" onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab} className="space-y-5">
        <TabsList className="h-auto flex-wrap rounded-2xl p-1">
          <TabsTrigger value="support" className="rounded-xl">Підтримка</TabsTrigger>
          <TabsTrigger value="users" className="rounded-xl">Користувачі</TabsTrigger>
          <TabsTrigger value="questions" className="rounded-xl">Питання</TabsTrigger>
        </TabsList>

        <TabsContent value="support" className="space-y-0">
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="dark:border-slate-800 dark:bg-slate-950/92">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MessageCircleMore className="h-5 w-5 text-primary" />Активні чати</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(supportConversationsQuery.data || []).map((item) => (
                  <button
                    key={item.user.id}
                    type="button"
                    onClick={() => setSelectedSupportUserId(item.user.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition-all ${
                      selectedSupportUserId === item.user.id
                        ? 'border-primary bg-primary/5 shadow-[0_16px_38px_rgba(20,107,255,0.12)]'
                        : 'border-slate-200 bg-white hover:border-primary/20 dark:border-slate-800 dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900 dark:text-white">
                          {item.user.full_name || `${item.user.name || ''} ${item.user.surname || ''}`.trim()}
                        </p>
                        <p className="truncate text-sm text-slate-500 dark:text-slate-400">@{item.user.username || 'user'}</p>
                        <p className="mt-2 truncate text-xs text-slate-500 dark:text-slate-400">{item.last_message?.content || 'Без повідомлень'}</p>
                      </div>
                      {item.unread_count ? (
                        <span className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-2 text-xs font-black text-white">
                          {item.unread_count}
                        </span>
                      ) : null}
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="dark:border-slate-800 dark:bg-slate-950/92">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" />Центр підтримки</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {supportThreadQuery.data?.user ? (
                  <>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                      <p className="font-semibold text-slate-900 dark:text-white">{supportThreadQuery.data.user.full_name || `${supportThreadQuery.data.user.name || ''} ${supportThreadQuery.data.user.surname || ''}`.trim()}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">@{supportThreadQuery.data.user.username || 'user'} • {supportThreadQuery.data.user.email}</p>
                    </div>

                    <div className="max-h-[480px] space-y-3 overflow-y-auto rounded-[24px] border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                      {(supportThreadQuery.data.messages || []).map((item) => {
                        const isSupport = item.from_email === 'pdr.preparation@gmail.com';
                        return (
                          <div
                            key={item.id}
                            className={`max-w-[92%] rounded-[22px] px-4 py-3 text-sm leading-6 shadow-sm ${
                              isSupport
                                ? 'ml-auto bg-primary text-primary-foreground'
                                : 'bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-100'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{isSupport ? 'Підтримка' : `@${supportThreadQuery.data.user.username || 'user'}`}</p>
                              {isSupport ? (
                                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                                  Support
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 whitespace-pre-wrap break-words">{item.content}</p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="rounded-[24px] border border-sky-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                      <Textarea
                        rows={4}
                        value={reply}
                        onChange={(event) => setReply(event.target.value)}
                        placeholder="Напишіть офіційну відповідь від підтримки..."
                      />
                      <div className="mt-3 flex justify-end">
                        <Button disabled={!reply.trim() || replyMutation.isPending} onClick={() => replyMutation.mutate()}>
                          {replyMutation.isPending ? 'Надсилання...' : 'Відповісти'}
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                    Оберіть чат ліворуч, щоб відповісти користувачу.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-0">
          <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
            <Card className="dark:border-slate-800 dark:bg-slate-950/92">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><UserCog className="h-5 w-5 text-primary" />Список користувачів</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input className="pl-9" placeholder="Пошук по імені, @username або email" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} />
                </div>
                <div className="space-y-3">
                  {filteredUsers.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedUserId(item.id)}
                      className={`w-full rounded-2xl border p-4 text-left transition-all ${
                        selectedUserId === item.id
                          ? 'border-primary bg-primary/5 shadow-[0_16px_38px_rgba(20,107,255,0.12)]'
                          : 'border-slate-200 bg-white hover:border-primary/20 dark:border-slate-800 dark:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900 dark:text-white">{item.full_name || `${item.name || ''} ${item.surname || ''}`.trim()}</p>
                          <p className="truncate text-sm text-slate-500 dark:text-slate-400">@{item.username || 'user'} • {item.email}</p>
                        </div>
                        {item.is_blocked ? (
                          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300">Бан</span>
                        ) : null}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">Тестів: {item.total_tests || 0}</span>
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">Зірок: {item.total_stars || 0}</span>
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Стрік: {item.streak_days || 0}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="dark:border-slate-800 dark:bg-slate-950/92">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" />Аудит користувача</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {userAuditQuery.data?.user ? (
                  <>
                    <AuditHeader
                      audit={userAuditQuery.data}
                      userDrafts={userDrafts}
                      setUserDrafts={setUserDrafts}
                      achievementDrafts={achievementDrafts}
                      setAchievementDrafts={setAchievementDrafts}
                      userMutation={userMutation}
                      deleteUserMutation={deleteUserMutation}
                      resetPasswordMutation={resetPasswordMutation}
                      achievementMutation={achievementMutation}
                    />
                    <AuditHistory audit={userAuditQuery.data} />
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                    Оберіть користувача ліворуч, щоб побачити детальну статистику, батли та повідомлення.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="questions" className="space-y-4">
          <Card className="dark:border-slate-800 dark:bg-slate-950/92">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><PencilLine className="h-5 w-5 text-primary" />Менеджер питань по розділах</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[0.8fr_1.2fr]">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Розділ</span>
                  <select
                    value={selectedSection}
                    onChange={(event) => setSelectedSection(event.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Усі розділи</option>
                    {(sectionsQuery.data || []).map((section) => (
                      <option key={`${section.section}-${section.section_name}`} value={section.section}>
                        {section.section}. {section.section_name || 'Без назви'} ({section.count})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Пошук</span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input className="pl-9" placeholder="Текст питання, пояснення або тема" value={questionSearch} onChange={(event) => setQuestionSearch(event.target.value)} />
                  </div>
                </label>
              </div>

              <div className="space-y-4">
                {(adminQuestionsQuery.data || []).map((question) => {
                  const draft = questionDrafts[question.id] || {
                    question_text: question.question_text || '',
                    explanation: question.explanation || '',
                    difficulty: question.difficulty || 'medium',
                    section_name: question.section_name || '',
                    optionsText: (question.options || []).join('\n'),
                    imagesText: (question.images || []).join('\n'),
                    correct_ans: question.correct_ans || 1,
                  };
                  return (
                    <div key={question.id} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        <span>ID {question.id}</span>
                        <span>Розділ {question.section}</span>
                        <span>{question.section_name || 'Без назви'}</span>
                        <span>{question.difficulty}</span>
                      </div>

                      <div className="space-y-3">
                        <label className="space-y-2">
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Текст питання</span>
                          <Textarea rows={3} value={draft.question_text} onChange={(event) => updateQuestionDraft(setQuestionDrafts, question.id, draft, 'question_text', event.target.value)} />
                        </label>

                        <div className="grid gap-3 md:grid-cols-3">
                          <label className="space-y-2 md:col-span-2">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Назва розділу</span>
                            <Input value={draft.section_name} onChange={(event) => updateQuestionDraft(setQuestionDrafts, question.id, draft, 'section_name', event.target.value)} />
                          </label>
                          <label className="space-y-2">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Складність</span>
                            <Input value={draft.difficulty} onChange={(event) => updateQuestionDraft(setQuestionDrafts, question.id, draft, 'difficulty', event.target.value)} />
                          </label>
                        </div>

                        <label className="space-y-2">
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Варіанти відповідей</span>
                          <Textarea rows={5} value={draft.optionsText} onChange={(event) => updateQuestionDraft(setQuestionDrafts, question.id, draft, 'optionsText', event.target.value)} />
                          <p className="text-xs text-slate-500 dark:text-slate-400">Один варіант в одному рядку.</p>
                        </label>

                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="space-y-2">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Пояснення</span>
                            <Textarea rows={5} value={draft.explanation} onChange={(event) => updateQuestionDraft(setQuestionDrafts, question.id, draft, 'explanation', event.target.value)} />
                          </label>
                          <div className="space-y-3">
                            <label className="space-y-2">
                              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Картинки</span>
                              <Textarea rows={4} value={draft.imagesText} onChange={(event) => updateQuestionDraft(setQuestionDrafts, question.id, draft, 'imagesText', event.target.value)} />
                              <p className="text-xs text-slate-500 dark:text-slate-400">Одна назва файлу в одному рядку.</p>
                            </label>
                            <label className="space-y-2">
                              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Правильна відповідь</span>
                              <Input type="number" min="1" value={draft.correct_ans} onChange={(event) => updateQuestionDraft(setQuestionDrafts, question.id, draft, 'correct_ans', Number(event.target.value || 1))} />
                            </label>
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <Button
                            className="rounded-xl"
                            onClick={() => questionMutation.mutate({
                              questionId: question.id,
                              payload: {
                                question_text: draft.question_text,
                                section_name: draft.section_name,
                                difficulty: draft.difficulty,
                                explanation: draft.explanation,
                                options: draft.optionsText.split('\n').map((item) => item.trim()).filter(Boolean),
                                images: draft.imagesText.split('\n').map((item) => item.trim()).filter(Boolean),
                                correct_ans: Number(draft.correct_ans || 1),
                              },
                            })}
                          >
                            Зберегти питання
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function updateQuestionDraft(setter, questionId, draft, key, value) {
  setter((prev) => ({
    ...prev,
    [questionId]: { ...draft, [key]: value },
  }));
}

function CompactMetric({ icon: Icon, label, value, tone }) {
  const toneMap = {
    sky: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
    violet: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
    rose: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  };
  return (
    <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${toneMap[tone] || toneMap.sky}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-2xl font-black text-slate-950 dark:text-white">{value}</p>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
    </div>
  );
}

function AuditHeader({
  audit,
  userDrafts,
  setUserDrafts,
  achievementDrafts,
  setAchievementDrafts,
  userMutation,
  deleteUserMutation,
  resetPasswordMutation,
  achievementMutation,
}) {
  const user = audit.user;
  const draft = userDrafts[user.id] || {
    total_tests: user.total_tests || 0,
    total_correct: user.total_correct || 0,
    total_answers: user.total_answers || 0,
    marathon_best: user.marathon_best || 0,
    streak_days: user.streak_days || 0,
    manual_star_adjustment: user.manual_star_adjustment || 0,
  };

  return (
    <div className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-2xl font-black text-slate-950 dark:text-white">{user.full_name || `${user.name || ''} ${user.surname || ''}`.trim()}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">@{user.username || 'user'} • {user.email}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">Зірок: {user.total_stars || 0}</span>
            <span className="rounded-full bg-orange-100 px-3 py-1 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">Вогників: {user.streak_days || 0}</span>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Досягнень: {audit.achievements.length}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={user.is_blocked ? 'default' : 'outline'}
            className="rounded-xl"
            onClick={() => userMutation.mutate({ userId: user.id, payload: { is_blocked: !user.is_blocked } })}
          >
            {user.is_blocked ? 'Розбанити' : 'Забанити'}
          </Button>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => resetPasswordMutation.mutate(user.id)}
          >
            <KeyRound className="mr-2 h-4 w-4" />
            Скинути пароль
          </Button>
          <Button
            variant="destructive"
            className="rounded-xl"
            onClick={() => {
              if (window.confirm(`Видалити користувача ${user.email}?`)) {
                deleteUserMutation.mutate(user.id);
              }
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Видалити
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {[
          ['total_tests', 'Тестів'],
          ['total_correct', 'Правильних'],
          ['total_answers', 'Відповідей'],
          ['marathon_best', 'Марафон'],
          ['streak_days', 'Вогники'],
          ['manual_star_adjustment', 'Корекція зірок'],
        ].map(([key, label]) => (
          <label key={key} className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</span>
            <Input
              type="number"
              value={draft[key] ?? ''}
              onChange={(event) => setUserDrafts((prev) => ({
                ...prev,
                [user.id]: { ...draft, [key]: Number(event.target.value || 0) },
              }))}
            />
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap gap-2">
          <Input
            placeholder="achievement_id, наприклад perfect_1"
            value={achievementDrafts[user.id] || ''}
            onChange={(event) => setAchievementDrafts((prev) => ({ ...prev, [user.id]: event.target.value }))}
          />
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => achievementMutation.mutate({ userId: user.id, payload: { achievement_id: achievementDrafts[user.id], remove: false } })}
          >
            <Star className="mr-2 h-4 w-4" />
            Видати
          </Button>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => achievementMutation.mutate({ userId: user.id, payload: { achievement_id: achievementDrafts[user.id], remove: true } })}
          >
            Забрати
          </Button>
        </div>
        <Button className="rounded-xl" onClick={() => userMutation.mutate({ userId: user.id, payload: draft })}>
          Зберегти правки
        </Button>
      </div>

      {resetPasswordMutation.data?.message ? (
        <p className="text-sm font-semibold text-primary">{resetPasswordMutation.data.message}</p>
      ) : null}
    </div>
  );
}

function AuditHistory({ audit }) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <HistoryColumn
        title="Останні тести"
        icon={Shield}
        items={(audit.tests || []).map((item) => ({
          id: item.id,
          title: `${item.mode || 'test'} • ${item.correct}/${item.total}`,
          subtitle: item.created_at ? new Date(item.created_at).toLocaleString('uk-UA') : '',
        }))}
      />
      <HistoryColumn
        title="Історія батлів"
        icon={Flame}
        items={(audit.battles || []).map((item) => ({
          id: item.id,
          title: `${item.challenger_name || item.challenger_email} vs ${item.opponent_name || item.opponent_email}`,
          subtitle: `${item.status || 'pending'} • ${item.created_at ? new Date(item.created_at).toLocaleString('uk-UA') : ''}`,
        }))}
      />
      <HistoryColumn
        title="Останні повідомлення"
        icon={MessageCircleMore}
        items={(audit.messages || []).map((item) => ({
          id: item.id,
          title: item.content || '(порожньо)',
          subtitle: `${item.from_email} → ${item.to_email}`,
        }))}
      />
    </div>
  );
}

function HistoryColumn({ title, icon: Icon, items }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <p className="font-semibold text-slate-900 dark:text-white">{title}</p>
      </div>
      <div className="space-y-3">
        {items.length ? items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950">
            <p className="font-medium text-slate-900 dark:text-white">{item.title}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</p>
          </div>
        )) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            Поки що тут порожньо.
          </div>
        )}
      </div>
    </div>
  );
}
