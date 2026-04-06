import { useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, CheckCircle, XCircle, AlertTriangle, FileJson, Trash2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const supabase = createClient(
  "https://wzgvtcrzhikqontraaoy.supabase.co",
  "sb_publishable_O7efFGxHFmTWQypKCaiIpg_bjwbiX2Q"
);

const REQUIRED_FIELDS = ['text', 'options', 'correct_answer', 'category', 'topic'];
const VALID_CATEGORIES = ['A', 'B', 'C', 'D', 'BE', 'CE'];

function validateQuestion(q, index) {
  const errors = [];
  for (const f of REQUIRED_FIELDS) {
    if (!q[f]) errors.push(`Відсутнє поле "${f}"`);
  }
  if (q.options && (!Array.isArray(q.options) || q.options.length < 2)) {
    errors.push('Варіанти відповідей: мінімум 2');
  }
  if (q.options && Array.isArray(q.options)) {
    q.options.forEach((opt, i) => {
      if (!opt.label || !opt.text) errors.push(`Варіант ${i + 1}: потрібні "label" і "text"`);
    });
  }
  if (q.category && !VALID_CATEGORIES.includes(q.category)) {
    errors.push(`Невірна категорія "${q.category}". Дозволено: ${VALID_CATEGORIES.join(', ')}`);
  }
  if (q.correct_answer && q.options) {
    const labels = q.options.map(o => o.label);
    if (!labels.includes(q.correct_answer)) {
      errors.push(`correct_answer "${q.correct_answer}" не відповідає жодному варіанту`);
    }
  }
  return errors;
}

const EXAMPLE_JSON = [
  {
    question_number: 1,
    text: "Що означає цей дорожній знак?",
    options: [
      { label: "A", text: "Рух заборонено" },
      { label: "B", text: "В'їзд заборонено" },
      { label: "C", text: "Зупинка заборонена" },
      { label: "D", text: "Стоянка заборонена" }
    ],
    correct_answer: "B",
    explanation: "Знак 3.21 «В'їзд заборонено» забороняє в'їзд усіх транспортних засобів.",
    image_url: "",
    category: "B",
    topic: "Дорожні знаки",
    difficulty: "easy"
  }
];

export default function ImportQuestions() {
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [validation, setValidation] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setParsed(null);
    setValidation(null);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      let data;
      try {
        data = JSON.parse(/** @type {string} */(e.target.result));
      } catch {
        setValidation({ error: 'Невалідний JSON файл. Перевірте формат.' });
        return;
      }

      const questions = Array.isArray(data) ? data : data.questions;
      if (!Array.isArray(questions)) {
        setValidation({ error: 'JSON має бути масивом питань або об\'єктом { "questions": [...] }' });
        return;
      }

      const results = questions.map((q, i) => ({
        index: i,
        data: q,
        errors: validateQuestion(q, i),
      }));

      const valid = results.filter(r => r.errors.length === 0);
      const invalid = results.filter(r => r.errors.length > 0);

      setParsed(questions);
      setValidation({ total: questions.length, valid: valid.length, invalid: invalid.length, details: results });
    };
    reader.readAsText(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith('.json')) handleFile(f);
  };

  const handleImport = async () => {
    if (!validation || !parsed) return;
    setImporting(true);

    const validQuestions = validation.details
      .filter(r => r.errors.length === 0)
      .map(r => r.data);

    let success = 0;
    let failed = 0;
    const CHUNK = 50;

    for (let i = 0; i < validQuestions.length; i += CHUNK) {
      const chunk = validQuestions.slice(i, i + CHUNK);
      const { error } = await supabase.from('questions').insert(chunk);
      if (error) failed += chunk.length;
      else success += chunk.length;
    }

    setImportResult({ success, failed });
    setImporting(false);
  };

  const downloadExample = () => {
    const blob = new Blob([JSON.stringify(EXAMPLE_JSON, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'questions_example.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Імпорт питань</h1>
        <p className="text-muted-foreground mt-2">
          Завантажте JSON-файл з питаннями для автоматичного додавання до бази даних
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileJson className="w-5 h-5 text-primary" />
            Формат JSON файлу
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Файл має бути масивом об'єктів. Обов'язкові поля:</p>
          <div className="flex flex-wrap gap-2">
            {REQUIRED_FIELDS.map(f => (
              <Badge key={f} variant="secondary" className="font-mono text-xs">{f}</Badge>
            ))}
          </div>
          <div className="bg-muted rounded-lg p-3 font-mono text-xs overflow-x-auto">
            <pre>{JSON.stringify(EXAMPLE_JSON[0], null, 2)}</pre>
          </div>
          <Button variant="outline" size="sm" onClick={downloadExample} className="gap-2">
            <Download className="w-4 h-4" /> Завантажити приклад
          </Button>
        </CardContent>
      </Card>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/50"
        )}
      >
        <Upload className={cn("w-12 h-12", dragOver ? "text-primary" : "text-muted-foreground")} />
        <div className="text-center">
          <p className="text-base font-semibold text-foreground">Перетягніть JSON файл або натисніть</p>
          <p className="text-sm text-muted-foreground mt-1">Підтримується тільки .json формат</p>
        </div>
        {file && (
          <Badge variant="secondary" className="gap-2">
            <FileJson className="w-3.5 h-3.5" />
            {file.name}
          </Badge>
        )}
        <input ref={inputRef} type="file" accept=".json" className="hidden" onChange={e => handleFile(e.target.files[0])} />
      </div>

      <AnimatePresence>
        {validation && !validation.error && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Результат перевірки</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-muted text-center">
                    <p className="text-2xl font-bold">{validation.total}</p>
                    <p className="text-xs text-muted-foreground">Всього</p>
                  </div>
                  <div className="p-4 rounded-xl bg-success/10 text-center">
                    <p className="text-2xl font-bold text-success">{validation.valid}</p>
                    <p className="text-xs text-muted-foreground">Валідних</p>
                  </div>
                  <div className="p-4 rounded-xl bg-destructive/10 text-center">
                    <p className="text-2xl font-bold text-destructive">{validation.invalid}</p>
                    <p className="text-xs text-muted-foreground">З помилками</p>
                  </div>
                </div>

                {validation.invalid > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {validation.details.filter(r => r.errors.length > 0).map(r => (
                      <div key={r.index} className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                        <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                        <div className="text-xs">
                          <span className="font-medium text-foreground">Питання #{r.index + 1}: </span>
                          <span className="text-muted-foreground">{r.errors.join('; ')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {validation.valid > 0 && !importResult && (
                  <Button onClick={handleImport} disabled={importing} className="w-full gap-2">
                    {importing
                      ? <><div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />Імпортую...</>
                      : <><Upload className="w-4 h-4" />Імпортувати {validation.valid} питань</>}
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {validation?.error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <p className="text-sm text-destructive font-medium">{validation.error}</p>
          </motion.div>
        )}

        {importResult && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-success/30 bg-success/5">
              <CardContent className="p-6 flex items-center gap-4">
                <CheckCircle className="w-10 h-10 text-success shrink-0" />
                <div>
                  <p className="text-lg font-bold text-foreground">Імпорт завершено!</p>
                  <p className="text-sm text-muted-foreground">
                    Успішно: {importResult.success} питань
                    {importResult.failed > 0 && ` · Помилки: ${importResult.failed}`}
                  </p>
                </div>
                <Button variant="outline" className="ml-auto" onClick={() => {
                  setFile(null); setParsed(null); setValidation(null); setImportResult(null);
                }}>
                  <Trash2 className="w-4 h-4 mr-2" /> Очистити
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="border-accent/30 bg-accent/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-accent-foreground flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-accent" />
            Як підготувати файл з офіційних білетів ГСЦ
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-foreground space-y-3 leading-relaxed">
          <p><strong>1.</strong> Завантажте PDF з питаннями та відповідями з сайту ГСЦ МВС</p>
          <p><strong>2.</strong> Використайте Python скрипт (parse_questions.py) для парсингу</p>
          <p><strong>3.</strong> Скрипт витягне текст, варіанти, правильні відповіді та зображення</p>
          <p><strong>4.</strong> Зображення завантажте через кнопку нижче, отримайте URL і вставте в JSON</p>
          <p><strong>5.</strong> Завантажте готовий JSON через цей інтерфейс</p>
          <div className="mt-4 p-3 bg-card rounded-lg border border-border font-mono text-xs">
            <p className="text-muted-foreground"># Приклад структури Python парсера:</p>
            <p>python parse_questions.py --pdf questions.pdf --out questions.json</p>
          </div>
          <p className="text-muted-foreground text-xs">
            💡 Підказка: можна розбити великий файл на частини по 100-200 питань і імпортувати окремо
          </p>
        </CardContent>
      </Card>
    </div>
  );
}