// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Headset, LifeBuoy, Mail, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import LoginPrompt from '@/components/auth/LoginPrompt';
import ProtectedScreenFallback from '@/components/auth/ProtectedScreenFallback';
import { useProtectedScreen } from '@/lib/useProtectedScreen';
import api from '@/api/apiClient';
import { playTone } from '@/lib/soundEffects';

const SUPPORT_EMAIL = 'pdr.preparation@gmail.com';

function formatDateHeader(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Kyiv' }).format(new Date(value));
}

function formatMessageTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv' }).format(new Date(value));
}

export default function Support() {
  const navigate = useNavigate();
  const { user, isCheckingAccess, isTemporaryAuthFailure, canAccess, checkUserAuth } = useProtectedScreen();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const seenThreadSizeRef = useRef(null);

  const supportQuery = useQuery({
    queryKey: ['support-messages'],
    queryFn: () => api.getSupportMessages(),
    enabled: !!user,
    refetchInterval: 20_000,
  });

  const sendMutation = useMutation({
    mutationFn: () => api.sendSupportMessage(message),
    onSuccess: async () => {
      setMessage('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['support-messages'] }),
        queryClient.invalidateQueries({ queryKey: ['notification-summary'] }),
      ]);
    },
  });

  const thread = supportQuery.data || [];
  const sortedThread = useMemo(
    () => [...thread].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    [thread],
  );

  useEffect(() => {
    if (user && supportQuery.isSuccess) {
      queryClient.invalidateQueries({ queryKey: ['notification-summary'] });
    }
  }, [queryClient, supportQuery.isSuccess, user]);

  useEffect(() => {
    if (!user || !supportQuery.isSuccess) return;
    const previousSize = seenThreadSizeRef.current;
    seenThreadSizeRef.current = sortedThread.length;
    if (previousSize === null || sortedThread.length <= previousSize) return;
    const last = sortedThread[sortedThread.length - 1];
    const mine = last?.from_email?.toLowerCase() === user.email?.toLowerCase();
    if (!mine) {
      playTone('finish');
    }
  }, [sortedThread, supportQuery.isSuccess, user]);

  if (isCheckingAccess) {
    return <ProtectedScreenFallback loading />;
  }

  if (isTemporaryAuthFailure) {
    return <ProtectedScreenFallback temporary onRetry={checkUserAuth} />;
  }

  if (!canAccess || !user) {
    return (
      <LoginPrompt
        title="Підтримка"
        description="Увійдіть, щоб написати в підтримку та бачити відповіді прямо тут."
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button type="button" variant="ghost" className="-ml-2 rounded-full px-3" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Назад
      </Button>

      <Card className="border-white/90 bg-[linear-gradient(135deg,rgba(20,107,255,0.08),rgba(255,255,255,1)_48%,rgba(224,242,254,0.88))] shadow-[0_18px_45px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(8,47,73,0.9)_50%,rgba(15,23,42,0.98))]">
        <CardContent className="p-6 sm:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Headset className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">Підтримка DrivePrep</h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                  Напишіть сюди питання, баг або побажання. Це працює як маленький чат: ваші повідомлення й офіційні відповіді підтримки зберігаються прямо в цьому розділі.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-sky-100 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300">
              <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                <Mail className="h-4 w-4 text-primary" />
                {SUPPORT_EMAIL}
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Можна писати тут, а не шукати пошту окремо.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-white/90 shadow-[0_18px_45px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950/92">
          <CardHeader>
            <CardTitle>Діалог із підтримкою</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-[680px] min-h-[520px] space-y-2.5 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/70 sm:min-h-[620px] sm:p-4">
              {sortedThread.length > 0 ? sortedThread.map((item) => {
                const index = sortedThread.findIndex((entry) => entry.id === item.id);
                const previous = index > 0 ? sortedThread[index - 1] : null;
                const showDate = !previous || formatDateHeader(previous.created_at) !== formatDateHeader(item.created_at);
                const mine = item.from_email?.toLowerCase() === user.email?.toLowerCase();
                const isSupport = item.from_email?.toLowerCase() === SUPPORT_EMAIL.toLowerCase();
                return (
                  <div key={item.id} className="space-y-2">
                    {showDate ? (
                      <div className="flex justify-center">
                        <span className="rounded-lg bg-white px-3 py-1 text-[11px] font-medium text-slate-500 shadow-sm dark:bg-slate-950 dark:text-slate-400">
                          {formatDateHeader(item.created_at)}
                        </span>
                      </div>
                    ) : null}
                    <div
                      className={`w-fit max-w-[82%] rounded-lg px-3 py-1.5 text-sm leading-5 shadow-sm sm:max-w-[70%] ${
                        mine
                          ? 'ml-auto bg-primary text-primary-foreground'
                          : isSupport
                            ? 'border border-sky-100 bg-sky-50 text-slate-800 dark:border-sky-500/25 dark:bg-sky-950/35 dark:text-slate-100'
                            : 'bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold">{mine ? 'Ви' : 'Підтримка'}</p>
                        {isSupport && !mine ? (
                          <span className="rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-primary-foreground">
                            Support
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap break-words">{item.content}</p>
                      <p className={`mt-1 text-[10px] leading-none ${mine ? 'text-primary-foreground/75' : 'text-slate-400 dark:text-slate-500'}`}>
                        {formatMessageTime(item.created_at)}
                      </p>
                    </div>
                  </div>
                );
              }) : (
                <div className="flex min-h-[260px] items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-white px-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                  Ще немає листування. Напишіть перше повідомлення, і воно з'явиться тут.
                </div>
              )}
            </div>

            <div className="rounded-xl border border-sky-100 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={2}
                placeholder="Опишіть проблему або питання простими словами..."
                className="min-h-[54px] resize-none py-2.5"
              />
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400">Підтримка відповідає прямо в цей розділ, тому можна просто повернутися сюди пізніше.</p>
                <Button
                  className="rounded-xl shadow-[0_14px_28px_rgba(20,107,255,0.18)]"
                  disabled={!message.trim() || sendMutation.isPending}
                  onClick={() => sendMutation.mutate()}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {sendMutation.isPending ? 'Надсилання...' : 'Надіслати'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-white/90 shadow-[0_18px_45px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950/92">
            <CardHeader>
              <CardTitle>Коли сюди писати</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              <p>Якщо не вантажаться фото, зник прогрес, є дивний текст, не відкривається батл або хочеться запропонувати щось нове — це саме сюди.</p>
              <p>Чим точніше опишете, що і де зламалося, тим швидше це можна буде виправити.</p>
            </CardContent>
          </Card>

          <Card className="border-white/90 shadow-[0_18px_45px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950/92">
            <CardHeader>
              <CardTitle>Що краще одразу додати</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                  <LifeBuoy className="h-4 w-4 text-primary" />
                  Щоб підтримка швидше допомогла
                </div>
                <p className="mt-2">Напишіть сторінку, де виникла проблема, що саме ви натиснули і що очікували побачити. Якщо є текст помилки, додайте його теж.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
