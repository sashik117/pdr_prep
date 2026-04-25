// @ts-check
import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, User2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { FRAMES } from '@/lib/achievements';
import api from '@/api/apiClient';

/**
 * @param {{
 *   avatarUrl?: string | null,
 *   activeFrame?: keyof typeof FRAMES,
 *   onAvatarChange?: (avatarUrl: string | null) => void,
 *   editable?: boolean
 * }} props
 */
export default function AvatarUpload({ avatarUrl = null, activeFrame = 'default', onAvatarChange, editable = true }) {
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(/** @type {string | null} */ (null));
  const [imageBroken, setImageBroken] = useState(false);
  const { toast } = useToast();
  const frameStyle = FRAMES[activeFrame] ? FRAMES[activeFrame].style : FRAMES.default.style;
  const displayedAvatar = previewUrl || avatarUrl || null;

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
    const safeExt = extension && ['png', 'jpg', 'jpeg', 'webp'].includes(extension) ? extension : 'png';
    return new File([file], `${crypto.randomUUID()}.${safeExt}`, { type: file.type || `image/${safeExt}` });
  };

  /** @param {import('react').ChangeEvent<HTMLInputElement>} event */
  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Невірний формат', description: 'Оберіть PNG, JPG або WEBP.', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Файл завеликий', description: 'Максимальний розмір аватара — 5MB.', variant: 'destructive' });
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
        onAvatarChange(response.avatar_url || null);
      }
      toast({ title: 'Аватар оновлено' });
    } catch (value) {
      setPreviewUrl(null);
      toast({
        title: 'Не вдалося завантажити аватар',
        description: value instanceof Error ? value.message : 'Спробуйте ще раз.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="relative h-24 w-24 shrink-0">
      <button
        type="button"
        className={cn('flex h-24 w-24 items-center justify-center rounded-[26px] bg-slate-100 p-[3px] transition', frameStyle)}
        onClick={() => editable && inputRef.current?.click()}
      >
        <div className="h-full w-full overflow-hidden rounded-[22px] bg-slate-100 dark:bg-slate-800">
          {displayedAvatar && !imageBroken ? (
            <img
              src={displayedAvatar}
              alt="Avatar"
              className="h-full w-full object-cover"
              onError={() => setImageBroken(true)}
            />
          ) : <div className="flex h-full w-full items-center justify-center"><User2 className="h-9 w-9 text-slate-400" /></div>}
        </div>
      </button>
      {editable ? (
        <button
          type="button"
          className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        </button>
      ) : null}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}
