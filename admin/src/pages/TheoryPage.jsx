// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpenText, FileImage, Layers3, PencilLine, Play, RefreshCw, Search, UploadCloud, Video } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import api, { resolveApiUrl } from '@/api/apiClient';
import { AdminPageHeader, EmptyState, LoadingState, StatCard } from '@admin/components/AdminCards';

export default function TheoryPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [mediaStatusMessage, setMediaStatusMessage] = useState('');

  const summaryQuery = useQuery({ queryKey: ['admin-theory-summary'], queryFn: () => api.getAdminTheorySummary() });
  const parseStatusQuery = useQuery({
    queryKey: ['admin-theory-parse-status'],
    queryFn: () => api.getAdminTheoryParseStatus(),
    refetchInterval: (query) => (query.state.data?.running ? 3000 : false),
  });
  const sectionsQuery = useQuery({
    queryKey: ['admin-theory-sections', category, search],
    queryFn: () => api.searchAdminTheorySections({ search, category: category === 'all' ? '' : category, limit: 160 }),
  });

  const sections = sectionsQuery.data || [];
  const selectedSection = useMemo(
    () => sections.find((section) => section.id === selectedSectionId) || sections[0] || null,
    [sections, selectedSectionId],
  );

  useEffect(() => {
    if (sections.length && !sections.some((section) => section.id === selectedSectionId)) {
      setSelectedSectionId(sections[0].id);
    }
  }, [sections, selectedSectionId]);

  const updateMutation = useMutation({
    mutationFn: ({ sectionId, payload }) => api.updateAdminTheorySection(sectionId, payload),
    onSuccess: async (updated) => {
      setDrafts((current) => {
        const next = { ...current };
        delete next[updated.id];
        return next;
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-theory-sections', category, search] }),
        queryClient.invalidateQueries({ queryKey: ['admin-theory-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['theory-sections'] }),
      ]);
    },
  });

  const parseMutation = useMutation({
    mutationFn: () => api.startAdminTheoryParse({ write_seed: true }),
    onSuccess: async () => {
      await parseStatusQuery.refetch();
    },
  });

  const imageUploadMutation = useMutation({
    mutationFn: (file) => api.uploadAdminMedia(file, { scope: 'theory', sectionId: selectedSection?.id || null }),
    onSuccess: async (uploaded) => {
      if (!uploaded?.url || !selectedSection || !draft) return;
      const imageHtml = `<p><img src="${uploaded.url}" alt="${escapeHtml(draft.title || selectedSection.title || 'Зображення теорії')}" loading="lazy" /></p>`;
      updateDraft('content_html', `${draft.content_html || ''}\n${imageHtml}`.trim());
      setMediaStatusMessage(`Фото додано: ${uploaded.storage_path || describeTheoryImagePath(uploaded.url).storage}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-theory-sections', category, search] }),
        queryClient.invalidateQueries({ queryKey: ['admin-theory-summary'] }),
      ]);
    },
  });

  const draft = selectedSection
    ? drafts[selectedSection.id] || {
        title: selectedSection.title || '',
        description: selectedSection.description || '',
        content_html: selectedSection.content_html || '',
        comment_html: selectedSection.comment_html || '',
        video_url: selectedSection.video_url || '',
        embed_url: selectedSection.embed_url || '',
        chapter_num: selectedSection.chapter_num ?? '',
        sort_order: selectedSection.sort_order ?? 0,
      }
    : null;

  const updateDraft = (key, value) => {
    if (!selectedSection || !draft) return;
    setDrafts((current) => ({
      ...current,
      [selectedSection.id]: { ...draft, [key]: value },
    }));
  };

  const saveSection = () => {
    if (!selectedSection || !draft) return;
    updateMutation.mutate({
      sectionId: selectedSection.id,
      payload: {
        title: draft.title,
        description: draft.description,
        content_html: draft.content_html,
        comment_html: draft.comment_html,
        video_url: draft.video_url,
        embed_url: draft.embed_url,
        chapter_num: draft.chapter_num === '' ? null : Number(draft.chapter_num),
        sort_order: Number(draft.sort_order || 0),
      },
    });
  };

  const categories = summaryQuery.data?.by_category || [];
  const rowsWithVideo = sections.filter((section) => section.embed_url || section.video_url).length;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Теорія"
        title="Керування розділами ПДР"
        description="Окрема адмінська таблиця для відпарсених розділів, відео, HTML-контенту та медіа. Основна логіка навчання залишається без змін."
      />

      <Card className="mb-6 border-sky-100 bg-sky-50/80 shadow-sm dark:border-sky-500/20 dark:bg-sky-950/20">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-950 dark:text-white">Парсинг теорії з vodiy.ua</p>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {parseStatusQuery.data?.message || 'Можна оновити правила, дорожні знаки, розмітку та локальні зображення.'}
            </p>
            {parseStatusQuery.data?.started_at ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Старт: {new Date(parseStatusQuery.data.started_at).toLocaleString('uk-UA')}
                {parseStatusQuery.data?.finished_at ? ` • Фініш: ${new Date(parseStatusQuery.data.finished_at).toLocaleString('uk-UA')}` : ''}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-lg"
              onClick={() => parseStatusQuery.refetch()}
              disabled={parseStatusQuery.isFetching}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Оновити статус
            </Button>
            <Button
              type="button"
              className="rounded-lg"
              disabled={parseMutation.isPending || parseStatusQuery.data?.running}
              onClick={() => parseMutation.mutate()}
            >
              <Play className="mr-2 h-4 w-4" />
              {parseStatusQuery.data?.running ? 'Парсинг триває' : 'Запустити парсинг'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Layers3} label="Категорії" value={summaryQuery.data?.categories || 0} hint="групи матеріалів" tone="blue" />
        <StatCard icon={BookOpenText} label="Теми" value={summaryQuery.data?.topics || 0} hint="структура бібліотеки" tone="green" />
        <StatCard icon={PencilLine} label="Розділи" value={summaryQuery.data?.sections || 0} hint="сторінки теорії" tone="violet" />
        <StatCard icon={FileImage} label="Медіа" value={summaryQuery.data?.assets || 0} hint={`${rowsWithVideo} розділів з відео у вибірці`} tone="amber" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <CardHeader className="space-y-4">
            <CardTitle className="text-lg font-semibold">Розділи теорії</CardTitle>
            <div className="grid gap-3 md:grid-cols-[1fr_240px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input className="pl-9" placeholder="Пошук по назві або тексту" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Категорія" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Усі категорії</SelectItem>
                  {categories.map((item) => (
                    <SelectItem key={item.slug} value={item.slug}>
                      {item.title} ({item.sections_count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {sectionsQuery.isLoading ? (
              <div className="p-4"><LoadingState /></div>
            ) : sections.length ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Розділ</TableHead>
                      <TableHead>Тема</TableHead>
                      <TableHead>Медіа</TableHead>
                      <TableHead className="text-right">Порядок</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sections.map((section) => (
                      <TableRow
                        key={section.id}
                        className={selectedSection?.id === section.id ? 'bg-blue-50/70 dark:bg-blue-950/20' : 'cursor-pointer'}
                        onClick={() => setSelectedSectionId(section.id)}
                      >
                        <TableCell className="font-mono text-xs">{section.chapter_num || section.id}</TableCell>
                        <TableCell>
                          <div className="min-w-72">
                            <p className="line-clamp-1 font-medium text-slate-950 dark:text-white">{section.title}</p>
                            <p className="line-clamp-1 text-xs text-slate-500">{section.description || section.source_url || 'Без опису'}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-44">
                            <p className="text-sm">{section.topic_title}</p>
                            <p className="text-xs text-slate-500">{section.category_title}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            {Array.isArray(section.assets) && section.assets.length ? <TheoryImageThumb src={section.assets[0]} alt={section.title} /> : null}
                            {section.assets_count ? <Badge variant="secondary">{section.assets_count} фото</Badge> : null}
                            {section.embed_url || section.video_url ? <Badge className="bg-rose-500"><Video className="mr-1 h-3 w-3" /> Відео</Badge> : null}
                            {!section.assets_count && !section.embed_url && !section.video_url ? <span className="text-xs text-slate-400">—</span> : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{section.sort_order}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="p-4"><EmptyState text="Розділів за цим фільтром не знайдено." /></div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Редагування розділу</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedSection || !draft ? (
              <EmptyState text="Оберіть розділ у таблиці." />
            ) : (
              <>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    <span>ID {selectedSection.id}</span>
                    <span>{selectedSection.category_title}</span>
                    <span>{selectedSection.topic_title}</span>
                  </div>
                  {selectedSection.source_url ? (
                    <a className="mt-2 block truncate text-xs text-blue-600 dark:text-blue-300" href={selectedSection.source_url} target="_blank" rel="noreferrer">
                      {selectedSection.source_url}
                    </a>
                  ) : null}
                </div>

                <TheoryImagesPreview images={selectedSection.assets || []} title={selectedSection.title} />

                <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-500/20 dark:bg-blue-500/10">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Додати зображення до розділу</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-300">
                        Файл завантажиться на сервер, додасться в медіа розділу і вставиться в HTML матеріалу.
                        Якщо шлях починається з `/media/admin/`, файл збережений у БД `admin_media_files`, а не в окремій папці.
                      </p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
                      <UploadCloud className="mr-2 h-4 w-4" />
                      {imageUploadMutation.isPending ? 'Завантажуємо...' : 'Вибрати файл'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/svg+xml"
                        className="sr-only"
                        disabled={imageUploadMutation.isPending}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) imageUploadMutation.mutate(file);
                          event.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                  {imageUploadMutation.error ? (
                    <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-300">
                      {imageUploadMutation.error instanceof Error ? imageUploadMutation.error.message : 'Не вдалося завантажити файл'}
                    </p>
                  ) : null}
                  {mediaStatusMessage ? (
                    <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-300">{mediaStatusMessage}</p>
                  ) : null}
                </div>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Назва</span>
                  <Input value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Короткий опис</span>
                  <Textarea rows={3} value={draft.description} onChange={(event) => updateDraft('description', event.target.value)} />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Номер розділу</span>
                    <Input type="number" value={draft.chapter_num} onChange={(event) => updateDraft('chapter_num', event.target.value)} />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Порядок</span>
                    <Input type="number" value={draft.sort_order} onChange={(event) => updateDraft('sort_order', event.target.value)} />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">YouTube embed</span>
                    <Input value={draft.embed_url} onChange={(event) => updateDraft('embed_url', event.target.value)} />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Локальне відео</span>
                    <Input value={draft.video_url} onChange={(event) => updateDraft('video_url', event.target.value)} />
                  </label>
                </div>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">HTML матеріалу</span>
                  <Textarea className="font-mono text-xs" rows={10} value={draft.content_html} onChange={(event) => updateDraft('content_html', event.target.value)} />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Коментар/примітка</span>
                  <Textarea className="font-mono text-xs" rows={4} value={draft.comment_html} onChange={(event) => updateDraft('comment_html', event.target.value)} />
                </label>

                <div className="flex justify-end">
                  <Button className="rounded-lg" disabled={updateMutation.isPending} onClick={saveSection}>
                    <PencilLine className="mr-2 h-4 w-4" />
                    Зберегти розділ
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TheoryImageThumb({ src, alt }) {
  const imageSrc = resolveApiUrl(src);
  if (!imageSrc) return null;
  return (
    <span className="inline-flex h-12 w-16 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
      <img src={imageSrc} alt={alt || 'Зображення теорії'} className="h-full w-full object-contain" loading="lazy" />
    </span>
  );
}

function TheoryImagesPreview({ images = [], title }) {
  const cleanImages = images.map((item) => String(item || '').trim()).filter(Boolean);
  if (!cleanImages.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
        У цього розділу поки немає окремих зображень у медіа-бібліотеці.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Зображення розділу</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {cleanImages.slice(0, 8).map((image, index) => {
          const imageSrc = resolveApiUrl(image);
          const pathInfo = describeTheoryImagePath(image);
          return (
            <a
              key={`${image}-${index}`}
              href={imageSrc || '#'}
              target="_blank"
              rel="noreferrer"
              className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-blue-300 hover:bg-blue-50/50 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-sky-500/50"
            >
              <img src={imageSrc || ''} alt={`${title || 'Теорія'} ${index + 1}`} className="h-36 w-full rounded-lg bg-white object-contain dark:bg-slate-900" loading="lazy" />
              <span className="mt-2 block truncate font-mono text-xs text-slate-500 dark:text-slate-300" title={pathInfo.publicPath}>
                {pathInfo.publicPath}
              </span>
              <span className="mt-1 block truncate text-[11px] text-slate-400 dark:text-slate-500" title={pathInfo.storage}>
                {pathInfo.storage}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function describeTheoryImagePath(value) {
  const source = String(value || '').trim();
  if (!source) return { publicPath: '—', storage: 'Без зображення' };

  const adminMatch = source.match(/^\/media\/admin\/(\d+)\/(.+)$/);
  if (adminMatch) {
    return {
      publicPath: source,
      storage: `БД: admin_media_files #${adminMatch[1]}`,
    };
  }

  if (source.startsWith('/uploads/')) {
    return {
      publicPath: source,
      storage: `Файл: backend${source}`,
    };
  }

  if (source.startsWith('/images/')) {
    return {
      publicPath: source,
      storage: `Файл: backend/public${source}`,
    };
  }

  if (source.startsWith('/')) {
    return {
      publicPath: source,
      storage: 'Публічний шлях backend/frontend',
    };
  }

  return {
    publicPath: source,
    storage: 'Зовнішній або старий локальний шлях',
  };
}
