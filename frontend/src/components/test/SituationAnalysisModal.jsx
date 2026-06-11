import { useRef, useState } from 'react';
import { Move, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** @param {import('@/types/questions').SituationAnalysisModalProps & { revealAnswer?: boolean }} props */
export default function SituationAnalysisModal({ question, onClose, revealAnswer = false }) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);

  if (!question) return null;

  const keywords = [];
  const analysisSource = `${question.text || ''} ${question.topic || ''}`;
  if (/знак/i.test(analysisSource)) keywords.push('дорожній знак');
  if (/пріоритет|переваг/i.test(analysisSource)) keywords.push('пріоритет');
  if (/піш|перехід/i.test(analysisSource)) keywords.push('пішохідний перехід');

  const resetView = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    dragRef.current = null;
  };

  const startDrag = (clientX, clientY) => {
    dragRef.current = {
      clientX,
      clientY,
      x: offset.x,
      y: offset.y,
    };
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

  const zoomIn = () => setZoom((value) => Math.min(value + 0.3, 4));
  const zoomOut = () => setZoom((value) => Math.max(value - 0.3, 0.6));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-full max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
          <DialogTitle className="flex items-center gap-2 text-lg font-medium">
            <ZoomIn className="h-5 w-5 text-primary" />
            Аналіз ситуації
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 p-6">
          <div
            className="relative flex min-h-48 touch-none items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/50"
            onMouseDown={(event) => {
              if (!question.image_url) return;
              event.preventDefault();
              startDrag(event.clientX, event.clientY);
            }}
            onMouseMove={(event) => moveDrag(event.clientX, event.clientY)}
            onMouseUp={endDrag}
            onMouseLeave={endDrag}
            onTouchStart={(event) => {
              const touch = event.touches[0];
              if (!question.image_url || !touch) return;
              startDrag(touch.clientX, touch.clientY);
            }}
            onTouchMove={(event) => {
              const touch = event.touches[0];
              if (!touch) return;
              event.preventDefault();
              moveDrag(touch.clientX, touch.clientY);
            }}
            onTouchEnd={endDrag}
          >
            {question.image_url ? (
              <div className="flex max-h-[58vh] w-full items-center justify-center overflow-hidden">
                <img
                  src={question.image_url}
                  alt="Аналіз ситуації"
                  draggable={false}
                  style={{
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                    transition: dragRef.current ? 'none' : 'transform 0.16s ease',
                    transformOrigin: 'center center',
                  }}
                  className="max-h-[58vh] max-w-full select-none object-contain"
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
                  type="button"
                  onClick={zoomIn}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card/90 hover:bg-muted"
                  aria-label="Збільшити"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={zoomOut}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card/90 hover:bg-muted"
                  aria-label="Зменшити"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={resetView}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card/90 hover:bg-muted"
                  aria-label="Скинути масштаб і позицію"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>

          {question.image_url ? (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Move className="h-3.5 w-3.5" />
              Перетягуйте зображення, щоб роздивитися деталі
            </div>
          ) : null}

          <div className="rounded-xl border border-border bg-muted/50 p-4">
            <p className="text-sm font-medium text-foreground">{question.text}</p>
          </div>

          {keywords.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">На що звернути увагу:</p>
              <div className="flex flex-wrap gap-2">
                {keywords.map((keyword) => (
                  <span key={keyword} className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
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

          {revealAnswer && question.explanation ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-primary">Пояснення:</p>
              <p className="text-sm leading-relaxed text-foreground">{question.explanation}</p>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
