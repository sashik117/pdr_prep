import { useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles, Star } from 'lucide-react';
import { FRAMES } from '@/lib/achievements';
import { cn } from '@/lib/utils';

const FRAME_PRESETS = {
  ...FRAMES,
  default: { label: 'Без рамки', style: 'ring-0' },
  mint: { label: 'Mint', style: 'ring-4 ring-emerald-400 ring-offset-2 shadow-lg shadow-emerald-300/50' },
  sunset: { label: 'Sunset', style: 'ring-4 ring-rose-400 ring-offset-2 shadow-lg shadow-orange-300/50' },
  neon: { label: 'Neon', style: 'ring-4 ring-fuchsia-500 ring-offset-2 shadow-lg shadow-fuchsia-400/50' },
  aurora: { label: 'Aurora', style: 'ring-4 ring-cyan-400 ring-offset-2 shadow-lg shadow-sky-300/60' },
};

const FRAME_PRESETS_MAP = FRAME_PRESETS;

function sortFrames(a, b) {
  if (a.id === 'default') return -1;
  if (b.id === 'default') return 1;
  const aKind = a.achievement_id ? 2 : 1;
  const bKind = b.achievement_id ? 2 : 1;
  return aKind - bKind || a.price - b.price;
}

function normalizeItems(items = []) {
  return items
    .filter((item, index, list) => item?.id && FRAME_PRESETS_MAP[item.id] && list.findIndex((entry) => entry?.id === item.id) === index)
    .map((item) => ({
      id: item.id,
      unlocked: Boolean(item.unlocked),
      purchased: Boolean(item.purchased),
      can_purchase: Boolean(item.can_purchase),
      price: Number(item.price || 0),
      achievement_id: item.achievement_id || null,
      label: item.label || FRAME_PRESETS_MAP[item.id].label,
      style: FRAME_PRESETS_MAP[item.id].style,
    }))
    .sort(sortFrames);
}

export default function FramePicker({
  unlockedFrames = ['default'],
  activeFrame = 'default',
  onSelect,
  shopItems = [],
  availableStars = 0,
  onPurchase,
  purchasingFrameId = null,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const normalizedShop = normalizeItems(shopItems);
  const fallbackItems = unlockedFrames
    .filter((frame, index, list) => frame in FRAME_PRESETS && list.indexOf(frame) === index)
    .map((frame) => ({
      id: frame,
      unlocked: true,
      purchased: false,
      can_purchase: false,
      price: 0,
      achievement_id: null,
      label: FRAME_PRESETS[frame].label,
      style: FRAME_PRESETS[frame].style,
    }))
    .sort(sortFrames);
  const frames = normalizedShop.length > 0 ? normalizedShop : fallbackItems;

  return (
    <div className="space-y-4">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left shadow-sm transition-all hover:border-primary/20 hover:bg-primary/5 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary/30 dark:hover:bg-slate-800"
        onClick={() => setIsOpen((value) => !value)}
      >
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">Рамки профілю</p>
          <p className="text-xs text-slate-500 dark:text-slate-300">Спочатку рамки за зірки, нижче — рамки за досягнення.</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200 sm:inline-flex">
            <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
            {availableStars}
          </div>
          {isOpen ? <ChevronUp className="h-4 w-4 text-slate-500 dark:text-slate-300" /> : <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-300" />}
        </div>
      </button>

      {isOpen ? (
        frames.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {frames.map((frame) => {
              const selected = frame.id === activeFrame || (!activeFrame && frame.id === 'default');
              const unlocked = frame.unlocked || frame.id === 'default';
              const canBuy = !unlocked && frame.can_purchase;
              const loading = purchasingFrameId === frame.id;
              return (
                <div
                  key={frame.id}
                  className={cn(
                    'rounded-xl border bg-white p-4 text-left transition-all duration-200 dark:bg-slate-950',
                    selected ? 'border-primary bg-primary/5 shadow-[0_12px_28px_rgba(20,107,255,0.12)]' : 'border-slate-200 dark:border-slate-700',
                    !unlocked && 'opacity-90',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn('flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300', frame.id !== 'default' && frame.style)}>
                      A
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-slate-900 dark:text-white">{frame.label}</p>
                        {unlocked ? (
                          <span className="rounded-md bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
                            Відкрита
                          </span>
                        ) : frame.achievement_id ? (
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                            За досягнення
                          </span>
                        ) : (
                          <span className="rounded-md bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                            {frame.price} зірок
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">
                        {selected
                          ? 'Активний варіант'
                          : unlocked
                            ? 'Натисніть, щоб вибрати'
                            : frame.achievement_id
                              ? 'Відкривається після потрібного досягнення'
                              : 'Можна купити за зірки'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    {unlocked ? (
                      <button
                        type="button"
                        className={cn(
                          'w-full rounded-lg border px-3 py-2 text-sm font-semibold transition-all',
                          selected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
                        )}
                        onClick={() => onSelect?.(frame.id)}
                      >
                        {selected ? 'Обрано' : 'Вибрати'}
                      </button>
                    ) : canBuy ? (
                      <button
                        type="button"
                        className="flex w-full items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 transition-all hover:bg-amber-100 disabled:opacity-60 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200"
                        disabled={availableStars < frame.price || loading}
                        onClick={() => onPurchase?.(frame.id)}
                      >
                        {loading ? <Sparkles className="mr-2 h-4 w-4 animate-spin" /> : <Star className="mr-2 h-4 w-4 fill-amber-400 text-amber-500" />}
                        {availableStars < frame.price ? 'Не вистачає зірок' : 'Купити рамку'}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            Поки що доступний тільки варіант без рамки.
          </div>
        )
      ) : null}
    </div>
  );
}
