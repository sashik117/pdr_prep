// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, AtSign, Check, CheckCheck, MessageCircleMore, Send, Swords, UserCheck, UserMinus, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/AuthContext';
import LoginPrompt from '@/components/auth/LoginPrompt';
import api, { resolveApiUrl } from '@/api/apiClient';
import { cn } from '@/lib/utils';

export default function Friends() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteInfo, setInviteInfo] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [selectedFriend, setSelectedFriend] = useState('');
  const [message, setMessage] = useState('');

  const { data: friendsData, isLoading } = useQuery({
    queryKey: ['friends'],
    queryFn: () => api.getFriends(),
    enabled: !!user,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', selectedFriend],
    queryFn: () => api.getMessages(selectedFriend),
    enabled: !!user && !!selectedFriend,
    refetchInterval: 8_000,
  });

  const { data: battles = [] } = useQuery({
    queryKey: ['battles'],
    queryFn: () => api.getBattles(),
    enabled: !!user,
    refetchInterval: 10_000,
  });

  const battlesById = useMemo(() => new Map((battles || []).map((battle) => [battle.id, battle])), [battles]);
  const selectedFriendData = useMemo(
    () => friendsData?.friends?.find((item) => item.user?.username === selectedFriend)?.user || null,
    [friendsData, selectedFriend],
  );

  useEffect(() => {
    if (!selectedFriend && friendsData?.friends?.length) {
      setSelectedFriend(friendsData.friends[0].user?.username || '');
    }
  }, [friendsData, selectedFriend]);

  useEffect(() => {
    if (friendsData) {
      queryClient.invalidateQueries({ queryKey: ['notification-summary'] });
    }
  }, [friendsData, queryClient]);

  const inviteMutation = useMutation({
    mutationFn: (username) => api.inviteFriend(username),
    onSuccess: async (response) => {
      setInviteError('');
      setInviteInfo(response?.message || 'Запрошення надіслано');
      setInviteUsername('');
      await queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
    onError: (error) => {
      setInviteInfo('');
      setInviteError(error instanceof Error ? error.message : 'Не вдалося надіслати запрошення');
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (friendshipId) => api.acceptFriend(friendshipId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (friendshipId) => api.removeFriend(friendshipId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
  });

  const messageMutation = useMutation({
    mutationFn: (payload) => api.sendMessage(payload),
    onSuccess: async () => {
      setMessage('');
      await queryClient.invalidateQueries({ queryKey: ['messages', selectedFriend] });
      await queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
  });

  const acceptBattleMutation = useMutation({
    mutationFn: (battleId) => api.acceptBattle(battleId),
    onSuccess: async (_, battleId) => {
      await queryClient.invalidateQueries({ queryKey: ['battles'] });
      await queryClient.invalidateQueries({ queryKey: ['messages', selectedFriend] });
      navigate(`/battle?battleId=${battleId}`);
    },
  });

  const declineBattleMutation = useMutation({
    mutationFn: (battleId) => api.declineBattle(battleId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['battles'] });
      await queryClient.invalidateQueries({ queryKey: ['messages', selectedFriend] });
    },
  });

  const chatOpenOnMobile = Boolean(selectedFriendData);

  if (!user) {
    return (
      <LoginPrompt
        title="Друзі та повідомлення"
        description="Увійдіть, щоб додавати друзів за @username, приймати запити, спілкуватися та бачити батл-інвайти в чаті."
      />
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card className={cn('border-white/85 shadow-[0_18px_45px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950/92', chatOpenOnMobile && 'hidden xl:block')}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 dark:text-white">
            <Users className="h-5 w-5 text-primary" />
            Друзі
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/70">
            <div className="flex gap-2">
              <Input
                placeholder="@username друга"
                value={inviteUsername}
                onChange={(event) => {
                  setInviteUsername(event.target.value);
                  setInviteInfo('');
                  setInviteError('');
                }}
              />
              <Button disabled={!inviteUsername || inviteMutation.isPending} onClick={() => inviteMutation.mutate(inviteUsername.trim())}>
                <AtSign className="mr-2 h-4 w-4" />
                Додати
              </Button>
            </div>
            {inviteInfo ? <p className="mt-3 text-sm font-medium text-emerald-600">{inviteInfo}</p> : null}
            {inviteError ? <p className="mt-3 text-sm font-medium text-red-600">{inviteError}</p> : null}
          </div>

          {(friendsData?.incoming || []).length ? (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Вхідні запити</p>
              {(friendsData?.incoming || []).map((invite) => (
                <FriendRequest key={invite.id} invite={invite} onAccept={() => acceptMutation.mutate(invite.id)} onReject={() => removeMutation.mutate(invite.id)} />
              ))}
            </div>
          ) : null}

          {(friendsData?.outgoing || []).length ? (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Очікують підтвердження</p>
              {(friendsData?.outgoing || []).map((invite) => (
                <FriendRequest key={invite.id} invite={invite} outgoing onReject={() => removeMutation.mutate(invite.id)} />
              ))}
            </div>
          ) : null}

          <div className="space-y-3">
            {(friendsData?.friends || []).map((friend) => (
              <button
                key={friend.id}
                type="button"
                className={cn(
                  'w-full rounded-2xl border p-4 text-left transition-all duration-200',
                  selectedFriend === friend.user?.username
                    ? 'border-primary bg-primary/5 shadow-[0_16px_38px_rgba(20,107,255,0.12)]'
                    : 'border-slate-100 bg-white hover:border-primary/20 dark:border-slate-800 dark:bg-slate-900/70',
                )}
                onClick={() => setSelectedFriend(friend.user?.username || '')}
              >
                <div className="flex items-center gap-3">
                  <Avatar user={friend.user} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900 dark:text-white">{friend.user?.full_name || `${friend.user?.name || ''} ${friend.user?.surname || ''}`.trim()}</p>
                    <p className="truncate text-sm text-slate-500 dark:text-slate-300">@{friend.user?.username || 'unknown'}</p>
                  </div>
                  {friend.unread_count ? <span className="rounded-lg bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">{friend.unread_count}</span> : null}
                </div>
              </button>
            ))}

            {!isLoading && !(friendsData?.friends?.length || friendsData?.incoming?.length || friendsData?.outgoing?.length) ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                Поки що немає друзів. Додайте когось через @username зверху.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className={cn('border-white/85 shadow-[0_18px_45px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950/92', !chatOpenOnMobile && 'hidden xl:block')}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 dark:text-white">
            <MessageCircleMore className="h-5 w-5 text-primary" />
            {selectedFriendData ? `Чат з @${selectedFriendData.username}` : 'Повідомлення'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedFriendData ? (
            <>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="ghost" size="icon" className="xl:hidden" onClick={() => setSelectedFriend('')}>
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <Link to={selectedFriendData.username ? `/u/${selectedFriendData.username}` : `/users/${selectedFriendData.id}`} className="shrink-0">
                    <Avatar user={selectedFriendData} />
                  </Link>
                  <Link to={selectedFriendData.username ? `/u/${selectedFriendData.username}` : `/users/${selectedFriendData.id}`} className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white">{selectedFriendData.full_name || `${selectedFriendData.name || ''} ${selectedFriendData.surname || ''}`.trim()}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-300">@{selectedFriendData.username}</p>
                  </Link>
                  <Button asChild variant="outline" className="ml-auto rounded-xl">
                    <Link to={selectedFriendData.username ? `/u/${selectedFriendData.username}` : `/users/${selectedFriendData.id}`}>Профіль</Link>
                  </Button>
                </div>
              </div>

              <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
                {messages.length > 0 ? messages.map((item) => {
                  const mine = item.from_email === user.email;
                  const invite = item.result_data?.kind === 'battle_invite' && item.result_data?.battle_id;
                  const battle = invite ? battlesById.get(item.result_data.battle_id) : null;
                  const canAccept = battle?.status === 'pending' && battle?.role === 'opponent';
                  const canDecline = canAccept;
                  const canOpen = !!battle?.id;

                  return (
                    <div key={item.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex max-w-[92%] gap-3 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
                        <Avatar user={mine ? user : selectedFriendData} small />
                        <div className={cn(
                          'rounded-2xl px-4 py-3 text-sm shadow-sm',
                          invite
                            ? mine
                              ? 'border border-primary/20 bg-primary/10 text-slate-900 dark:text-white'
                              : 'border border-amber-200 bg-amber-50 text-slate-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-white'
                            : mine
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-100',
                        )}>
                          <p className="mb-1 text-xs font-semibold opacity-80">{mine ? `@${user.username || ''}` : `@${selectedFriendData.username || ''}`}</p>

                          {invite ? (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <Swords className="h-4 w-4 text-primary" />
                                <p className="font-semibold">Запрошення на батл</p>
                              </div>
                              <p className="text-sm opacity-90">
                                {battle?.status === 'active'
                                  ? 'Батл уже активний. Можна переходити прямо в поєдинок.'
                                  : battle?.status === 'finished'
                                    ? 'Цей батл уже завершився.'
                                    : 'Тисніть нижче, щоб перейти до батлу й прийняти або відхилити виклик.'}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {canOpen ? (
                                  <Button size="sm" variant={mine ? 'secondary' : 'outline'} className="rounded-xl" asChild>
                                    <Link to={`/battle?battleId=${item.result_data.battle_id}`}>Відкрити батл</Link>
                                  </Button>
                                ) : null}
                                {canAccept ? (
                                  <Button size="sm" className="rounded-xl" onClick={() => acceptBattleMutation.mutate(battle.id)}>
                                    Прийняти
                                  </Button>
                                ) : null}
                                {canDecline ? (
                                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => declineBattleMutation.mutate(battle.id)}>
                                    Відхилити
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          ) : (
                            <p>{item.content}</p>
                          )}

                          {mine ? (
                            <div className="mt-2 flex items-center justify-end gap-1 text-[11px] opacity-80">
                              {item.is_read ? (
                                <>
                                  <CheckCheck className="h-3.5 w-3.5" />
                                  Прочитано
                                </>
                              ) : (
                                <>
                                  <Check className="h-3.5 w-3.5" />
                                  Відправлено
                                </>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                    Почніть розмову першими.
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Input placeholder="Написати повідомлення" value={message} onChange={(event) => setMessage(event.target.value)} />
                <Button disabled={!message.trim() || messageMutation.isPending} onClick={() => messageMutation.mutate({ to_user: selectedFriend, content: message.trim(), type: 'text' })}>
                  <Send className="mr-2 h-4 w-4" />
                  Надіслати
                </Button>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
              Оберіть друга зліва, щоб побачити переписку.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FriendRequest({ invite, onAccept, onReject, outgoing = false }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/70">
      <div className="flex items-center gap-3">
        <Avatar user={invite.user} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900 dark:text-white">{invite.user?.full_name || `${invite.user?.name || ''} ${invite.user?.surname || ''}`.trim()}</p>
          <p className="truncate text-sm text-slate-500 dark:text-slate-300">@{invite.user?.username || 'unknown'}</p>
        </div>
        <Button asChild size="sm" variant="outline" className="rounded-xl">
          <Link to={invite.user?.username ? `/u/${invite.user.username}` : `/users/${invite.user?.id}`}>Профіль</Link>
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {!outgoing ? (
          <Button size="sm" className="rounded-xl" onClick={onAccept}>
            <UserCheck className="mr-2 h-4 w-4" />
            Прийняти
          </Button>
        ) : null}
        <Button size="sm" variant="outline" className="rounded-xl" onClick={onReject}>
          {outgoing ? <UserMinus className="mr-2 h-4 w-4" /> : <X className="mr-2 h-4 w-4" />}
          {outgoing ? 'Скасувати' : 'Відхилити'}
        </Button>
      </div>
    </div>
  );
}

function Avatar({ user, small = false }) {
  const resolved = withVersion(user?.avatar_url, user?.avatar_version);
  const size = small ? 'h-10 w-10 rounded-xl' : 'h-12 w-12 rounded-2xl';
  const frameClass = cn(
    size,
    'overflow-hidden p-[2px]',
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
    (!user?.active_frame || user?.active_frame === 'default') && 'bg-[linear-gradient(135deg,#dbeafe,#93c5fd)]',
  );

  return (
    <div className={frameClass}>
      <div className="h-full w-full overflow-hidden rounded-[inherit] bg-slate-200 dark:bg-slate-700">
        {resolved ? <img src={resolved} alt={user?.full_name || user?.name || user?.username || 'avatar'} className="h-full w-full object-cover" /> : null}
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
