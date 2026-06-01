import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, ChevronDown, Crown, FileQuestion, Lock, PlayCircle, Ticket } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { categoryGroups } from '@/lib/testCatalog';

export default function TicketsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlCategory = searchParams.get('category') || 'B';
  const selectedCategory = categoryGroups.some((item) => item.id === urlCategory) ? urlCategory : 'B';
  const [categoryOpen, setCategoryOpen] = useState(false);
  const isPremium = Boolean(user?.is_premium);

  const selectedCategoryMeta = useMemo(
    () => categoryGroups.find((item) => item.id === selectedCategory) || categoryGroups[1],
    [selectedCategory],
  );
  const SelectedIcon = selectedCategoryMeta.icon;

  const ticketsQuery = useQuery({
    queryKey: ['tickets', selectedCategory],
    queryFn: () => api.getTickets(selectedCategory),
    staleTime: 5 * 60 * 1000,
  });

  const tickets = ticketsQuery.data?.tickets || [];

  const selectCategory = (categoryId) => {
    setSearchParams({ category: categoryId });
    setCategoryOpen(false);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-4 pb-8 sm:px-6 lg:px-8">
      <section className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl space-y-2">
            <Button type="button" variant="ghost" className="mb-2 -ml-2 gap-2 rounded-full px-3" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
              Назад
            </Button>
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-200">
              <Ticket className="h-7 w-7" />
            </div>
            <Badge variant="secondary" className="rounded-lg px-3 py-1.5 text-xs font-medium">
              Тренувальні білети
            </Badge>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white sm:text-4xl">
              Білети за логікою іспиту МВС
            </h1>
            <p className="max-w-3xl text-base leading-7 text-slate-600 dark:text-slate-300">
              Оберіть категорію посвідчення. За замовчуванням стоїть категорія B, а кожен білет містить 20 питань у структурі іспиту.
            </p>
          </div>

          <div className="relative w-full sm:w-[320px]">
            <button
              type="button"
              onClick={() => setCategoryOpen((value) => !value)}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-slate-200 bg-card px-4 py-3 text-left shadow-sm transition-colors hover:border-primary/35 dark:border-slate-800 dark:hover:border-sky-500/35"
              aria-expanded={categoryOpen}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-sky-400/10 dark:text-sky-200">
                <SelectedIcon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Категорія</span>
                <span className="block truncate text-sm font-medium text-slate-950 dark:text-white">{selectedCategoryMeta.label}</span>
              </span>
              <ChevronDown className={cn('h-5 w-5 shrink-0 text-slate-400 transition-transform', categoryOpen && 'rotate-180')} />
            </button>

            {categoryOpen ? (
              <div className="absolute right-0 z-30 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
                {categoryGroups.map((category) => {
                  const active = category.id === selectedCategory;
                  const Icon = category.icon;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                        active ? 'bg-primary/10 text-primary dark:bg-sky-400/10 dark:text-sky-200' : 'hover:bg-slate-50 dark:hover:bg-slate-900',
                      )}
                      onClick={() => selectCategory(category.id)}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-950 dark:text-white">{category.label}</span>
                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{category.hint}</span>
                      </span>
                      {active ? <Check className="h-4 w-4 shrink-0" /> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {ticketsQuery.isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-xl border border-slate-200 bg-slate-100/70 dark:border-slate-800 dark:bg-slate-900/70" />
          ))}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          {tickets.map((ticketItem, index) => {
            const locked = !isPremium && index >= 3;
            const href = locked ? '/pricing' : `/tickets/${ticketItem.ticket_number}?category=${selectedCategory}`;
            return (
              <motion.div key={ticketItem.ticket_number} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.015 }}>
                <Link to={href} className="block h-full">
                  <Card className="h-full border-2 border-transparent bg-card shadow-md transition-all hover:border-primary/35 hover:shadow-xl dark:border-slate-800 dark:hover:border-sky-500/40">
                    <CardContent className="flex min-h-[190px] flex-col justify-between gap-4 p-5 pt-6 text-left">
                      <div className="flex items-start justify-between gap-3">
                        <div className="mt-1 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-200">
                          {locked ? <Lock className="h-5 w-5" /> : <Ticket className="h-5 w-5" />}
                        </div>
                        {locked ? (
                          <Badge variant="secondary" className="rounded-lg bg-amber-500/12 text-amber-700 hover:bg-amber-500/12 dark:text-amber-200">
                            <Crown className="mr-1 h-3.5 w-3.5" />
                            Premium
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-lg border-emerald-200 text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-200">
                            Перегляд
                          </Badge>
                        )}
                      </div>
                      <div className="min-h-[54px]">
                        <h2 className="text-base font-medium text-slate-950 dark:text-white">Білет {ticketItem.ticket_number}</h2>
                        <p className="mt-1 inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                          <FileQuestion className="h-4 w-4" />
                          {ticketItem.questions_count} питань
                        </p>
                      </div>
                      <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-300">
                        {locked ? 'Відкривається з Premium' : <><PlayCircle className="h-3.5 w-3.5" />Відкрити білет</>}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}

      <Card className="border-slate-200 bg-card shadow-md dark:border-slate-800">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-950 dark:text-white">Без Premium доступні 3 білети для попереднього перегляду.</p>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Premium відкриває всі білети, проходження в режимі тесту та іспит МВС без денних обмежень.
            </p>
          </div>
          {!isPremium ? (
            <Link
              to="/pricing"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              <Crown className="h-4 w-4" />
              Переглянути Premium
            </Link>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
