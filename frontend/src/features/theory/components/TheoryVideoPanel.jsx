import { PlayCircle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

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
        return embed.toString();
      }
      url.hostname = 'www.youtube-nocookie.com';
      url.searchParams.delete('enablejsapi');
      url.searchParams.delete('origin');
      url.searchParams.set('rel', '0');
      url.searchParams.set('modestbranding', '1');
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
    <div className="overflow-hidden rounded-lg bg-card shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
      <div className="flex items-center gap-2 bg-sky-50/70 px-4 py-3 text-sm font-medium text-slate-900 dark:bg-sky-950/20 dark:text-white sm:px-5">
        <PlayCircle className="h-4 w-4 text-primary" />
        Відео до теми
      </div>

      <div className="p-3 sm:p-5">
        {safeEmbedUrl ? (
          <div className="overflow-hidden rounded-lg bg-slate-950 shadow-sm">
            {loaded ? (
              <iframe
                src={safeEmbedUrl}
                title={`Відео: ${title}`}
                className="aspect-video w-full bg-slate-950"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
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
          <Button asChild variant="outline" className="rounded-lg">
            <a href={videoUrl} target="_blank" rel="noreferrer">
              Відкрити відео
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
