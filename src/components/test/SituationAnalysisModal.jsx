import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState } from 'react';
import { ZoomIn, ZoomOut, X } from 'lucide-react';

export default function SituationAnalysisModal({ question, onClose }) {
  const [zoom, setZoom] = useState(1);

  if (!question) return null;

  // Highlight objects mentioned in explanation
  const keywords = [];
  const explanation = question.explanation || '';
  if (/знак/i.test(explanation)) keywords.push('дорожній знак');
  if (/пріоритет|перевага/i.test(explanation)) keywords.push('пріоритет');
  if (/піш|перехід/i.test(explanation)) keywords.push('пішохідний перехід');

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <ZoomIn className="w-5 h-5 text-primary" />
            Аналіз ситуації
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-4">
          {/* Image with zoom */}
          <div className="relative rounded-xl overflow-hidden border border-border bg-muted/50 flex items-center justify-center min-h-48">
            {question.image_url ? (
              <div className="overflow-auto max-h-[50vh] w-full flex items-center justify-center">
                <img
                  src={question.image_url}
                  alt="Аналіз ситуації"
                  style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s', transformOrigin: 'center center' }}
                  className="max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="text-muted-foreground text-sm py-12 text-center">
                <ZoomIn className="w-12 h-12 mx-auto mb-2 opacity-30" />
                Зображення відсутнє
              </div>
            )}

            {/* Zoom controls */}
            {question.image_url && (
              <div className="absolute top-3 right-3 flex gap-2">
                <button
                  onClick={() => setZoom(z => Math.min(z + 0.3, 3))}
                  className="w-8 h-8 rounded-lg bg-card/90 border border-border flex items-center justify-center hover:bg-muted"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setZoom(z => Math.max(z - 0.3, 0.5))}
                  className="w-8 h-8 rounded-lg bg-card/90 border border-border flex items-center justify-center hover:bg-muted"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setZoom(1)}
                  className="w-8 h-8 rounded-lg bg-card/90 border border-border flex items-center justify-center hover:bg-muted"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Question text */}
          <div className="p-4 rounded-xl bg-muted/50 border border-border">
            <p className="text-sm font-medium text-foreground">{question.text}</p>
          </div>

          {/* Key objects */}
          {keywords.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ключові об'єкти ситуації:</p>
              <div className="flex flex-wrap gap-2">
                {keywords.map((k, i) => (
                  <span key={i} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                    {k}
                  </span>
                ))}
                <span className="px-3 py-1 rounded-full bg-accent/20 text-accent-foreground text-xs font-medium border border-accent/20">
                  Правильна відповідь: {question.correct_answer}
                </span>
              </div>
            </div>
          )}

          {/* Explanation */}
          {question.explanation && (
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Пояснення:</p>
              <p className="text-sm text-foreground leading-relaxed">{question.explanation}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}