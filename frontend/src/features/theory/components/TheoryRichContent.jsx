import { cn } from '@/lib/utils';
import { resolveApiUrl } from '@/api/apiClient';
import { useRef, useState } from 'react';

function normalizeInlineText(value) {
  return String(value || '')
    .replace(/^(\s*\d+(?:\.\d+)+)([A-Za-zА-Яа-яІіЇїЄєҐґ])/, '$1 $2')
    .replace(/^(\s*[a-zа-яіїєґ])/, (match) => match.toUpperCase());
}

function resolveTheoryHref(value) {
  const href = String(value || '').trim();
  if (!href || href === '#') return '';

  try {
    const url = new URL(href, window.location.origin);
    const path = url.pathname;

    if (/^\/study\/(?:rules|road-signs|road-markings)(?:\/|$)/i.test(path)) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
    if (path.includes('/znaky/')) {
      const match = path.match(/\/znaky\/(\d+)/i);
      return match ? `/study/road-signs/${match[1]}` : '/study/road-signs';
    }
    if (path.includes('/rozmitka/')) {
      const match = path.match(/\/rozmitka\/(\d+)/i);
      return match ? `/study/road-markings/${match[1]}` : '/study/road-markings';
    }
    if (/\/pdr\/33\/?$/i.test(path)) return '/study/rules/33';
    if (/\/pdr\/34\/?$/i.test(path)) return '/study/rules/34';
    if (path.includes('/test-pdd')) return '/tests';
    if (path.includes('/dovidniki')) return '/study/library';
    if (path.includes('/theory/road-signs') || path.includes('/road-signs')) return '/study/road-signs';
    if (path.includes('/theory/road-markings') || path.includes('/road-markings')) return '/study/road-markings';
    if (path.includes('/theory/regulator') || path.includes('/regulator')) return '/study/regulator';
    if (path.includes('/theory/traffic-light') || path.includes('/traffic-light')) return '/study/traffic-light';
    if (path.includes('/pdr') || path.includes('/rules')) return '/study/rules';

    if (url.origin === window.location.origin) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
    return url.toString();
  } catch {
    return href.startsWith('/') ? href : '';
  }
}

function getImageKind(img, src) {
  const signature = `${src || ''} ${img.getAttribute('title') || ''} ${img.getAttribute('alt') || ''}`.toLowerCase();
  if (
    /\/sign_\d+(?:_\d+)*\.(svg|png|jpg|jpeg|webp)$/i.test(signature) ||
    signature.includes('/images/theory/signs/') ||
    signature.includes('/uploads/signs/') ||
    signature.includes('sign_')
  ) {
    return 'sign';
  }
  if (
    /\/marking_\d+(?:_\d+)*\.(svg|png|jpg|jpeg|webp)$/i.test(signature) ||
    signature.includes('/images/theory/marking/') ||
    signature.includes('/uploads/marking/') ||
    signature.includes('marking_') ||
    signature.includes('розмітка')
  ) {
    return 'marking';
  }
  return 'illustration';
}

function normalizeTheoryIframeSrc(value) {
  try {
    const url = new URL(value, window.location.origin);
    if (!url.hostname.includes('youtube.com') && !url.hostname.includes('youtu.be')) return url.toString();
    const embedMatch = url.pathname.match(/\/embed\/([^/?#]+)/);
    const videoId = url.hostname.includes('youtu.be')
      ? url.pathname.split('/').filter(Boolean)[0]
      : (url.searchParams.get('v') || embedMatch?.[1] || '');
    if (!videoId) return '';
    const embed = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
    embed.searchParams.set('rel', '0');
    embed.searchParams.set('modestbranding', '1');
    embed.searchParams.set('controls', '1');
    embed.searchParams.set('showinfo', '0');
    embed.searchParams.set('fs', '0');
    embed.searchParams.set('iv_load_policy', '3');
    embed.searchParams.set('playsinline', '1');
    embed.searchParams.set('disablekb', '1');
    embed.searchParams.set('cc_load_policy', '0');
    return embed.toString();
  } catch {
    return '';
  }
}

function sanitizeHtml(html) {
  if (!html || typeof DOMParser === 'undefined') return html || '';

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(String(html), 'text/html');

    Array.from(doc.body.querySelectorAll('script, style, noscript, nav, footer')).forEach((node) => node.remove());
    Array.from(
      doc.body.querySelectorAll('.info-pdd.expert, .info-pdd.expert.history, .comment_question, .like_block, .buttons, .modal'),
    ).forEach((node) => node.remove());

    Array.from(doc.body.querySelectorAll('a')).forEach((link) => {
      const text = String(link.textContent || '').trim();
      if (/^\d{1,2}$/.test(text)) {
        link.replaceWith(...Array.from(link.childNodes));
        return;
      }
      link.removeAttribute('style');
      link.removeAttribute('class');
      const href = String(link.getAttribute('href') || '');
      const resolvedHref = resolveTheoryHref(href);
      if (!resolvedHref) {
        link.replaceWith(...Array.from(link.childNodes));
        return;
      }
      link.setAttribute('href', resolvedHref);
      if (/^https?:\/\//.test(resolvedHref)) {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      }
    });

    Array.from(doc.body.querySelectorAll('img, source')).forEach((node) => {
      const src = String(node.getAttribute('src') || '').trim();
      if (src.startsWith('/uploads/') || src.startsWith('/images/')) {
        const resolved = resolveApiUrl(src);
        if (resolved) {
          node.setAttribute('src', resolved);
        }
      }
    });

    const seenImageSrc = new Set();
    Array.from(doc.body.querySelectorAll('img')).forEach((img) => {
      const src = String(img.getAttribute('src') || '').trim();
      if (!src) {
        img.remove();
        return;
      }

      const imageKind = getImageKind(img, src);
      if (imageKind === 'illustration' && seenImageSrc.has(src)) {
        const parent = img.parentElement;
        if (parent?.tagName === 'A' && parent.childElementCount === 1) {
          parent.remove();
        } else {
          img.remove();
        }
        return;
      }
      seenImageSrc.add(src);

      img.setAttribute('data-media-kind', imageKind);

      img.setAttribute('loading', 'lazy');
      img.setAttribute('decoding', 'async');

      const parent = img.parentElement;
      if (parent?.tagName !== 'A') {
        const link = doc.createElement('a');
        link.setAttribute('href', src);
        link.setAttribute('data-theory-image-link', 'true');
        link.setAttribute('aria-label', 'Відкрити зображення');
        parent?.insertBefore(link, img);
        link.appendChild(img);
      } else {
        parent.setAttribute('href', src);
        parent.setAttribute('data-theory-image-link', 'true');
        parent.setAttribute('aria-label', 'Відкрити зображення');
        parent.removeAttribute('target');
        parent.removeAttribute('rel');
      }
    });

    Array.from(doc.body.querySelectorAll('iframe')).forEach((iframe) => {
      const src = normalizeTheoryIframeSrc(iframe.getAttribute('src') || '');
      if (!src) {
        iframe.remove();
        return;
      }
      const isYouTube = src.includes('youtube-nocookie.com/embed/');
      iframe.setAttribute('src', src);
      iframe.setAttribute('loading', 'lazy');
      iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
      iframe.removeAttribute('allowfullscreen');
      if (isYouTube && iframe.parentElement?.getAttribute('data-youtube-player') !== 'true') {
        const wrapper = doc.createElement('div');
        wrapper.setAttribute('data-youtube-player', 'true');
        const topShield = doc.createElement('div');
        topShield.setAttribute('data-youtube-shield', 'top');
        const logoShield = doc.createElement('div');
        logoShield.setAttribute('data-youtube-shield', 'logo');
        iframe.parentNode?.insertBefore(wrapper, iframe);
        wrapper.appendChild(topShield);
        wrapper.appendChild(logoShield);
        wrapper.appendChild(iframe);
      }
    });

    Array.from(doc.body.querySelectorAll('p, li, h3, h4, td, th, figcaption')).forEach((node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          child.textContent = normalizeInlineText(child.textContent || '');
        }
      });
    });

    Array.from(doc.body.querySelectorAll('*')).forEach((node) => {
      if (node.tagName !== 'IMG' && node.tagName !== 'IFRAME' && node.tagName !== 'A') {
        node.removeAttribute('style');
        node.removeAttribute('class');
      }
      node.removeAttribute('width');
      node.removeAttribute('height');
      node.removeAttribute('color');
      node.removeAttribute('bgcolor');
      node.removeAttribute('align');
    });

    Array.from(doc.body.querySelectorAll('table')).forEach((table) => {
      if (table.parentElement?.getAttribute('data-table-scroll') === 'true') return;
      const wrapper = doc.createElement('div');
      wrapper.setAttribute('data-table-scroll', 'true');
      table.parentNode?.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });

    return doc.body.innerHTML.trim();
  } catch {
    return html || '';
  }
}

/**
 * @param {{ html: string; className?: string }} props
 */
export default function TheoryRichContent({ html, className }) {
  const [previewImage, setPreviewImage] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);

  const handleContentClick = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const link = target?.closest('a[data-theory-image-link="true"]');
    if (!link) return;

    event.preventDefault();
    const image = link.querySelector('img');
    const src = link.getAttribute('href') || image?.getAttribute('src') || '';
    if (!src) return;

    setPreviewImage({
      src,
      alt: image?.getAttribute('alt') || image?.getAttribute('title') || 'Зображення з теорії',
    });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const startDrag = (clientX, clientY) => {
    dragRef.current = { clientX, clientY, x: offset.x, y: offset.y };
  };

  const moveDrag = (clientX, clientY) => {
    const drag = dragRef.current;
    if (!drag) return;
    setOffset({
      x: drag.x + clientX - drag.clientX,
      y: drag.y + clientY - drag.clientY,
    });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  return (
    <>
      <div
      onClick={handleContentClick}
      className={cn(
        'theory-rich-content',
        'min-w-0 max-w-full overflow-hidden break-words [&_*]:max-w-full [&_*]:break-words',
        '[&_h1]:hidden [&_h2]:hidden [&_h3]:mb-3 [&_h3]:mt-7 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:tracking-[-0.02em] [&_h3]:text-slate-950 dark:[&_h3]:text-white',
        '[&_h4]:mb-3 [&_h4]:mt-6 [&_h4]:text-lg [&_h4]:font-semibold [&_h4]:text-slate-900 dark:[&_h4]:text-white',
        '[&_p]:mb-6 [&_p]:leading-relaxed [&_p]:text-slate-700 dark:[&_p]:text-slate-200',
        '[&_ul]:mb-6 [&_ul]:list-disc [&_ul]:space-y-3 [&_ul]:pl-6 [&_ul]:text-slate-700 dark:[&_ul]:text-slate-200',
        '[&_ol]:mb-6 [&_ol]:list-decimal [&_ol]:space-y-3 [&_ol]:pl-6 [&_ol]:text-slate-700 dark:[&_ol]:text-slate-200',
        '[&_li]:mb-2 [&_li]:leading-relaxed [&_a]:font-semibold [&_a]:text-primary [&_a]:no-underline hover:[&_a]:underline [&_strong]:font-semibold [&_strong]:text-slate-950 dark:[&_strong]:text-white',
        '[&_blockquote]:my-5 [&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:bg-sky-50/70 [&_blockquote]:px-5 [&_blockquote]:py-4 [&_blockquote]:text-slate-700 dark:[&_blockquote]:bg-sky-950/20 dark:[&_blockquote]:text-slate-200',
        '[&_figure]:my-8 [&_figure]:space-y-2 [&_figcaption]:text-sm [&_figcaption]:leading-6 [&_figcaption]:text-slate-500 dark:[&_figcaption]:text-slate-300',
        '[&_section[data-vodiy-block]]:mt-8 [&_section[data-vodiy-block]]:min-w-0 [&_section[data-vodiy-block]]:overflow-hidden [&_section[data-vodiy-block]]:border-t [&_section[data-vodiy-block]]:border-slate-200/80 [&_section[data-vodiy-block]]:pt-6 dark:[&_section[data-vodiy-block]]:border-slate-800',
        '[&_a:has(img)]:inline-block [&_a:has(img)]:max-w-full [&_a:has(img)]:align-middle [&_a[data-theory-image-link=true]]:cursor-zoom-in hover:[&_a[data-theory-image-link=true]]:no-underline',
        '[&_img]:my-5 [&_img]:rounded-xl [&_img]:border [&_img]:border-slate-200 [&_img]:bg-white dark:[&_img]:border-slate-700 dark:[&_img]:bg-slate-950',
        '[&_img[data-media-kind="illustration"]]:w-full [&_img[data-media-kind="illustration"]]:max-w-[400px] [&_img[data-media-kind="illustration"]]:object-contain',
        '[&_img[data-media-kind="sign"]]:mx-1 [&_img[data-media-kind="sign"]]:my-0 [&_img[data-media-kind="sign"]]:inline-block [&_img[data-media-kind="sign"]]:h-7 [&_img[data-media-kind="sign"]]:w-auto [&_img[data-media-kind="sign"]]:max-w-[4.5rem] [&_img[data-media-kind="sign"]]:rounded-md [&_img[data-media-kind="sign"]]:p-0.5 [&_img[data-media-kind="sign"]]:align-middle [&_img[data-media-kind="sign"]]:object-contain',
        '[&_img[data-media-kind="marking"]]:mx-1 [&_img[data-media-kind="marking"]]:my-0 [&_img[data-media-kind="marking"]]:inline-block [&_img[data-media-kind="marking"]]:h-7 [&_img[data-media-kind="marking"]]:w-auto [&_img[data-media-kind="marking"]]:max-w-[5.5rem] [&_img[data-media-kind="marking"]]:rounded-md [&_img[data-media-kind="marking"]]:p-0.5 [&_img[data-media-kind="marking"]]:align-middle [&_img[data-media-kind="marking"]]:object-contain',
        '[&_iframe]:my-5 [&_iframe]:overflow-hidden [&_iframe]:rounded-xl [&_iframe]:border [&_iframe]:border-slate-200 [&_iframe]:bg-black dark:[&_iframe]:border-slate-700',
        '[&_[data-youtube-player=true]]:relative [&_[data-youtube-player=true]]:my-5 [&_[data-youtube-player=true]]:aspect-video [&_[data-youtube-player=true]]:overflow-hidden [&_[data-youtube-player=true]]:rounded-xl [&_[data-youtube-player=true]]:bg-black',
        '[&_[data-youtube-player=true]_iframe]:!absolute [&_[data-youtube-player=true]_iframe]:!left-0 [&_[data-youtube-player=true]_iframe]:!top-[-116px] [&_[data-youtube-player=true]_iframe]:!my-0 [&_[data-youtube-player=true]_iframe]:!h-[calc(100%+210px)] [&_[data-youtube-player=true]_iframe]:!w-full [&_[data-youtube-player=true]_iframe]:!rounded-none [&_[data-youtube-player=true]_iframe]:!border-0 sm:[&_[data-youtube-player=true]_iframe]:!top-[-132px] sm:[&_[data-youtube-player=true]_iframe]:!h-[calc(100%+238px)]',
        '[&_[data-youtube-shield=top]]:pointer-events-auto [&_[data-youtube-shield=top]]:absolute [&_[data-youtube-shield=top]]:left-0 [&_[data-youtube-shield=top]]:top-0 [&_[data-youtube-shield=top]]:z-10 [&_[data-youtube-shield=top]]:h-[30%] [&_[data-youtube-shield=top]]:w-full',
        '[&_[data-youtube-shield=logo]]:pointer-events-auto [&_[data-youtube-shield=logo]]:absolute [&_[data-youtube-shield=logo]]:bottom-0 [&_[data-youtube-shield=logo]]:right-0 [&_[data-youtube-shield=logo]]:z-10 [&_[data-youtube-shield=logo]]:h-[28%] [&_[data-youtube-shield=logo]]:w-[48%]',
        '[&_[data-table-scroll="true"]]:my-6 [&_[data-table-scroll="true"]]:overflow-x-auto [&_[data-table-scroll="true"]]:rounded-lg [&_[data-table-scroll="true"]]:ring-1 [&_[data-table-scroll="true"]]:ring-slate-200 dark:[&_[data-table-scroll="true"]]:ring-slate-800',
        '[&_table]:w-full [&_table]:min-w-[620px] [&_table]:border-separate [&_table]:border-spacing-0 [&_table]:bg-white [&_table]:text-sm dark:[&_table]:bg-slate-950',
        '[&_td]:border-b [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-3 [&_td]:align-top [&_td]:leading-6 dark:[&_td]:border-slate-800',
        '[&_th]:border-b [&_th]:border-slate-200 [&_th]:bg-sky-50/80 [&_th]:px-3 [&_th]:py-3 [&_th]:text-left [&_th]:font-medium dark:[&_th]:border-slate-800 dark:[&_th]:bg-sky-950/25',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />

      {previewImage ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/82 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="w-full max-w-5xl rounded-2xl border border-white/10 bg-white p-3 shadow-2xl dark:bg-slate-950 sm:p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-medium text-slate-700 dark:text-slate-200">{previewImage.alt}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-lg font-semibold text-slate-700 transition hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:text-slate-200"
                  onClick={() => setZoom((value) => Math.max(0.5, Number((value - 0.25).toFixed(2))))}
                  aria-label="Зменшити"
                >
                  -
                </button>
                <span className="min-w-14 text-center text-xs font-semibold text-slate-500 dark:text-slate-300">{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-lg font-semibold text-slate-700 transition hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:text-slate-200"
                  onClick={() => setZoom((value) => Math.min(3, Number((value + 0.25).toFixed(2))))}
                  aria-label="Збільшити"
                >
                  +
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:text-slate-200"
                  onClick={() => setPreviewImage(null)}
                >
                  Закрити
                </button>
              </div>
            </div>
            <div
              className="max-h-[76vh] touch-none overflow-hidden rounded-xl bg-slate-50 p-4 dark:bg-slate-900"
              onMouseDown={(event) => {
                event.preventDefault();
                startDrag(event.clientX, event.clientY);
              }}
              onMouseMove={(event) => moveDrag(event.clientX, event.clientY)}
              onMouseUp={endDrag}
              onMouseLeave={endDrag}
              onTouchStart={(event) => {
                const touch = event.touches[0];
                if (touch) startDrag(touch.clientX, touch.clientY);
              }}
              onTouchMove={(event) => {
                const touch = event.touches[0];
                if (!touch) return;
                event.preventDefault();
                moveDrag(touch.clientX, touch.clientY);
              }}
              onTouchEnd={endDrag}
            >
              <img
                src={previewImage.src}
                alt={previewImage.alt}
                draggable={false}
                className="mx-auto max-h-[68vh] max-w-full select-none origin-center object-contain transition-transform"
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                  transition: dragRef.current ? 'none' : 'transform 0.16s ease',
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
