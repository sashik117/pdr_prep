// @ts-check
import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Trash2, User2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import api from '@/api/apiClient';

/**
 * @param {{
 *   avatarUrl?: string | null,
 *   activeFrame?: string,
 *   onAvatarChange?: (user: any) => void,
 *   editable?: boolean
 * }} props
 */
export default function AvatarUpload({ avatarUrl = null, activeFrame = '', onAvatarChange, editable = true }) {
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(/** @type {string | null} */ (null));
  const [imageBroken, setImageBroken] = useState(false);
  const { toast } = useToast();
  const displayedAvatar = previewUrl || avatarUrl || null;
  const isBusy = uploading || deleting;
  const hasFrame = Boolean(activeFrame && activeFrame !== 'default');
  const frameClass = cn(
    'flex h-24 w-24 items-center justify-center rounded-[28px] transition',
    hasFrame ? 'p-[5px]' : 'border border-slate-200 bg-transparent p-0 dark:border-slate-700',
    activeFrame === 'fire' && 'bg-[linear-gradient(135deg,#fb7185,#f97316)]',
    activeFrame === 'sun' && 'bg-[linear-gradient(135deg,#facc15,#fb7185)]',
    activeFrame === 'gold' && 'bg-[linear-gradient(135deg,#f59e0b,#fde68a)]',
    activeFrame === 'diamond' && 'bg-[linear-gradient(135deg,#38bdf8,#22d3ee)]',
    activeFrame === 'speed' && 'bg-[linear-gradient(135deg,#60a5fa,#2563eb)]',
    activeFrame === 'crown' && 'bg-[linear-gradient(135deg,#fbbf24,#f59e0b)]',
    activeFrame === 'galaxy' && 'bg-[linear-gradient(135deg,#312e81,#7c3aed,#ec4899)]',
    activeFrame === 'platinum' && 'bg-[linear-gradient(135deg,#cbd5e1,#94a3b8)]',
    activeFrame === 'mint' && 'bg-[linear-gradient(135deg,#34d399,#10b981)]',
    activeFrame === 'sunset' && 'bg-[linear-gradient(135deg,#fb7185,#f59e0b)]',
    activeFrame === 'neon' && 'bg-[linear-gradient(135deg,#d946ef,#8b5cf6)]',
    activeFrame === 'aurora' && 'bg-[linear-gradient(135deg,#22d3ee,#34d399)]',
  );

  useEffect(() => {
    setImageBroken(false);
  }, [avatarUrl, previewUrl]);

  useEffect(() => () => {
    if (previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
  }, [previewUrl]);

  /**
   * @param {File} file
   * @returns {File}
   */
  const normalizeUploadFile = (file) => {
    const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : '';
    const safeExt = extension && ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(extension) ? extension : 'png';
    const randomId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return new File([file], `${randomId}.${safeExt}`, { type: file.type || `image/${safeExt === 'jpg' ? 'jpeg' : safeExt}` });
  };

  /** @param {import('react').ChangeEvent<HTMLInputElement>} event */
  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : '';
    const supportedByExtension = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(extension || '');
    if (file.type && !file.type.startsWith('image/') && !supportedByExtension) {
      toast({ title: 'Невірний формат', description: 'Оберіть PNG, JPG, WEBP, GIF або BMP.', variant: 'destructive' });
      event.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Файл завеликий', description: 'Максимальний розмір аватарки - 5MB.', variant: 'destructive' });
      event.target.value = '';
      return;
    }

    const safeFile = normalizeUploadFile(file);
    const nextPreviewUrl = URL.createObjectURL(file);
    if (previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(nextPreviewUrl);
    setUploading(true);
    try {
      const response = await api.uploadAvatar(safeFile);
      setPreviewUrl(null);
      if (typeof onAvatarChange === 'function') {
        onAvatarChange(response);
      }
      toast({ title: 'Аватарку оновлено' });
    } catch (value) {
      setPreviewUrl(null);
      toast({
        title: 'Не вдалося завантажити аватарку',
        description: value instanceof Error ? value.message : 'Спробуйте ще раз.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleDeleteAvatar = async () => {
    if (!displayedAvatar || isBusy) return;
    setDeleting(true);
    try {
      const response = await api.deleteAvatar();
      if (previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
      setImageBroken(false);
      if (typeof onAvatarChange === 'function') {
        onAvatarChange(response);
      }
      toast({ title: 'Аватарку видалено' });
    } catch (value) {
      toast({
        title: 'Не вдалося видалити аватарку',
        description: value instanceof Error ? value.message : 'Спробуйте ще раз.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="relative h-24 w-24 shrink-0">
      <button
        type="button"
        className={frameClass}
        onClick={() => editable && !isBusy && inputRef.current?.click()}
        aria-label="Змінити аватарку"
      >
        <div className="h-full w-full overflow-hidden rounded-[22px] bg-slate-100 dark:bg-slate-800">
          {displayedAvatar && !imageBroken ? (
            <img
              src={displayedAvatar}
              alt="Avatar"
              width={192}
              height={192}
              decoding="async"
              className="h-full w-full object-cover [backface-visibility:hidden]"
              onError={() => setImageBroken(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <User2 className="h-9 w-9 text-slate-400" />
            </div>
          )}
        </div>
      </button>

      {editable ? (
        <>
          {displayedAvatar ? (
            <button
              type="button"
              className="absolute -bottom-2 -left-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-rose-600 shadow-lg ring-4 ring-white transition hover:bg-rose-50 disabled:opacity-70 dark:bg-slate-900 dark:text-rose-300 dark:ring-slate-950 dark:hover:bg-rose-950/30"
              onClick={handleDeleteAvatar}
              disabled={isBusy}
              aria-label="Видалити аватарку"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
          ) : null}
          <button
            type="button"
            className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-white transition disabled:opacity-70 dark:ring-slate-950"
            onClick={() => inputRef.current?.click()}
            disabled={isBusy}
            aria-label="Змінити аватарку"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          </button>
        </>
      ) : null}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}
