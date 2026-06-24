// @ts-nocheck
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircleMore, Search, Send, ShieldCheck, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import api from '@/api/apiClient';
import { AdminPageHeader, EmptyState, LoadingState, StatCard } from '@admin/components/AdminCards';
import { formatAdminDate, resolveUserName } from '@admin/admin-utils';

const supportEmail = 'pdr.preparation@gmail.com';

export default function SupportPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [reply, setReply] = useState('');

  const conversationsQuery = useQuery({
    queryKey: ['admin-support-conversations'],
    queryFn: () => api.getAdminSupportConversations(),
    refetchInterval: 20_000,
  });
  const threadQuery = useQuery({
    queryKey: ['admin-support-thread', selectedUserId],
    queryFn: () => api.getAdminSupportConversation(selectedUserId),
    enabled: Boolean(selectedUserId),
    refetchInterval: 20_000,
  });

  const conversations = conversationsQuery.data || [];
  const filteredConversations = conversations.filter((item) => {
    const value = search.trim().toLowerCase();
    if (!value) return true;
    return [resolveUserName(item.user), item.user?.email, item.user?.username, item.last_message?.content]
      .join(' ')
      .toLowerCase()
      .includes(value);
  });

  useEffect(() => {
    if (!selectedUserId && filteredConversations.length) {
      setSelectedUserId(filteredConversations[0].user.id);
    }
  }, [filteredConversations, selectedUserId]);

  const replyMutation = useMutation({
    mutationFn: () => api.replyAdminSupport(selectedUserId, reply),
    onSuccess: async () => {
      setReply('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-support-conversations'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-support-thread', selectedUserId] }),
        queryClient.invalidateQueries({ queryKey: ['notification-summary'] }),
      ]);
    },
  });

  const unread = conversations.reduce((sum, item) => sum + Number(item.unread_count || 0), 0);
  const answered = conversations.filter((item) => item.last_message?.from_email === supportEmail).length;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Підтримка"
        title="Чати з користувачами"
        description="Єдиний центр відповідей: нові звернення, історія діалогу, статус прочитання та швидка відповідь від команди DrivePrep."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={MessageCircleMore} label="Діалогів" value={conversations.length} hint="усі звернення" tone="blue" />
        <StatCard icon={ShieldCheck} label="Непрочитані" value={unread} hint="потребують відповіді" tone="rose" />
        <StatCard icon={Users} label="Відповіли" value={answered} hint="останнє повідомлення від підтримки" tone="green" />
        <StatCard icon={Send} label="Оновлення" value="20 c" hint="автоматичне оновлення" tone="violet" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <CardHeader className="space-y-4">
            <CardTitle className="text-lg font-semibold">Діалоги</CardTitle>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="pl-9" placeholder="Пошук за користувачем або повідомленням" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
          </CardHeader>
          <CardContent>
            {conversationsQuery.isLoading ? <LoadingState /> : null}
            {!conversationsQuery.isLoading && !filteredConversations.length ? <EmptyState text="Чатів поки немає." /> : null}
            <div className="space-y-2">
              {filteredConversations.map((item) => (
                <button
                  key={item.user.id}
                  type="button"
                  onClick={() => setSelectedUserId(item.user.id)}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${
                    selectedUserId === item.user.id
                      ? 'border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-950/20'
                      : 'border-slate-200 bg-slate-50 hover:bg-white dark:border-slate-800 dark:bg-slate-950/60 dark:hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{resolveUserName(item.user)}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{item.user.email}</p>
                    </div>
                    {item.unread_count ? <Badge variant="destructive">{item.unread_count}</Badge> : null}
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.last_message?.content || 'Повідомлень немає'}</p>
                  <p className="mt-2 text-xs text-slate-400">{formatAdminDate(item.last_message?.created_at)}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Вікно чату</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {threadQuery.isLoading ? <LoadingState /> : null}
            {!threadQuery.isLoading && !threadQuery.data?.user ? <EmptyState text="Оберіть діалог ліворуч." /> : null}
            {threadQuery.data?.user ? (
              <>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                  <p className="font-semibold text-slate-950 dark:text-white">{resolveUserName(threadQuery.data.user)}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">@{threadQuery.data.user.username || 'user'} · {threadQuery.data.user.email}</p>
                </div>

                <div className="max-h-[58vh] min-h-[420px] space-y-4 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                  {(threadQuery.data.messages || []).map((message, index, messages) => {
                    const isSupport = message.from_email === supportEmail;
                    const currentDay = dayLabel(message.created_at);
                    const previousDay = dayLabel(messages[index - 1]?.created_at);
                    return (
                      <div key={message.id}>
                        {currentDay !== previousDay ? (
                          <div className="my-3 text-center text-xs font-medium text-slate-400">{currentDay}</div>
                        ) : null}
                        <div className={`flex ${isSupport ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                              isSupport
                                ? 'bg-blue-600 text-white'
                                : 'border border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100'
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{message.content}</p>
                            <p className={`mt-2 text-right text-[11px] ${isSupport ? 'text-blue-100' : 'text-slate-400'}`}>{timeLabel(message.created_at)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <Textarea
                    rows={3}
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder="Напишіть спокійну й корисну відповідь користувачу..."
                  />
                  <div className="mt-3 flex justify-end">
                    <Button className="rounded-lg" disabled={!reply.trim() || replyMutation.isPending} onClick={() => replyMutation.mutate()}>
                      <Send className="mr-2 h-4 w-4" />
                      Відповісти
                    </Button>
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function dayLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' });
}

function timeLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}
