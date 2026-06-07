import { PlayCircle } from 'lucide-react';
import { useState } from 'react';

function getYouTubeId(url) {
  if (url.hostname.includes('youtu.be')) {
    return url.pathname.split('/').filter(Boolean)[0] || '';
  }
  if (url.searchParams.get('v')) {
    return url.searchParams.get('v') || '';
  }
  const embedMatch = url.pathname.match(/\/embed\/([^/?#]+)/);
  if (embedMatch) {
    return embedMatch[1] || '';
  }
  return '';
}

function normalizeEmbedUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value, window.location.origin);
    if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
      const videoId = getYouTubeId(url);
      if (videoId) {
        const embed = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
        embed.searchParams.set('rel', '0');
        embed.searchParams.set('modestbranding', '1');
        embed.searchParams.set('controls', '0');
        embed.searchParams.set('showinfo', '0');
        embed.searchParams.set('fs', '0');
        embed.searchParams.set('iv_load_policy', '3');
        embed.searchParams.set('playsinline', '1');
        embed.searchParams.set('disablekb', '1');
        embed.searchParams.set('cc_load_policy', '0');
        return embed.toString();
      }
      url.hostname = 'www.youtube-nocookie.com';
      url.searchParams.delete('enablejsapi');
      url.searchParams.delete('origin');
      url.searchParams.set('rel', '0');
      url.searchParams.set('modestbranding', '1');
      url.searchParams.set('controls', '0');
      url.searchParams.set('showinfo', '0');
      url.searchParams.set('fs', '0');
      url.searchParams.set('iv_load_policy', '3');
      url.searchParams.set('playsinline', '1');
      url.searchParams.set('disablekb', '1');
      url.searchParams.set('cc_load_policy', '0');
    }
    return url.toString();
  } catch {
    return value;
  }
}

/**
 * @param {{ title: string; embedUrl?: string; videoUrl?: string }} props
 */
export default function TheoryVideoPanel({ title, embedUrl = '', videoUrl = '' }) {
  const [loaded, setLoaded] = useState(false);
  if (!embedUrl && !videoUrl) return null;
  const safeEmbedUrl = normalizeEmbedUrl(embedUrl || videoUrl);

  return (
    <div className="overflow-hidden rounded-xl bg-card p-2 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 sm:p-3">
      <div className="hidden">
        <PlayCircle className="h-4 w-4 text-primary" />
        Відео до теми
      </div>

      <div>
        {safeEmbedUrl ? (
          <div className="relative aspect-video overflow-hidden rounded-lg bg-slate-950 shadow-sm">
            {loaded ? (
              <>
                <div className="pointer-events-auto absolute left-0 top-0 z-10 h-[22%] w-full bg-transparent" />
                <div className="pointer-events-auto absolute bottom-0 right-0 z-10 h-[18%] w-[34%] bg-transparent" />
                <iframe
                  src={safeEmbedUrl}
                  title={`Відео: ${title}`}
                  className="absolute left-0 top-[-82px] h-[calc(100%+146px)] w-full border-0 bg-slate-950 sm:top-[-96px] sm:h-[calc(100%+172px)]"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  sandbox="allow-scripts allow-same-origin allow-presentation"
                />
              </>
            ) : (
              <button
                type="button"
                onClick={() => setLoaded(true)}
                className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-slate-950 px-5 text-center text-white transition-colors hover:bg-slate-900"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <PlayCircle className="h-6 w-6" />
                </span>
                <span className="text-base font-medium">Відкрити відео</span>
                <span className="max-w-md text-sm leading-6 text-slate-300">
                  Натисніть на плеєр, щоб завантажити відео. Так сторінка працює швидше й комфортніше на телефоні.
                </span>
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            Відео тимчасово недоступне. Спробуйте відкрити цей розділ трохи пізніше.
          </div>
        )}
      </div>
    </div>
  );
}
