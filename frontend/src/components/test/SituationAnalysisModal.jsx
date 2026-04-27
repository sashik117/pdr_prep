import { useState } from 'react';
import { ZoomIn, ZoomOut, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** @param {import('@/types/questions').SituationAnalysisModalProps} props */
export default function SituationAnalysisModal({ question, onClose, revealAnswer = false }) {
  const [zoom, setZoom] = useState(1);

  if (!question) return null;

  const keywords = [];
  const explanation = question.explanation || '';
  if (/знак/i.test(explanation)) keywords.push('дорожній знак');
  if (/пріоритет|перевага/i.test(explanation)) keywords.push('пріоритет');
  if (/піш|перехід/i.test(explanation)) keywords.push('пішохідний перехід');

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-full max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <ZoomIn className="h-5 w-5 text-primary" />
            Аналіз ситуації
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 p-6">
          <div className="relative flex min-h-48 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/50">
            {question.image_url ? (
              <div className="flex max-h-[50vh] w-full items-center justify-center overflow-auto">
                <img
                  src={question.image_url}
                  alt="Аналіз ситуації"
                  style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s', transformOrigin: 'center center' }}
                  className="max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <ZoomIn className="mx-auto mb-2 h-12 w-12 opacity-30" />
                Зображення відсутнє
              </div>
            )}

            {question.image_url ? (
              <div className="absolute right-3 top-3 flex gap-2">
                <button
                  onClick={() => setZoom((value) => Math.min(value + 0.3, 3))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card/90 hover:bg-muted"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setZoom((value) => Math.max(value - 0.3, 0.5))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card/90 hover:bg-muted"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setZoom(1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card/90 hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-border bg-muted/50 p-4">
            <p className="text-sm font-medium text-foreground">{question.text}</p>
          </div>

          {keywords.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ключові обʼєкти ситуації:</p>
              <div className="flex flex-wrap gap-2">
                {keywords.map((keyword, index) => (
                  <span key={index} className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {keyword}
                  </span>
                ))}
                {revealAnswer ? (
                  <span className="rounded-full border border-accent/20 bg-accent/20 px-3 py-1 text-xs font-medium text-accent-foreground">
                    Правильна відповідь: {question.correct_answer}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {question.explanation ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">Пояснення:</p>
              <p className="text-sm leading-relaxed text-foreground">{question.explanation}</p>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
