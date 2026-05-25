/**
 * @param {{ assets: Array<{ type: string; localUrl: string; caption: string; altText: string }>; fallbackTitle?: string }} props
 */
export default function TheoryAssetGallery({ assets, fallbackTitle = '' }) {
  const images = (assets || []).filter((asset) => asset.type === 'image' && asset.localUrl);
  if (!images.length) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Ілюстрації</p>
        <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-600 dark:bg-slate-800 dark:text-slate-200">
          {images.length} {images.length === 1 ? 'файл' : 'файлів'}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {images.slice(0, 12).map((asset, index) => (
          <figure
            key={`${asset.localUrl}-${index}`}
            className="overflow-hidden rounded-xl border border-slate-200 bg-card shadow-sm transition-colors hover:border-primary/30 dark:border-slate-800"
          >
            <div className="bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,1))] p-2 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))]">
              <img
                src={asset.localUrl}
                alt={asset.altText || fallbackTitle}
                className="max-h-80 w-full rounded-lg object-contain bg-white dark:bg-slate-950"
              />
            </div>
            {asset.caption ? (
              <figcaption className="border-t border-slate-100 px-4 py-3 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:text-slate-300">
                {asset.caption}
              </figcaption>
            ) : null}
          </figure>
        ))}
      </div>
    </div>
  );
}
