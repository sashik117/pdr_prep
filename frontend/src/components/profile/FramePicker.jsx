import { Sparkles, Star } from 'lucide-react';
import { FRAMES } from '@/lib/achievements';
import { cn } from '@/lib/utils';

const FRAME_PRESETS = {
  ...FRAMES,
  mint: { label: 'Mint', style: 'ring-4 ring-emerald-400 ring-offset-2 shadow-lg shadow-emerald-300/50' },
  sunset: { label: 'Sunset', style: 'ring-4 ring-rose-400 ring-offset-2 shadow-lg shadow-orange-300/50' },
  neon: { label: 'Neon', style: 'ring-4 ring-fuchsia-500 ring-offset-2 shadow-lg shadow-fuchsia-400/50' },
  aurora: { label: 'Aurora', style: 'ring-4 ring-cyan-400 ring-offset-2 shadow-lg shadow-sky-300/60' },
};

/** @typedef {keyof typeof FRAME_PRESETS} FrameKey */

/**
 * @param {Array<{ id: string, unlocked?: boolean, purchased?: boolean, can_purchase?: boolean, price?: number, achievement_id?: string, label?: string }>} items
 */
function normalizeItems(items = []) {
  return items
    .filter((item, index, list) => item?.id && FRAME_PRESETS[item.id] && list.findIndex((entry) => entry?.id === item.id) === index)
    .map((item) => ({
      id: item.id,
      unlocked: Boolean(item.unlocked),
      purchased: Boolean(item.purchased),
      can_purchase: Boolean(item.can_purchase),
      price: Number(item.price || 0),
      achievement_id: item.achievement_id || null,
      label: item.label || FRAME_PRESETS[item.id].label,
      style: FRAME_PRESETS[item.id].style,
    }));
}

/**
 * @param {{
 *   unlockedFrames?: FrameKey[],
 *   activeFrame?: FrameKey,
 *   onSelect?: (frame: FrameKey) => void,
 *   shopItems?: Array<{ id: string, unlocked?: boolean, purchased?: boolean, can_purchase?: boolean, price?: number, achievement_id?: string, label?: string }>,
 *   availableStars?: number,
 *   onPurchase?: (frameId: string) => void,
 *   purchasingFrameId?: string | null,
 * }} props
 */
export default function FramePicker({
  unlockedFrames = ['default'],
  activeFrame = 'default',
  onSelect,
  shopItems = [],
  availableStars = 0,
  onPurchase,
  purchasingFrameId = null,
}) {
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
    }));
  const frames = normalizedShop.length > 0 ? normalizedShop : fallbackItems;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-700">Рамки профілю</p>
          <p className="text-xs text-slate-500">Виберіть оформлення для аватарки з уже відкритих рамок або купіть нову за зірки.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
          <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
          Доступно зірок: {availableStars}
        </div>
      </div>

      {frames.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {frames.map((frame) => {
            const selected = frame.id === activeFrame;
            const unlocked = frame.unlocked;
            const canBuy = !unlocked && frame.can_purchase;
            const loading = purchasingFrameId === frame.id;
            return (
              <div
                key={frame.id}
                className={cn(
                  'rounded-2xl border bg-white p-4 text-left transition-all duration-200',
                  selected ? 'border-primary bg-primary/5 shadow-[0_12px_28px_rgba(20,107,255,0.12)]' : 'border-slate-200',
                  !unlocked && 'opacity-90',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-sm font-bold text-slate-500', frame.style)}>
                    A
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">{frame.label}</p>
                      {unlocked ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                          Відкрита
                        </span>
                      ) : frame.achievement_id ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
                          За досягнення
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                          {frame.price} зірок
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {selected
                        ? 'Активна рамка'
                        : unlocked
                          ? 'Натисніть, щоб вибрати'
                          : frame.achievement_id
                            ? 'Відкривається автоматично після потрібного досягнення'
                            : 'Можна купити за зірки без ідеального тесту не дістанеться'}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  {unlocked ? (
                    <button
                      type="button"
                      className={cn(
                        'w-full rounded-xl border px-3 py-2 text-sm font-semibold transition-all',
                        selected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-primary/30',
                      )}
                      onClick={() => onSelect?.(/** @type {FrameKey} */ (frame.id))}
                    >
                      {selected ? 'Обрана рамка' : 'Вибрати'}
                    </button>
                  ) : canBuy ? (
                    <button
                      type="button"
                      className="flex w-full items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 transition-all hover:bg-amber-100 disabled:opacity-60"
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
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          Поки що доступна лише стандартна рамка.
        </div>
      )}
    </div>
  );
}
