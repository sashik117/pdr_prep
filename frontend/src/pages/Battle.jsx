// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock3, History, PlayCircle, Search, ShieldAlert, Swords, Target, Trophy, UserPlus2, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAuth } from '@/lib/AuthContext';
import LoginPrompt from '@/components/auth/LoginPrompt';
import api, { resolveApiUrl } from '@/api/apiClient';
import { normalizeQuestion } from '@/api/questionsApi';
import { cn } from '@/lib/utils';
import QuestionCard from '@/components/test/QuestionCard';
import { useToast } from '@/components/ui/use-toast';

const battleCategoryOptions = ['A', 'B', 'C', 'D', 'T', 'BE'];

export default function Battle() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const [opponentUser, setOpponentUser] = useState('');
  const [friendSearch, setFriendSearch] = useState('');
  const [category, setCategory] = useState('B');
  const [selectedBattleId, setSelectedBattleId] = useState(0);
  const [answers, setAnswers] = useState({});
  const [startedAt, setStartedAt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [exitBattleOpen, setExitBattleOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);

  const normalizedOpponentUsername = useMemo(() => String(opponentUser || '').trim().replace(/^@/, ''), [opponentUser]);

  const { data: battles = [], isLoading } = useQuery({
    queryKey: ['battles'],
    queryFn: () => api.getBattles(),
    enabled: !!user,
    refetchInterval: 10_000,
  });

  const { data: friendsData } = useQuery({
    queryKey: ['friends'],
    queryFn: () => api.getFriends(),
    enabled: !!user,
  });

  const { data: battleDetails } = useQuery({
    queryKey: ['battle-details', selectedBattleId],
    queryFn: () => api.getBattle(selectedBattleId),
    enabled: !!user && !!selectedBattleId,
    refetchInterval: 4_000,
  });

  const userPreviewQuery = useQuery({
    queryKey: ['battle-user-preview', normalizedOpponentUsername],
    queryFn: () => api.getUserProfileByUsername(normalizedOpponentUsername),
    enabled: !!user && normalizedOpponentUsername.length >= 3,
    retry: false,
  });

  const incomingInvites = useMemo(() => battles.filter((battle) => battle.status === 'pending' && battle.role === 'opponent'), [battles]);
  const outgoingInvites = useMemo(() => battles.filter((battle) => battle.status === 'pending' && battle.role === 'challenger'), [battles]);
  const activeBattle = useMemo(() => battles.find((battle) => battle.status === 'active') || null, [battles]);
  const historyBattles = useMemo(() => battles.filter((battle) => battle.status === 'finished'), [battles]);

  useEffect(() => {
    const battleIdFromUrl = Number(new URLSearchParams(location.search).get('battleId') || 0);
    if (battleIdFromUrl > 0) {
      setSelectedBattleId(battleIdFromUrl);
      return;
    }
    if (activeBattle?.id) {
      setSelectedBattleId(activeBattle.id);
    }
  }, [location.search, activeBattle?.id]);

  useEffect(() => {
    if (battleDetails?.questions?.length) {
      setAnswers({});
      setStartedAt(Date.now());
    }
  }, [battleDetails?.id, battleDetails?.questions?.length]);

  useEffect(() => {
    setSecondsLeft(Number(battleDetails?.seconds_left || 0));
  }, [battleDetails?.seconds_left, battleDetails?.id]);

  useEffect(() => {
    if (!battleDetails || battleDetails.status !== 'active') return undefined;
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [battleDetails?.status, battleDetails?.id]);

  const filteredFriends = useMemo(() => {
    const list = friendsData?.friends || [];
    const query = friendSearch.trim().toLowerCase().replace(/^@/, '');
    if (!query) return list;
    return list.filter((item) => {
      const username = String(item.user?.username || '').toLowerCase();
      const fullName = String(item.user?.full_name || `${item.user?.name || ''} ${item.user?.surname || ''}`).toLowerCase();
      return username.includes(query) || fullName.includes(query);
    });
  }, [friendSearch, friendsData]);

  const previewUser = userPreviewQuery.data;
  const questions = useMemo(() => (battleDetails?.questions || []).map(normalizeQuestion).filter(Boolean), [battleDetails]);
  const canAnswer = battleDetails?.status === 'active' && !battleDetails?.my_submitted;
  const activeFight = battleDetails?.status === 'active' && !battleDetails?.my_submitted;
  const pressureMode = secondsLeft > 0 && secondsLeft <= 60;
  const overlayOpen = !!battleDetails && ['pending', 'active', 'finished'].includes(battleDetails.status);

  const closeOverlay = () => {
    setSelectedBattleId(0);
    navigate('/battle');
  };

  const createMutation = useMutation({
    mutationFn: ({ opponent_user, category: battleCategory }) =>
      api.createBattle({ opponent_user: String(opponent_user || '').trim().replace(/^@/, ''), category: battleCategory }),
    onSuccess: async (battle) => {
      setOpponentUser('');
      setSelectedBattleId(battle.id);
      await queryClient.invalidateQueries({ queryKey: ['battles'] });
      await queryClient.invalidateQueries({ queryKey: ['messages'] });
      navigate(`/battle?battleId=${battle.id}`);
    },
    onError: (error) => {
      toast({
        title: 'Не вдалося створити батл',
        description: error instanceof Error ? error.message : 'Спробуйте ще раз.',
        variant: 'destructive',
      });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (battleId) => api.acceptBattle(battleId),
    onSuccess: async (_, battleId) => {
      setSelectedBattleId(battleId);
      await queryClient.invalidateQueries({ queryKey: ['battles'] });
      await queryClient.invalidateQueries({ queryKey: ['battle-details', battleId] });
      await queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
    onError: (error) => {
      toast({
        title: 'Не вдалося прийняти батл',
        description: error instanceof Error ? error.message : 'Спробуйте ще раз.',
        variant: 'destructive',
      });
    },
  });

  const declineMutation = useMutation({
    mutationFn: (battleId) => api.declineBattle(battleId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['battles'] });
      await queryClient.invalidateQueries({ queryKey: ['messages'] });
      closeOverlay();
    },
    onError: (error) => {
      toast({
        title: 'Не вдалося відхилити батл',
        description: error instanceof Error ? error.message : 'Спробуйте ще раз.',
        variant: 'destructive',
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (battleId) => api.cancelBattle(battleId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['battles'] });
      await queryClient.invalidateQueries({ queryKey: ['messages'] });
      closeOverlay();
    },
    onError: (error) => {
      toast({
        title: 'Не вдалося скасувати виклик',
        description: error instanceof Error ? error.message : 'Спробуйте ще раз.',
        variant: 'destructive',
      });
    },
  });

  const submitMutation = useMutation({
    mutationFn: (payload) => api.submitBattle(selectedBattleId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['battles'] });
      await queryClient.invalidateQueries({ queryKey: ['battle-details', selectedBattleId] });
    },
  });

  const leaveBattle = () => {
    setExitBattleOpen(false);
    closeOverlay();
  };

  if (!user) {
    return (
      <LoginPrompt
        title="Батли"
        description="Увійдіть, щоб кидати виклики, приймати запрошення й проходити PVP-батли в реальному часі."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="rounded-[28px] border-white/70 dark:border-slate-800 dark:bg-slate-950/92">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus2 className="h-5 w-5 text-primary" />
              Кинути виклик
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">Нікнейм суперника</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input value={opponentUser} onChange={(event) => setOpponentUser(event.target.value)} placeholder="@username" />
                <Button
                  className="rounded-xl"
                  disabled={!normalizedOpponentUsername || createMutation.isPending || userPreviewQuery.isFetching || !previewUser}
                  onClick={() => createMutation.mutate({ opponent_user: normalizedOpponentUsername, category })}
                >
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Викликати
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {battleCategoryOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={cn(
                    'rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                    category === option ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300',
                  )}
                  onClick={() => setCategory(option)}
                >
                  {option}
                </button>
              ))}
            </div>

            {normalizedOpponentUsername ? (
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                {userPreviewQuery.isFetching ? (
                  <p className="text-sm text-slate-500 dark:text-slate-300">Шукаємо користувача...</p>
                ) : previewUser ? (
                  <div className="flex items-center gap-3">
                    <Avatar user={previewUser} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-bold text-slate-900 dark:text-white">
                        {previewUser.full_name || `${previewUser.name || ''} ${previewUser.surname || ''}`.trim() || 'Користувач'}
                      </p>
                      <p className="truncate text-sm text-slate-500 dark:text-slate-300">@{previewUser.username}</p>
                    </div>
                    <Button asChild variant="outline" className="rounded-xl">
                      <Link to={`/u/${previewUser.username}`}>Профіль</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-rose-600 dark:text-rose-300">
                    <ShieldAlert className="h-4 w-4" />
                    Користувача з таким нікнеймом не знайдено.
                  </div>
                )}
              </div>
            ) : null}

            <div className="space-y-3 rounded-[24px] border border-sky-100 bg-[linear-gradient(135deg,rgba(239,246,255,0.92),rgba(255,255,255,0.98))] p-5 dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(30,64,175,0.18),rgba(2,6,23,0.98))]">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-left dark:border-slate-700 dark:bg-slate-950/80"
                onClick={() => setFriendsOpen((value) => !value)}
              >
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Список друзів для батлу</p>
                  <p className="text-sm text-slate-500 dark:text-slate-300">Розгорніть список і викличте когось одразу звідси.</p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{friendsOpen ? 'Сховати' : 'Показати'}</span>
              </button>

              {friendsOpen ? (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input className="pl-9" value={friendSearch} onChange={(event) => setFriendSearch(event.target.value)} placeholder="Або виберіть друга зі списку" />
                  </div>
                  <div className="max-h-[300px] space-y-3 overflow-y-auto pr-1">
                    {filteredFriends.length > 0 ? filteredFriends.map((friend) => (
                      <button
                        key={friend.id}
                        type="button"
                        className="flex w-full items-center gap-3 rounded-3xl border border-slate-100 bg-white p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_16px_34px_rgba(20,107,255,0.08)] dark:border-slate-800 dark:bg-slate-950/80"
                        onClick={() => {
                          const username = friend.user?.username || '';
                          setOpponentUser(`@${username}`);
                          createMutation.mutate({ opponent_user: username, category });
                        }}
                      >
                        <Avatar user={friend.user} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-900 dark:text-white">
                            {friend.user?.full_name || `${friend.user?.name || ''} ${friend.user?.surname || ''}`.trim() || 'Користувач'}
                          </p>
                          <p className="truncate text-sm text-slate-500 dark:text-slate-300">@{friend.user?.username || 'unknown'}</p>
                        </div>
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">Інвайт</span>
                      </button>
                    )) : (
                      <div className="rounded-3xl border border-dashed border-slate-200 bg-white/80 p-5 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                        Можна запросити будь-якого користувача через @username, а друзі з’являються тут списком.
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[28px] border-white/70 dark:border-slate-800 dark:bg-slate-950/92">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Swords className="h-5 w-5 text-primary" />
                Активні виклики
              </CardTitle>
              <Button variant="outline" className="rounded-xl" onClick={() => setHistoryOpen(true)}>
                <History className="mr-2 h-4 w-4" />
                Історія батлів
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeBattle ? (
                <InviteCard battle={activeBattle} kind="active" onOpen={() => { setSelectedBattleId(activeBattle.id); navigate(`/battle?battleId=${activeBattle.id}`); }} />
              ) : null}

              {incomingInvites.length > 0 ? incomingInvites.map((battle) => (
                <InviteCard
                  key={battle.id}
                  battle={battle}
                  kind="incoming"
                  onAccept={() => acceptMutation.mutate(battle.id)}
                  onDecline={() => declineMutation.mutate(battle.id)}
                  onOpen={() => { setSelectedBattleId(battle.id); navigate(`/battle?battleId=${battle.id}`); }}
                />
              )) : null}

              {outgoingInvites.length > 0 ? outgoingInvites.map((battle) => (
                <InviteCard
                  key={battle.id}
                  battle={battle}
                  kind="outgoing"
                  onDecline={() => cancelMutation.mutate(battle.id)}
                  onOpen={() => { setSelectedBattleId(battle.id); navigate(`/battle?battleId=${battle.id}`); }}
                />
              )) : null}

              {!activeBattle && incomingInvites.length === 0 && outgoingInvites.length === 0 && !isLoading ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                  Зараз викликів немає. Кидайте батл друзям або будь-кому через @username.
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogTitle>Історія батлів</DialogTitle>
          <DialogDescription>Останні завершені дуелі з датою та часом фінішу.</DialogDescription>
          <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
            {historyBattles.length > 0 ? historyBattles.map((battle) => (
              <button
                key={battle.id}
                type="button"
                className="w-full rounded-3xl border border-slate-100 bg-slate-50/70 p-4 text-left transition hover:border-primary/20 dark:border-slate-800 dark:bg-slate-900/70"
                onClick={() => {
                  setHistoryOpen(false);
                  setSelectedBattleId(battle.id);
                  navigate(`/battle?battleId=${battle.id}`);
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{battle.opponent_name || `@${battle.opponent_username || 'unknown'}`}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-300">@{battle.opponent_username || 'unknown'} • Категорія {battle.category}</p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      Завершено: {battle.finished_at ? new Date(battle.finished_at).toLocaleString('uk-UA') : 'без часу'}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    Завершено
                  </span>
                </div>
              </button>
            )) : (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                Історія ще порожня.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={overlayOpen}
        onOpenChange={(open) => {
          if (!open) {
            if (activeFight) {
              setExitBattleOpen(true);
              return;
            }
            closeOverlay();
          }
        }}
      >
        <DialogContent className="flex h-[92vh] max-h-[92vh] max-w-[min(1200px,96vw)] overflow-hidden border-none bg-white/98 p-0 shadow-[0_35px_120px_rgba(15,23,42,0.35)] dark:bg-slate-950/98">
          <DialogTitle className="sr-only">Поточний батл</DialogTitle>
          <DialogDescription className="sr-only">Повноекранний режим поєдинку з таймером, запрошенням або результатом.</DialogDescription>

          <div className="flex h-full min-h-0 w-full flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 bg-[linear-gradient(135deg,rgba(2,132,199,0.10),rgba(255,255,255,0.98))] px-5 py-4 dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(14,116,144,0.32),rgba(2,6,23,0.98))]">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f62fe,#38bdf8)] text-white shadow-[0_12px_30px_rgba(15,98,254,0.28)]">
                  <Swords className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">PVP-батл</p>
                  <p className="text-2xl font-black tracking-[-0.04em] text-slate-950 dark:text-white">@{battleDetails?.opponent_username || 'unknown'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {battleDetails?.status === 'active' ? (
                  <div className={cn(
                    'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ring-1 ring-inset shadow-sm',
                    pressureMode ? 'animate-pulse bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/40' : 'bg-primary/10 text-primary ring-primary/20',
                  )}>
                    <Clock3 className="h-4 w-4" />
                    {formatTime(secondsLeft)}
                  </div>
                ) : null}

                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-2xl border-slate-300 bg-white text-slate-900 shadow-sm hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
                  onClick={() => {
                    if (activeFight) {
                      setExitBattleOpen(true);
                      return;
                    }
                    closeOverlay();
                  }}
                >
                  <X className="h-6 w-6" />
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              {battleDetails?.status === 'pending' ? (
                <div className="mx-auto max-w-3xl space-y-5 rounded-[28px] border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-900/60 dark:bg-amber-950/30">
                  <Avatar
                    user={{
                      username: battleDetails.opponent_username,
                      avatar_url: withVersion(battleDetails.opponent_avatar_url, battleDetails.opponent_avatar_version),
                      active_frame: battleDetails.opponent_active_frame,
                    }}
                    size="xl"
                    centered
                  />
                  <h3 className="text-3xl font-black tracking-[-0.04em] text-slate-950 dark:text-white">
                    {battleDetails.role === 'opponent' ? `@${battleDetails.opponent_username} викликає вас на батл` : `Виклик для @${battleDetails.opponent_username} вже відправлено`}
                  </h3>
                  <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Після прийняття стартує повноцінний 10-хвилинний бій. Хто фінішує першим, той скорочує час супернику до останньої хвилини.
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    {battleDetails.role === 'opponent' ? (
                      <>
                        <Button className="rounded-full" disabled={acceptMutation.isPending || declineMutation.isPending} onClick={() => acceptMutation.mutate(battleDetails.id)}>Прийняти батл</Button>
                        <Button variant="outline" className="rounded-full" disabled={acceptMutation.isPending || declineMutation.isPending} onClick={() => declineMutation.mutate(battleDetails.id)}>Відхилити</Button>
                      </>
                    ) : (
                      <>
                        <Button variant="outline" className="rounded-full" onClick={closeOverlay}>До лобі батлів</Button>
                        <Button variant="outline" className="rounded-full" disabled={cancelMutation.isPending} onClick={() => cancelMutation.mutate(battleDetails.id)}>Скасувати виклик</Button>
                      </>
                    )}
                  </div>
                </div>
              ) : null}

              {battleDetails?.status === 'active' ? (
                <div className="space-y-5">
                  {pressureMode ? (
                    <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-4 text-center text-sm font-bold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
                      Час різко скорочено. Суперник уже фінішував, у вас залишилися лічені секунди.
                    </div>
                  ) : null}

                  <div className="rounded-[26px] border border-primary/20 bg-[linear-gradient(135deg,rgba(219,234,254,0.85),rgba(255,255,255,0.98))] p-4 shadow-[0_12px_30px_rgba(20,107,255,0.08)] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(30,64,175,0.22),rgba(2,6,23,0.98))]">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-3 w-3 animate-pulse rounded-full bg-rose-500 shadow-[0_0_14px_rgba(244,63,94,0.7)]" />
                        <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">У бою</p>
                      </div>
                      <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">@{battleDetails.opponent_username || 'unknown'}</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <InfoBox icon={Target} label="Категорія" value={battleDetails.category} />
                      <InfoBox icon={Clock3} label="Статус" value="У бою" />
                      <InfoBox icon={Trophy} label="Суперник" value={`@${battleDetails.opponent_username || 'unknown'}`} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    {questions.map((question, index) => (
                      <div key={question.id} className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
                        <QuestionCard
                          question={question}
                          index={index}
                          totalQuestions={questions.length}
                          selectedAnswer={answers[String(question.id)]}
                          onSelectAnswer={(label) => {
                            if (!canAnswer) return;
                            setAnswers((prev) => ({ ...prev, [String(question.id)]: label }));
                          }}
                          isFavorite={false}
                          onToggleFavorite={undefined}
                          isAuthenticated
                          onAnalyzeSituation={null}
                        />
                      </div>
                    ))}

                    {canAnswer ? (
                      <Button
                        className="rounded-full"
                        disabled={submitMutation.isPending || Object.keys(answers).length !== questions.length}
                        onClick={() => submitMutation.mutate({ answers, time_seconds: Math.floor((Date.now() - startedAt) / 1000) })}
                      >
                        Зафіксувати результат
                      </Button>
                    ) : (
                      <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                        Ви вже завершили свій прохід. Чекаємо остаточний підсумок.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {battleDetails?.status === 'finished' ? <BattleFinishCard battleDetails={battleDetails} onBackToLobby={closeOverlay} onCompare={() => setCompareOpen(true)} /> : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="sm:max-w-5xl">
          <DialogTitle>Порівняння відповідей</DialogTitle>
          <DialogDescription>Паралельний розбір ваших відповідей і відповідей суперника.</DialogDescription>
          {battleDetails ? <BattleComparison battleDetails={battleDetails} /> : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={exitBattleOpen} onOpenChange={setExitBattleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Увага! Ви в бою</AlertDialogTitle>
            <AlertDialogDescription>
              Якщо ви вийдете зараз, результат не буде збережено, а батл може бути анульовано або зараховано як поразку.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Залишитись у бою</AlertDialogCancel>
            <AlertDialogAction onClick={leaveBattle}>Вийти</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InviteCard({ battle, kind, onAccept, onDecline, onOpen }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Avatar
          user={{
            username: battle.opponent_username,
            avatar_url: withVersion(battle.opponent_avatar_url, battle.opponent_avatar_version),
            active_frame: battle.opponent_active_frame,
          }}
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900 dark:text-white">{battle.opponent_name || 'Користувач'}</p>
          <p className="text-sm text-slate-500 dark:text-slate-300">@{battle.opponent_username || 'unknown'} • Категорія {battle.category}</p>
        </div>
        <span className={cn(
          'rounded-full px-3 py-1 text-xs font-bold',
          kind === 'incoming' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
            kind === 'active' ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
        )}>
          {kind === 'incoming' ? 'Вхідний виклик' : kind === 'active' ? 'Бій триває' : 'Очікує відповіді'}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {kind === 'incoming' ? (
          <>
            <Button className="rounded-full" onClick={onAccept}>Прийняти батл</Button>
            <Button variant="outline" className="rounded-full" onClick={onDecline}>Відхилити</Button>
          </>
        ) : null}
        {kind === 'outgoing' ? <Button variant="outline" className="rounded-full" onClick={onDecline}>Скасувати виклик</Button> : null}
        <Button variant="outline" className="rounded-full" onClick={onOpen}>Відкрити</Button>
      </div>
    </div>
  );
}

function BattleFinishCard({ battleDetails, onBackToLobby, onCompare }) {
  const winnerUsername = battleDetails.winner_username || 'superuser';
  const iWon = battleDetails.role === 'challenger'
    ? battleDetails.winner_email === battleDetails.challenger_email
    : battleDetails.winner_email === battleDetails.opponent_email;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn(
        'mx-auto max-w-3xl overflow-hidden rounded-[32px] border p-10 text-center shadow-[0_24px_70px_rgba(15,23,42,0.12)]',
        iWon
          ? 'border-amber-200 bg-[linear-gradient(135deg,rgba(254,243,199,0.98),rgba(255,255,255,0.98))] dark:border-amber-900/60 dark:bg-[linear-gradient(135deg,rgba(146,64,14,0.35),rgba(15,23,42,0.98))]'
          : 'border-slate-300 bg-[linear-gradient(135deg,rgba(226,232,240,0.98),rgba(248,250,252,0.98))] dark:border-slate-700 dark:bg-[linear-gradient(135deg,rgba(30,41,59,0.98),rgba(15,23,42,0.98))]',
      )}
    >
      <div className="text-6xl">{iWon ? '🏆' : '💥'}</div>
      <h3 className={cn('mt-5 text-4xl font-black tracking-[-0.05em]', iWon ? 'text-amber-700 dark:text-amber-300' : 'text-slate-700 dark:text-slate-100')}>
        {iWon ? 'Ура! Ви рознесли суперника!' : 'О ні! Переміг @' + winnerUsername + ', але наступного разу вам точно пощастить!'}
      </h3>
      <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
        {iWon
          ? 'Фініш вийшов епічним: швидкість, точність і холодна голова. Саме так і виглядає справжній батл.'
          : 'Цього разу суперник виявився сильнішим. Але реванш уже чекає в лобі, і він може бути вашим.'}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button className="rounded-full" onClick={onBackToLobby}>До лобі батлів</Button>
        <Button variant="outline" className="rounded-full" onClick={onCompare}>Порівняти відповіді</Button>
        {battleDetails?.opponent_username ? (
          <Button asChild variant="outline" className="rounded-full">
            <Link to={'/u/' + battleDetails.opponent_username}>Профіль суперника</Link>
          </Button>
        ) : null}
      </div>
    </motion.div>
  );
}

function BattleComparison({ battleDetails }) {
  const myAnswers = battleDetails.role === 'challenger' ? battleDetails.challenger_answers || {} : battleDetails.opponent_answers || {};
  const opponentAnswers = battleDetails.role === 'challenger' ? battleDetails.opponent_answers || {} : battleDetails.challenger_answers || {};

  return (
    <div className="max-h-[72vh] space-y-4 overflow-y-auto pr-1">
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
        <p>Суперник: <span className="font-bold text-slate-900 dark:text-white">@{battleDetails.opponent_username || 'unknown'}</span></p>
        <p className="mt-1">Фініш: {battleDetails.finished_at ? new Date(battleDetails.finished_at).toLocaleString('uk-UA') : 'ще не завершено'}</p>
      </div>

      {(battleDetails.questions || []).map((question, index) => {
        const normalizedQuestion = normalizeQuestion(question);
        const key = String(question.id);
        const correct = String(normalizedQuestion?.correct_answer || question.correct_answer || '?').toUpperCase();
        const mine = String(myAnswers[key] || '?').toUpperCase();
        const opponent = String(opponentAnswers[key] || '?').toUpperCase();
        const mineCorrect = mine === correct;
        const opponentCorrect = opponent === correct;

        return (
          <div key={question.id} className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/80">
            <div className="mb-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Питання {index + 1}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{normalizedQuestion?.text || question.question_text || question.name}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <AnswerColumn title="Твоя відповідь" answer={mine} correct={correct} isCorrect={mineCorrect} />
              <AnswerColumn title={'@' + (battleDetails.opponent_username || 'unknown')} answer={opponent} correct={correct} isCorrect={opponentCorrect} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AnswerColumn({ title, answer, correct, isCorrect }) {
  return (
    <div className={cn(
      'rounded-2xl border p-4',
      isCorrect ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/25' : 'border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/25',
    )}>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{title}</p>
      <div className={cn(
        'mt-3 inline-flex h-11 min-w-11 items-center justify-center rounded-2xl px-4 text-lg font-black',
        isCorrect ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
      )}>
        {answer}
      </div>
      <p className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Правильно: {correct}</p>
    </div>
  );
}

function InfoBox({ icon: Icon, label, value }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/70">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-300">{label}</p>
      <p className="text-base font-black text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function Avatar({ user, size = 'md', centered = false }) {
  const wrapperSize = size === 'xl' ? 'h-24 w-24 rounded-[30px]' : size === 'lg' ? 'h-16 w-16 rounded-[22px]' : 'h-12 w-12 rounded-2xl';
  const innerRadius = size === 'xl' ? 'rounded-[26px]' : size === 'lg' ? 'rounded-[18px]' : 'rounded-[14px]';
  const frameClass = cn(
    wrapperSize,
    'p-[2px]',
    centered && 'mx-auto',
    user?.active_frame === 'fire' && 'bg-[linear-gradient(135deg,#fb7185,#f97316)]',
    user?.active_frame === 'sun' && 'bg-[linear-gradient(135deg,#facc15,#fb7185)]',
    user?.active_frame === 'gold' && 'bg-[linear-gradient(135deg,#f59e0b,#fde68a)]',
    user?.active_frame === 'diamond' && 'bg-[linear-gradient(135deg,#38bdf8,#22d3ee)]',
    user?.active_frame === 'speed' && 'bg-[linear-gradient(135deg,#60a5fa,#2563eb)]',
    user?.active_frame === 'crown' && 'bg-[linear-gradient(135deg,#fbbf24,#f59e0b)]',
    user?.active_frame === 'galaxy' && 'bg-[linear-gradient(135deg,#312e81,#7c3aed,#ec4899)]',
    user?.active_frame === 'platinum' && 'bg-[linear-gradient(135deg,#cbd5e1,#94a3b8)]',
    user?.active_frame === 'mint' && 'bg-[linear-gradient(135deg,#34d399,#10b981)]',
    user?.active_frame === 'sunset' && 'bg-[linear-gradient(135deg,#fb7185,#f59e0b)]',
    user?.active_frame === 'neon' && 'bg-[linear-gradient(135deg,#d946ef,#8b5cf6)]',
    user?.active_frame === 'aurora' && 'bg-[linear-gradient(135deg,#22d3ee,#34d399)]',
    !user?.active_frame || user?.active_frame === 'default' ? 'bg-[linear-gradient(135deg,#dbeafe,#93c5fd)]' : '',
  );

  return (
    <div className={frameClass}>
      <div className={cn('h-full w-full overflow-hidden bg-slate-200 dark:bg-slate-700', innerRadius)}>
        {user?.avatar_url ? <img src={user.avatar_url} alt={user?.username || 'avatar'} className="h-full w-full object-cover" /> : null}
      </div>
    </div>
  );
}

function withVersion(url, version) {
  const resolved = resolveApiUrl(url);
  if (!resolved) return null;
  const numericVersion = Number(version || 0);
  return numericVersion > 0 ? `${resolved}${resolved.includes('?') ? '&' : '?'}v=${numericVersion}` : resolved;
}

function formatTime(seconds) {
  const safe = Math.max(0, Number(seconds || 0));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}
