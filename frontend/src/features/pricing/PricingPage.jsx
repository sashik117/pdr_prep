import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  Crown,
  ExternalLink,
  Flame,
  MessageCircle,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Swords,
  Ticket,
  WalletCards,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import api from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { hasPremiumAccess } from '@/lib/accessLimits';

const freeFeatures = [
  '3 безкоштовні тести на день у кожному режимі.',
  '3 безкоштовні батли на день.',
  'Базовий доступ до теорії та стартових білетів.',
  'Оглядова аналітика та збереження прогресу.',
];

const premiumFeatures = [
  { icon: Ticket, label: 'Усі білети без денних обмежень і повний режим проходження.' },
  { icon: PlayCircle, label: 'Відеолекції та відеопояснення до навчальних матеріалів.' },
  { icon: BarChart3, label: 'Повна аналітика, історія спроб і розбір слабких тем.' },
  { icon: Flame, label: 'Необмежені тести без free-лімітів.' },
  { icon: Swords, label: 'Батли без денних обмежень і повний соціальний режим.' },
];

const defaultPromoStatus = {
  is_active: false,
  seconds_left: 0,
  show_strikethrough: false,
  current_prices: { '1': 300, '3': 900, '6': 1620, '12': 3060 },
  original_prices: { '1': 300, '3': 900, '6': 1800, '12': 3600 },
  plans: [
    { code: '1', slug: 'monthly', title: 'Premium на 1 місяць', months: 1, current_price: 300, original_price: 300 },
    { code: '3', slug: 'quarterly', title: 'Premium на 3 місяці', months: 3, current_price: 900, original_price: 900 },
    { code: '6', slug: 'half_year', title: 'Premium на 6 місяців', months: 6, current_price: 1620, original_price: 1800 },
    { code: '12', slug: 'yearly', title: 'Premium на 1 рік', months: 12, current_price: 3060, original_price: 3600 },
  ],
};

const comparisonRows = [
  ['Доступ до всіх питань', 'Базовий рівень', 'Повний доступ'],
  ['Тести за темами', '3 на день', 'Необмежено'],
  ['Тренувальні білети', '3 для перегляду', 'Необмежено'],
  ['Іспит МВС', '—', 'Так'],
  ['Інтервальне повторення', '—', 'Так'],
  ['Детальний аналіз помилок', '—', 'Так'],
  ['Без реклами', '—', 'Так'],
];

const monoJarUrl = (import.meta.env.VITE_MONO_JAR_URL || 'https://send.monobank.ua/jar/6ZbdN2qmww').trim();
const monoJarCard = (import.meta.env.VITE_MONO_JAR_CARD || '4874100039599223').replace(/\s+/g, '').trim();
const monoJarDescription = (
  import.meta.env.VITE_MONO_JAR_DESCRIPTION ||
  'DrivePrep преміум. У коментарі вкажіть email профілю та тариф: 1, 3, 6 або 12 місяців.'
).trim();

function formatCardNumber(cardNumber) {
  return String(cardNumber || '').replace(/(\d{4})(?=\d)/g, '$1 ');
}

function submitLiqPayCheckout(payload) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = payload.checkout_action;
  form.acceptCharset = 'utf-8';
  form.style.display = 'none';

  [['data', payload.data], ['signature', payload.signature]].forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
  form.remove();
}

function formatPrice(amount) {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));
}

function formatTimer(totalSeconds) {
  const secondsLeft = Math.max(0, Number(totalSeconds || 0));
  const days = Math.floor(secondsLeft / 86400);
  const hours = Math.floor((secondsLeft % 86400) / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;
  return `${days}д ${hours}г ${minutes}хв ${seconds}с`;
}

function planSubtitle(months) {
  if (months === 1) return 'Швидка підготовка перед іспитом';
  if (months === 3) return 'Стабільний темп для щоденної практики';
  if (months === 6) return 'Оптимальний варіант для тривалої підготовки';
  return 'Річний доступ для системного навчання';
}

function calculateDiscount(currentPrice, originalPrice) {
  if (!originalPrice || currentPrice >= originalPrice) return 0;
  return Math.round((1 - currentPrice / originalPrice) * 100);
}

export default function PricingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, isAuthenticated, navigateToLogin, checkUserAuth } = useAuth();
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [selectedPlanCode, setSelectedPlanCode] = useState(null);
  const isPremium = hasPremiumAccess(user);

  const promoStatusQuery = useQuery({
    queryKey: ['promo-status'],
    queryFn: api.getPromoStatus,
    initialData: defaultPromoStatus,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const checkoutMutation = useMutation({
    mutationFn: async (planCode) => {
      return api.createPremiumCheckout(planCode, `${window.location.origin}/pricing?checkout=success`);
    },
    onSuccess: async (result) => {
      if (result?.provider === 'mock' || result?.mock_checkout) {
        toast({
          title: 'Оплату не налаштовано',
          description: 'Premium не активовано. Створіть mono-заявку або підтвердьте доступ в адмінці.',
          variant: 'destructive',
        });
        return;
      }

      if (result?.status === 'paid') {
        await checkUserAuth();
        toast({
          title: 'Premium активовано',
          description: 'Доступ оновлено. Усі преміум-можливості вже відкриті.',
        });
        navigate('/pricing', { replace: true });
        return;
      }

      if (result?.provider === 'liqpay' && result?.data && result?.signature && result?.checkout_action) {
        submitLiqPayCheckout(result);
        return;
      }

      if (result?.provider === 'mono_manual') {
        const checkoutUrl = result.checkout_url || result.jar_url || monoJarUrl;
        if (checkoutUrl) {
          toast({
            title: 'Заявку на Premium створено',
            description: 'Ми вже записали Ваш профіль, тариф і суму. Після оплати адміністратор підтвердить доступ.',
          });
          window.location.assign(checkoutUrl);
          return;
        }
        toast({
          title: 'Заявку створено',
          description: 'Посилання на mono Банку ще не додано. Напишіть, будь ласка, у підтримку.',
        });
        return;
      }

      toast({
        title: 'Не вдалося підготувати оплату',
        description: 'Спробуйте ще раз або повторіть спробу трохи пізніше.',
        variant: 'destructive',
      });
    },
    onError: (error) => {
      toast({
        title: 'Помилка оформлення Premium',
        description: error instanceof Error ? error.message : 'Спробуйте ще раз трохи пізніше.',
        variant: 'destructive',
      });
    },
  });

  const promoStatus = promoStatusQuery.data || defaultPromoStatus;
  const plans = promoStatus.plans?.length ? promoStatus.plans : defaultPromoStatus.plans;
  const selectedPlan = selectedPlanCode ? plans.find((plan) => String(plan.code) === String(selectedPlanCode)) : null;

  useEffect(() => {
    setSecondsLeft(Number(promoStatus.seconds_left || 0));
  }, [promoStatus.seconds_left]);

  useEffect(() => {
    if (!promoStatus.is_active || secondsLeft <= 0) return undefined;

    const timerId = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timerId);
          void queryClient.invalidateQueries({ queryKey: ['promo-status'] });
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [promoStatus.is_active, secondsLeft, queryClient]);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const orderId = search.get('orderId');
    const checkout = search.get('checkout');
    if (!orderId || !checkout || isPremium || !isAuthenticated) return;

    let cancelled = false;
    const syncStatus = async () => {
      try {
        const status = await api.getPaymentStatus(orderId);
        if (cancelled) return;
        if (status?.order?.status === 'paid' || status?.is_premium) {
          await checkUserAuth();
          toast({
            title: 'Premium активовано',
            description: 'Оплату підтверджено. Повний доступ уже відкрито.',
          });
          navigate('/pricing', { replace: true });
        }
      } catch {
        // Нічого не показуємо: callback може прийти трохи пізніше.
      }
    };

    void syncStatus();
    return () => {
      cancelled = true;
    };
  }, [isPremium, isAuthenticated, checkUserAuth, toast, navigate]);

  const handlePlanClick = (planCode) => {
    if (isPremium) return;
    if (!isAuthenticated) {
      navigateToLogin('/pricing');
      return;
    }
    setSelectedPlanCode(planCode);
    setAcceptedTerms(false);
  };

  const handleConfirmPayment = () => {
    if (!selectedPlanCode) return;
    if (!acceptedTerms) {
      toast({
        title: 'Потрібна згода з умовами',
        description: 'Перед оформленням Premium підтвердьте, що ознайомилися з угодою підписника.',
        variant: 'destructive',
      });
      return;
    }
    const planCode = selectedPlanCode;
    setSelectedPlanCode(null);
    checkoutMutation.mutate(planCode);
  };

  const handleCopyMonoCard = async () => {
    if (!monoJarCard) return;
    try {
      await navigator.clipboard.writeText(monoJarCard);
      toast({
        title: 'Номер картки скопійовано',
        description: 'Можна вставити його в mono або інший банківський застосунок.',
      });
    } catch {
      toast({
        title: 'Не вдалося скопіювати номер',
        description: 'Скопіюйте номер картки вручну зі сторінки.',
        variant: 'destructive',
      });
    }
  };

  const featureList = useMemo(
    () => [
      'Повний доступ до відеолекцій і преміум-матеріалів.',
      'Необмежені тести, батли та повний режим білетів.',
      'Розширена аналітика, історія спроб і слабкі теми.',
      'Єдиний доступ на будь-якому пристрої через ваш профіль.',
    ],
    [],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 pb-6 sm:px-6">
      <section className="surface-glass overflow-hidden rounded-[2rem] border border-white/75 p-5 shadow-[0_30px_90px_rgba(15,23,42,0.10)] sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-3 rounded-full border border-amber-300/50 bg-white/85 px-5 py-2 text-sm font-semibold uppercase tracking-[0.22em] text-amber-700 shadow-sm dark:border-amber-400/30 dark:bg-slate-950/70 dark:text-amber-300">
              <Crown className="h-5 w-5" />
              Premium доступ
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white sm:text-5xl">
              Повний доступ до підготовки без денних обмежень
            </h1>
            <p className="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-300">
              Premium відкриває відеолекції, повну аналітику, усі білети, розширені навчальні матеріали, а також
              необмежені тести й батли для стабільної підготовки до іспиту ГСЦ МВС.
            </p>
          </div>

          <div className="self-end rounded-[1.8rem] border border-white/80 bg-white/80 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
            {promoStatus.is_active ? (
              <>
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                  <Clock3 className="h-4 w-4" />
                  Акція активна
                </div>
                <p className="mt-4 text-sm uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">До завершення</p>
                <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white">{formatTimer(secondsLeft)}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Після завершення акції сторінка автоматично покаже стандартні ціни без ручного оновлення.
                </p>
              </>
            ) : (
              <>
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <ShieldCheck className="h-4 w-4" />
                  Стандартний тариф
                </div>
                <p className="mt-4 text-sm uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Статус</p>
                <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white">Тарифи без обмеження за часом</p>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Обирайте зручний план і активуйте Premium у потрібний момент.
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="surface-glass border-white/85 shadow-[0_16px_45px_rgba(15,23,42,0.05)]">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-slate-950 dark:text-white">Безкоштовно</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {freeFeatures.map((feature) => (
              <div key={feature} className="flex items-start gap-3 rounded-2xl bg-slate-50/80 px-4 py-3 dark:bg-slate-900/80">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">{feature}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="surface-glass border-amber-200/70 shadow-[0_16px_45px_rgba(15,23,42,0.05)] dark:border-amber-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl font-semibold text-slate-950 dark:text-white">
              <Sparkles className="h-6 w-6 text-amber-500" />
              Що відкриває Premium
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {premiumFeatures.map((feature) => (
              <div key={feature.label} className="flex items-start gap-3 rounded-2xl bg-slate-50/80 px-4 py-3 dark:bg-slate-900/80">
                <feature.icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
                <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">{feature.label}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan, index) => {
          const discount = calculateDiscount(plan.current_price, plan.original_price);
          const highlighted = plan.code === '6' || plan.code === '12';

          return (
            <motion.div
              key={plan.code}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.45, delay: index * 0.04 }}
            >
              <Card
                className={cn(
                  'surface-glass overflow-hidden rounded-[1.9rem] shadow-[0_18px_55px_rgba(15,23,42,0.07)] transition-transform duration-300 hover:-translate-y-1',
                  highlighted ? 'border-amber-300/80 dark:border-amber-400/30' : 'border-white/85 dark:border-slate-800',
                )}
              >
                <CardHeader className="bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_42%)]">
                  <CardTitle className="flex items-start justify-between gap-3 text-2xl font-semibold text-slate-950 dark:text-white">
                    <span>{plan.months === 1 ? '1 місяць' : `${plan.months} місяців`}</span>
                    {promoStatus.show_strikethrough && discount > 0 ? (
                      <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">
                        -{discount}%
                      </span>
                    ) : null}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {promoStatus.show_strikethrough ? (
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400 line-through dark:text-slate-500">
                      {formatPrice(plan.original_price)}
                    </p>
                  ) : null}
                  <p className="mt-2 text-5xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white">{formatPrice(plan.current_price)}</p>
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-sky-700 dark:bg-sky-500/10 dark:text-sky-200">
                    <Sparkles className="h-3.5 w-3.5" />
                    {planSubtitle(plan.months)}
                  </div>
                  <div className="mt-6 space-y-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                    {featureList.slice(0, 3).map((feature) => (
                      <p key={`${plan.code}-${feature}`} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-500" />
                        <span>{feature}</span>
                      </p>
                    ))}
                  </div>
                  <div className="mt-6">
                    {isPremium ? (
                      <Button disabled className="w-full rounded-xl">У вас уже Premium</Button>
                    ) : (
                      <Button className="w-full rounded-xl" disabled={checkoutMutation.isPending} onClick={() => handlePlanClick(plan.code)}>
                        <Crown className="mr-2 h-4 w-4" />
                        {checkoutMutation.isPending ? 'Готуємо оплату...' : 'Отримати Premium'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {!isPremium ? (
        <Card className="overflow-hidden rounded-[1.9rem] border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-sky-50 shadow-[0_18px_55px_rgba(15,23,42,0.06)] dark:border-emerald-500/20 dark:from-emerald-950/24 dark:via-slate-950 dark:to-sky-950/18">
          <CardContent className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 shadow-sm ring-1 ring-emerald-100 dark:bg-slate-950/75 dark:text-emerald-200 dark:ring-emerald-500/20">
                <WalletCards className="h-4 w-4" />
                Ручна оплата
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
                  Premium через mono Банку
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                  Оберіть тариф вище, підтвердьте угоду підписника, і сайт створить заявку з Вашим профілем, сумою та
                  тарифом. Після цього відкриється mono Банка, а доступ активується адміністратором після перевірки
                  платежу.
                </p>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/90 bg-white/86 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.07)] dark:border-slate-800 dark:bg-slate-950/78">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                Опис для платежу
              </p>
              <p className="mt-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                {monoJarDescription}
              </p>
              {monoJarCard ? (
                <button
                  type="button"
                  onClick={handleCopyMonoCard}
                  className="mt-3 flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50/70 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-950/20"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <CreditCard className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Номер картки Банки
                      </span>
                      <span className="mt-0.5 block font-medium tabular-nums">{formatCardNumber(monoJarCard)}</span>
                    </span>
                  </span>
                  <Copy className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              ) : null}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {!isAuthenticated ? (
                  <Button asChild className="rounded-xl bg-sky-600 hover:bg-sky-700">
                    <Link to="/auth?tab=register&redirect=%2Fpricing">Створити профіль</Link>
                  </Button>
                ) : monoJarUrl ? (
                  <Button disabled className="rounded-xl">
                    Оберіть тариф вище
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button disabled className="rounded-xl">
                    Посилання ще не додано
                  </Button>
                )}
                <Button asChild variant="outline" className="rounded-xl bg-white/70 dark:bg-slate-950/40">
                  <Link to="/support">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Написати в підтримку
                  </Link>
                </Button>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Ручна оплата не активує Premium миттєво. Доступ відкривається після перевірки платежу адміністратором.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="surface-glass border-white/85 shadow-[0_16px_45px_rgba(15,23,42,0.05)]">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-slate-950 dark:text-white">Порівняння планів</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="hidden grid-cols-[1.4fr_0.8fr_0.8fr] bg-slate-100 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600 dark:bg-slate-900 dark:text-slate-300 sm:grid">
              <div className="px-4 py-4">Функція</div>
              <div className="border-l border-slate-200 px-4 py-4 text-center dark:border-slate-800">Безкоштовно</div>
              <div className="border-l border-slate-200 px-4 py-4 text-center dark:border-slate-800">Premium</div>
            </div>
            {comparisonRows.map(([feature, freeValue, premiumValue], index) => (
              <div
                key={feature}
                className={cn(
                  'grid gap-2 p-4 text-sm sm:grid-cols-[1.4fr_0.8fr_0.8fr] sm:gap-0 sm:p-0',
                  index % 2 === 0 ? 'bg-white dark:bg-slate-950/90' : 'bg-slate-50/80 dark:bg-slate-900/60',
                )}
              >
                <div className="font-medium text-slate-900 dark:text-white sm:px-4 sm:py-4">{feature}</div>
                <div className="flex items-center justify-between rounded-lg bg-slate-100/70 px-3 py-2 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300 sm:block sm:rounded-none sm:border-l sm:border-slate-200 sm:bg-transparent sm:px-4 sm:py-4 sm:text-center dark:sm:border-slate-800 dark:sm:bg-transparent">
                  <span className="text-xs uppercase tracking-[0.12em] text-slate-400 sm:hidden">Безкоштовно</span>
                  {freeValue}
                </div>
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 font-medium text-emerald-600 dark:bg-emerald-950/25 dark:text-emerald-300 sm:block sm:rounded-none sm:border-l sm:border-slate-200 sm:bg-transparent sm:px-4 sm:py-4 sm:text-center dark:sm:border-slate-800 dark:sm:bg-transparent">
                  <span className="text-xs uppercase tracking-[0.12em] text-emerald-500/70 sm:hidden">Premium</span>
                  {premiumValue}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="surface-glass border-amber-200/70 shadow-[0_16px_45px_rgba(15,23,42,0.05)] dark:border-amber-500/20">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-slate-950 dark:text-white">Як працює доступ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-8 text-slate-700 dark:text-slate-300">
            <p>У безкоштовному режимі доступні базові тести, стартові білети, основні матеріали теорії та оглядовий рівень аналітики.</p>
            <p>Premium знімає денні ліміти, відкриває відеолекції, повну аналітику, усі білети та повний навчальний контент.</p>
            <p>Після успішної оплати доступ активується для вашого профілю та автоматично працює на всіх пристроях, де ви увійшли у свій акаунт.</p>
          </CardContent>
        </Card>

        <Card className="surface-glass border-white/85 shadow-[0_16px_45px_rgba(15,23,42,0.05)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl font-semibold text-slate-950 dark:text-white">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              Після активації Premium
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              'Повна аналітика результатів і розділів.',
              'Необмежений доступ до режимів тестування.',
              'Усі білети та відеолекції без обмежень.',
              'Повний набір навчальних матеріалів і пояснень.',
            ].map((item) => (
              <div key={item} className="rounded-2xl bg-slate-50/80 px-4 py-3 text-sm leading-6 text-slate-700 dark:bg-slate-900/80 dark:text-slate-200">
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(selectedPlan)} onOpenChange={(open) => {
        if (!open) {
          setSelectedPlanCode(null);
          setAcceptedTerms(false);
        }
      }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] rounded-2xl border-white/80 bg-white p-0 text-slate-950 shadow-2xl dark:border-slate-800 dark:bg-slate-950 dark:text-white sm:max-w-lg">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <DialogTitle className="text-xl font-semibold tracking-[-0.03em]">Підтвердження Premium</DialogTitle>
            <DialogDescription className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Перевірте тариф і підтвердьте умови перед переходом до оплати.
            </DialogDescription>
          </div>
          <div className="space-y-4 px-5 py-5">
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/70">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Обраний тариф</p>
              <div className="mt-2 flex items-end justify-between gap-4">
                <div>
                  <p className="text-2xl font-semibold text-slate-950 dark:text-white">
                    {selectedPlan?.months === 1 ? '1 місяць' : `${selectedPlan?.months || ''} місяців`}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Заявка буде записана на Ваш профіль: {user?.email}</p>
                </div>
                <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-300">{formatPrice(selectedPlan?.current_price || 0)}</p>
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-200">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <span>
                Я ознайомився/ознайомилася з{' '}
                <Link to="/terms" className="font-medium text-primary underline-offset-4 hover:underline">
                  угодою підписника
                </Link>{' '}
                та розумію, що Premium через mono Банку активується після підтвердження оплати адміністратором.
              </span>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setSelectedPlanCode(null)}>
                Скасувати
              </Button>
              <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700" disabled={checkoutMutation.isPending} onClick={handleConfirmPayment}>
                {checkoutMutation.isPending ? 'Готуємо заявку...' : 'Перейти до оплати'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
