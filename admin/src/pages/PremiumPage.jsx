// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock3, Crown, Play, Save, Sparkles, Square, WalletCards } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import api from '@/api/apiClient';
import { AdminPageHeader, LoadingState, StatCard } from '@admin/components/AdminCards';
import { formatAdminDate, resolveUserName } from '@admin/admin-utils';

const planLabels = {
  1: '1 місяць',
  3: '3 місяці',
  6: '6 місяців',
  12: '12 місяців',
};

const defaultDraft = {
  duration_days: 15,
  never_ends: false,
  promo_prices: { 1: 159, 3: 469, 6: 950, 12: 1900 },
  regular_prices: { 1: 300, 3: 900, 6: 1800, 12: 3600 },
};

function isPaidOrder(order) {
  return order?.status === 'paid' || order?.status === 'activated';
}

export default function PremiumPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(defaultDraft);
  const [featuresDraft, setFeaturesDraft] = useState([]);

  const promoQuery = useQuery({ queryKey: ['admin-promo-status'], queryFn: () => api.getPromoStatus() });
  const usersQuery = useQuery({ queryKey: ['admin-users'], queryFn: () => api.getAdminUsers() });
  const ordersQuery = useQuery({ queryKey: ['admin-premium-orders'], queryFn: () => api.getAdminPremiumOrders(80) });
  const featuresQuery = useQuery({ queryKey: ['admin-premium-features'], queryFn: () => api.getAdminPremiumFeatures() });
  const settingsQuery = useQuery({ queryKey: ['admin-premium-settings'], queryFn: () => api.getAdminPremiumSettings() });

  useEffect(() => {
    const status = promoQuery.data;
    if (!status) return;
    setDraft({
      duration_days: Number(status.duration_days || 15),
      never_ends: Boolean(status.never_ends),
      promo_prices: { ...(status.promo_prices || {}) },
      regular_prices: { ...(status.regular_prices || {}) },
    });
  }, [promoQuery.data]);

  useEffect(() => {
    if (featuresQuery.data) {
      setFeaturesDraft(featuresQuery.data);
    }
  }, [featuresQuery.data]);

  const invalidatePremiumData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-promo-status'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-premium-orders'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-premium-settings'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
    ]);
  };

  const saveMutation = useMutation({ mutationFn: (payload) => api.updatePromoConfig(payload), onSuccess: invalidatePremiumData });
  const startMutation = useMutation({ mutationFn: (payload) => api.startPromo(payload), onSuccess: invalidatePremiumData });
  const stopMutation = useMutation({ mutationFn: () => api.stopPromo(), onSuccess: invalidatePremiumData });
  const activateOrderMutation = useMutation({
    mutationFn: (orderId) => api.activateAdminPremiumOrder(orderId),
    onSuccess: invalidatePremiumData,
  });
  const saveFeaturesMutation = useMutation({
    mutationFn: (features) => api.updateAdminPremiumFeatures(features),
    onSuccess: async (payload) => {
      setFeaturesDraft(payload.features || []);
      await queryClient.invalidateQueries({ queryKey: ['admin-premium-features'] });
    },
  });
  const saveSettingsMutation = useMutation({
    mutationFn: (payload) => api.updateAdminPremiumSettings(payload),
    onSuccess: invalidatePremiumData,
  });

  const users = usersQuery.data || [];
  const orders = ordersQuery.data || [];
  const premiumUsers = users.filter((user) => user.is_premium).length;
  const paidOrders = orders.filter(isPaidOrder).length;
  const pendingOrders = orders.filter((order) => !isPaidOrder(order)).length;
  const totalRevenue = orders
    .filter(isPaidOrder)
    .reduce((sum, order) => sum + Number(order.amount || 0), 0) / 100;
  const secondsLeft = promoQuery.data?.seconds_left;
  const hoursLeft = secondsLeft === null || secondsLeft === undefined ? null : Math.floor(Number(secondsLeft || 0) / 3600);
  const premiumEnabled = settingsQuery.data?.premium_enabled !== false;

  const statusText = useMemo(() => {
    if (!promoQuery.data?.is_active) return 'Вимкнена';
    if (promoQuery.data?.never_ends) return 'Без завершення';
    return `${hoursLeft || 0} год.`;
  }, [hoursLeft, promoQuery.data?.is_active, promoQuery.data?.never_ends]);

  const updatePrice = (group, code, value) => {
    setDraft((current) => ({
      ...current,
      [group]: {
        ...current[group],
        [code]: Number(value || 0),
      },
    }));
  };

  const updateFeature = (index, key, value) => {
    setFeaturesDraft((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  };

  return (
    <div>
      <AdminPageHeader
        eyebrow="Premium"
        title="Premium-доступ, ціни та акції"
        description="Керуйте тарифами, акційними цінами, фічами Premium і заявками користувачів на оплату через mono Банку."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Crown} label="Premium-користувачі" value={premiumUsers} hint={`${users.length} акаунтів усього`} tone="amber" />
        <StatCard icon={Clock3} label="Акція" value={promoQuery.data?.is_active ? 'Активна' : 'Вимкнена'} hint={statusText} tone={promoQuery.data?.is_active ? 'green' : 'slate'} />
        <StatCard icon={WalletCards} label="Оплачені замовлення" value={paidOrders} hint={`${Math.round(totalRevenue)} грн у списку`} tone="blue" />
        <StatCard icon={Sparkles} label="Очікують підтвердження" value={pendingOrders} hint="Оплата через mono Банку" tone="violet" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Стан акції</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {promoQuery.isLoading ? <LoadingState /> : null}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="flex items-center justify-between gap-4">
                <p className="font-semibold">Поточний статус</p>
                <Badge className={promoQuery.data?.is_active ? 'bg-emerald-600' : 'bg-slate-600'}>
                  {promoQuery.data?.is_active ? 'Активна' : 'Вимкнена'}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {promoQuery.data?.is_active
                  ? promoQuery.data?.never_ends
                    ? 'Акція працює без автоматичного завершення, доки Ви не зупините її вручну.'
                    : `До завершення залишилось приблизно ${hoursLeft || 0} год.`
                  : 'Акція не показується користувачам, поки Ви її не запустите.'}
              </p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-950/20">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-950 dark:text-white">Premium на сайті</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                    Якщо вимкнути, платні обмеження зникають, а Premium-бейдж лишається тільки у тих, кому він реально виданий.
                  </p>
                </div>
                <Switch
                  checked={premiumEnabled}
                  disabled={settingsQuery.isLoading || saveSettingsMutation.isPending}
                  onCheckedChange={(value) => saveSettingsMutation.mutate({ premium_enabled: value })}
                />
              </div>
              <Badge className={`mt-3 ${premiumEnabled ? 'bg-amber-600' : 'bg-emerald-600'}`}>
                {premiumEnabled ? 'Paywall увімкнено' : 'Усе відкрито'}
              </Badge>
            </div>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Тривалість акції, днів</span>
              <Input
                type="number"
                min="1"
                max="60"
                disabled={draft.never_ends}
                value={draft.duration_days}
                onChange={(event) => setDraft((current) => ({ ...current, duration_days: Number(event.target.value || 15) }))}
              />
            </label>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Без дати завершення</p>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Акція йде безперервно, доки Ви її не зупините.</p>
              </div>
              <Switch checked={draft.never_ends} onCheckedChange={(value) => setDraft((current) => ({ ...current, never_ends: value }))} />
            </div>

            <div className="grid gap-2">
              <Button className="rounded-lg" disabled={startMutation.isPending} onClick={() => startMutation.mutate(draft)}>
                <Play className="mr-2 h-4 w-4" />
                Запустити акцію
              </Button>
              <Button variant="outline" className="rounded-lg" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate(draft)}>
                <Save className="mr-2 h-4 w-4" />
                Зберегти ціни
              </Button>
              <Button variant="destructive" className="rounded-lg" disabled={stopMutation.isPending} onClick={() => stopMutation.mutate()}>
                <Square className="mr-2 h-4 w-4" />
                Зупинити акцію
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Тарифи</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {Object.entries(planLabels).map(([code, label]) => (
                <div key={code} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950 dark:text-white">{label}</p>
                      <p className="text-xs text-slate-500">plan_code: {code}</p>
                    </div>
                    <Badge variant="secondary">UAH</Badge>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Звичайна</span>
                      <Input type="number" value={draft.regular_prices[code] ?? ''} onChange={(event) => updatePrice('regular_prices', code, event.target.value)} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Акційна</span>
                      <Input type="number" value={draft.promo_prices[code] ?? ''} onChange={(event) => updatePrice('promo_prices', code, event.target.value)} />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-lg font-semibold">Premium-фічі</CardTitle>
            <Button size="sm" className="rounded-lg" disabled={saveFeaturesMutation.isPending} onClick={() => saveFeaturesMutation.mutate(featuresDraft)}>
              <Save className="mr-2 h-4 w-4" />
              Зберегти
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {featuresQuery.isLoading ? <LoadingState /> : null}
            {featuresDraft.map((feature, index) => (
              <div key={feature.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-3">
                    <Input value={feature.title} onChange={(event) => updateFeature(index, 'title', event.target.value)} />
                    <Textarea rows={2} value={feature.description} onChange={(event) => updateFeature(index, 'description', event.target.value)} />
                  </div>
                  <Switch checked={Boolean(feature.is_enabled)} onCheckedChange={(value) => updateFeature(index, 'is_enabled', value)} />
                </div>
                <p className="mt-2 text-xs text-slate-500">id: {feature.id}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Останні замовлення</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ordersQuery.isLoading ? <LoadingState /> : null}
            {orders.slice(0, 12).map((order) => {
              const paid = isPaidOrder(order);
              return (
                <div key={order.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{resolveUserName(order)}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{order.email || 'без email'}</p>
                    </div>
                    <Badge className={paid ? 'bg-emerald-600' : 'bg-amber-600'}>
                      {paid ? 'оплачено' : 'очікує'}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span>Тариф: {planLabels[order.plan_code] || order.plan_code}</span>
                    <span className="text-right">{Math.round(Number(order.amount || 0) / 100)} {order.currency || 'UAH'}</span>
                    <span>Провайдер: {order.provider || 'manual'}</span>
                    <span className="text-right">Створено: {formatAdminDate(order.created_at)}</span>
                  </div>
                  {!paid ? (
                    <Button
                      size="sm"
                      className="mt-3 w-full rounded-lg bg-emerald-600 hover:bg-emerald-700"
                      disabled={activateOrderMutation.isPending}
                      onClick={() => activateOrderMutation.mutate(order.id)}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Активувати Premium
                    </Button>
                  ) : null}
                </div>
              );
            })}
            {!ordersQuery.isLoading && !orders.length ? (
              <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-800">
                Замовлень Premium поки немає.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
