// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileQuestion, ImageIcon, PencilLine, Search, ShieldCheck, UploadCloud } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import api, { resolveApiUrl } from '@/api/apiClient';
import { AdminPageHeader, EmptyState, LoadingState, StatCard } from '@/features/admin/components/AdminCards';
import { questionImagesToText, questionOptionsToText, textToLines } from '@/features/admin/admin-utils';

export default function QuestionsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [section, setSection] = useState('all');
  const [selectedQuestionId, setSelectedQuestionId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [drafts, setDrafts] = useState({});

  const sectionsQuery = useQuery({ queryKey: ['admin-question-sections'], queryFn: () => api.getAdminQuestionSections() });
  const questionsQuery = useQuery({
    queryKey: ['admin-questions', section, search],
    queryFn: () => api.searchAdminQuestions({ search, section: section === 'all' ? '' : section, limit: 80 }),
  });

  const sections = sectionsQuery.data || [];
  const questions = questionsQuery.data || [];
  const selectedQuestion = useMemo(
    () => questions.find((question) => question.id === selectedQuestionId) || null,
    [questions, selectedQuestionId],
  );

  useEffect(() => {
    if (selectedQuestionId && !questions.some((question) => question.id === selectedQuestionId)) {
      setSelectedQuestionId(null);
      setEditorOpen(false);
    }
  }, [questions, selectedQuestionId]);

  const questionMutation = useMutation({
    mutationFn: ({ questionId, payload }) => api.updateAdminQuestion(questionId, payload),
    onSuccess: async (updated) => {
      setStatusMessage('Питання успішно оновлено.');
      setDrafts((current) => {
        const next = { ...current };
        delete next[updated.id];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ['admin-questions', section, search] });
      await queryClient.invalidateQueries({ queryKey: ['admin-question-sections'] });
    },
  });

  const imageUploadMutation = useMutation({
    mutationFn: (file) => api.uploadAdminMedia(file, { scope: 'questions' }),
    onSuccess: async (uploaded) => {
      if (!uploaded?.url || !selectedQuestion || !draft) return;
      const currentImages = textToLines(draft.imagesText);
      const nextImages = [...currentImages, uploaded.url];
      updateDraft('imagesText', nextImages.join('\n'));
      await api.updateAdminQuestion(selectedQuestion.id, buildQuestionPayload(draft, nextImages));
      setStatusMessage('Зображення завантажено і прив’язано до питання.');
      await queryClient.invalidateQueries({ queryKey: ['admin-questions', section, search] });
      await queryClient.invalidateQueries({ queryKey: ['admin-question-sections'] });
    },
  });

  const draft = selectedQuestion
    ? drafts[selectedQuestion.id] || {
        question_text: selectedQuestion.question_text || '',
        explanation: selectedQuestion.explanation || '',
        difficulty: selectedQuestion.difficulty || 'medium',
        section_name: selectedQuestion.section_name || '',
        optionsText: questionOptionsToText(selectedQuestion.options),
        imagesText: questionImagesToText(selectedQuestion.images),
        correct_ans: selectedQuestion.correct_ans || 1,
      }
    : null;

  const totalQuestions = sections.reduce((sum, item) => sum + Number(item.count || 0), 0);
  const questionsWithImages = questions.filter((question) => Array.isArray(question.images) && question.images.length > 0).length;
  const hardQuestions = questions.filter((question) => String(question.difficulty || '').toLowerCase().includes('hard')).length;

  const updateDraft = (key, value) => {
    if (!selectedQuestion || !draft) return;
    setDrafts((current) => ({
      ...current,
      [selectedQuestion.id]: { ...draft, [key]: value },
    }));
  };

  const saveQuestion = () => {
    if (!selectedQuestion || !draft) return;
    questionMutation.mutate({
      questionId: selectedQuestion.id,
      payload: buildQuestionPayload(draft),
    });
  };

  const openEditor = (questionId) => {
    setSelectedQuestionId(questionId);
    setStatusMessage('');
    setEditorOpen(true);
  };

  return (
    <div>
      <AdminPageHeader
        eyebrow="Практика"
        title="Питання та розділи тестів"
        description="Фільтруйте питання за розділами ПДР, перевіряйте ілюстрації, варіанти відповідей та пояснення."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FileQuestion} label="У базі" value={totalQuestions} hint={`${sections.length} розділів`} tone="blue" />
        <StatCard icon={ShieldCheck} label="Поточна вибірка" value={questions.length} hint="питань у таблиці" tone="green" />
        <StatCard icon={ImageIcon} label="З ілюстраціями" value={questionsWithImages} hint="у поточній вибірці" tone="violet" />
        <StatCard icon={CheckCircle2} label="Складні" value={hardQuestions} hint="позначені як hard" tone="rose" />
      </div>

      <div className="mt-6">
        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <CardHeader className="space-y-4">
            <CardTitle className="text-lg font-semibold">База питань</CardTitle>
            <div className="grid gap-3 md:grid-cols-[1fr_260px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input className="pl-9" placeholder="Пошук по тексту питання або поясненню" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <Select value={section} onValueChange={setSection}>
                <SelectTrigger>
                  <SelectValue placeholder="Розділ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Усі розділи</SelectItem>
                  {sections.map((item) => (
                    <SelectItem key={`${item.section}-${item.section_name}`} value={String(item.section)}>
                      {item.section}. {item.section_name || 'Без назви'} ({item.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {questionsQuery.isLoading ? (
              <div className="p-4"><LoadingState /></div>
            ) : questions.length ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Питання</TableHead>
                      <TableHead>Розділ</TableHead>
                      <TableHead>Складність</TableHead>
                      <TableHead className="text-right">Відповідь</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {questions.map((question) => (
                      <TableRow
                        key={question.id}
                        className={selectedQuestion?.id === question.id ? 'bg-blue-50/70 dark:bg-blue-950/20' : 'cursor-pointer'}
                        onClick={() => openEditor(question.id)}
                      >
                        <TableCell className="font-mono text-xs">{question.id}</TableCell>
                        <TableCell>
                          <p className="line-clamp-2 min-w-72 text-sm font-medium text-slate-900 dark:text-white">{question.question_text}</p>
                          {Array.isArray(question.images) && question.images.length ? (
                            <div className="mt-2 flex items-center gap-2">
                              <QuestionImageThumb src={question.images[0]} alt={`Ілюстрація питання ${question.id}`} />
                              <p className="text-xs text-slate-500">{question.images.length} зображення</p>
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <div className="min-w-44">
                            <p className="text-sm">{question.section}</p>
                            <p className="line-clamp-1 text-xs text-slate-500">{question.section_name || 'Без назви'}</p>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="secondary">{question.difficulty || 'medium'}</Badge></TableCell>
                        <TableCell className="text-right font-semibold">{question.correct_ans}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="p-4"><EmptyState text="За цим пошуком питань не знайдено." /></div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={editorOpen && Boolean(selectedQuestion && draft)} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[92vh] max-w-[min(980px,calc(100vw-1rem))] overflow-y-auto rounded-2xl p-0">
          <DialogTitle className="sr-only">Редагування питання</DialogTitle>
          <DialogDescription className="sr-only">Форма редагування тексту, відповідей і зображень питання.</DialogDescription>
          {selectedQuestion && draft ? (
            <div className="space-y-4 p-4 sm:p-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  <span>ID {selectedQuestion.id}</span>
                  <span>Розділ {selectedQuestion.section}</span>
                  <span>Правильна відповідь: {selectedQuestion.correct_ans}</span>
                </div>
                <h2 className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">Редагування питання</h2>
                {statusMessage ? (
                  <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
                    {statusMessage}
                  </p>
                ) : null}
              </div>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Текст питання</span>
                <Textarea rows={4} value={draft.question_text} onChange={(event) => updateDraft('question_text', event.target.value)} />
              </label>

              <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Назва розділу</span>
                  <Input value={draft.section_name} onChange={(event) => updateDraft('section_name', event.target.value)} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Складність</span>
                  <Input value={draft.difficulty} onChange={(event) => updateDraft('difficulty', event.target.value)} />
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Варіанти відповідей</span>
                <Textarea rows={5} value={draft.optionsText} onChange={(event) => updateDraft('optionsText', event.target.value)} />
                <p className="text-xs text-slate-500">Один варіант в одному рядку. Нумерувати не потрібно.</p>
              </label>

              <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Файли зображень</span>
                  <Textarea rows={3} value={draft.imagesText} onChange={(event) => updateDraft('imagesText', event.target.value)} />
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20">
                      <UploadCloud className="mr-2 h-4 w-4" />
                      {imageUploadMutation.isPending ? 'Завантажуємо...' : 'Завантажити зображення'}
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
                    {imageUploadMutation.error ? (
                      <span className="text-xs font-medium text-rose-600 dark:text-rose-300">
                        {imageUploadMutation.error instanceof Error ? imageUploadMutation.error.message : 'Не вдалося завантажити файл'}
                      </span>
                    ) : null}
                  </div>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Правильна</span>
                  <Input type="number" min="1" value={draft.correct_ans} onChange={(event) => updateDraft('correct_ans', Number(event.target.value || 1))} />
                </label>
              </div>

              <QuestionImagesPreview images={textToLines(draft.imagesText)} questionId={selectedQuestion.id} onPreview={setPreviewImage} />

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Пояснення</span>
                <Textarea rows={5} value={draft.explanation} onChange={(event) => updateDraft('explanation', event.target.value)} />
              </label>

              <div className="sticky bottom-0 -mx-4 flex justify-end border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:-mx-6 sm:px-6">
                <Button className="rounded-lg" disabled={questionMutation.isPending} onClick={saveQuestion}>
                  <PencilLine className="mr-2 h-4 w-4" />
                  {questionMutation.isPending ? 'Зберігаємо...' : 'Зберегти питання'}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(previewImage)} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-[min(900px,calc(100vw-1rem))] rounded-2xl bg-white p-4 dark:bg-slate-950">
          <DialogTitle className="sr-only">Перегляд зображення</DialogTitle>
          <DialogDescription className="sr-only">Збільшене зображення питання.</DialogDescription>
          <img src={previewImage || ''} alt="Зображення питання" className="max-h-[82vh] w-full rounded-xl object-contain" />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuestionImageThumb({ src, alt }) {
  const imageSrc = resolveQuestionImageUrl(src);
  if (!imageSrc) return null;

  return (
    <span className="inline-flex h-12 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-950">
      <img src={imageSrc} alt={alt} className="h-full w-full object-contain" loading="lazy" />
    </span>
  );
}

function QuestionImagesPreview({ images = [], questionId, onPreview }) {
  const cleanImages = images.map((item) => String(item || '').trim()).filter(Boolean);
  if (!cleanImages.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
        Для цього питання зображення не додані.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Перегляд зображень</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {cleanImages.map((image, index) => {
          const imageSrc = resolveQuestionImageUrl(image);
          return (
            <button
              type="button"
              key={`${questionId}-${image}-${index}`}
              onClick={() => imageSrc && onPreview?.(imageSrc)}
              className="group overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-blue-300 hover:bg-blue-50/50 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-sky-500/50 dark:hover:bg-sky-950/30"
            >
              <img
                src={imageSrc || ''}
                alt={`Ілюстрація питання ${questionId}, ${index + 1}`}
                className="h-40 w-full rounded-lg bg-white object-contain dark:bg-slate-900"
                loading="lazy"
              />
              <span className="mt-2 block truncate text-xs text-slate-500 dark:text-slate-300">{image}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function buildQuestionPayload(draft, imagesOverride = null) {
  return {
    question_text: draft.question_text,
    explanation: draft.explanation,
    difficulty: draft.difficulty,
    section_name: draft.section_name,
    options: textToLines(draft.optionsText),
    images: imagesOverride || textToLines(draft.imagesText),
    correct_ans: Number(draft.correct_ans || 1),
  };
}

function resolveQuestionImageUrl(value) {
  const source = String(value || '').trim();
  if (!source) return null;
  if (/^https?:\/\//i.test(source) || source.startsWith('/')) return resolveApiUrl(source);
  return resolveApiUrl(`/images/questions_img/${source}`);
}
