// @ts-nocheck
import { useRef, useState } from 'react';
import { CheckCircle2, Download, FileJson, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import api from '@/api/apiClient';

const examplePayload = [
  {
    id: 900001,
    section: '1',
    section_name: 'Загальні положення',
    num_in_section: 1,
    question_text: 'Що означає цей дорожній знак?',
    options: [
      'Рух заборонено',
      'В’їзд заборонено',
      'Зупинка заборонена',
    ],
    correct_ans: 2,
    images: [],
    category: 'B',
  },
];

export default function ImportQuestions() {
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [payload, setPayload] = useState([]);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [importing, setImporting] = useState(false);

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    setError('');
    setResult(null);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '[]'));
        const questions = Array.isArray(parsed) ? parsed : parsed.questions;
        if (!Array.isArray(questions)) {
          throw new Error('JSON має бути масивом або об’єктом з полем questions.');
        }
        setPayload(questions);
      } catch (value) {
        setPayload([]);
        setError(value instanceof Error ? value.message : 'Не вдалося прочитати файл.');
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setImporting(true);
    setError('');
    try {
      const response = await api.importQuestions(payload);
      setResult(response);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Не вдалося імпортувати питання.');
    } finally {
      setImporting(false);
    }
  };

  const downloadExample = () => {
    const blob = new Blob([JSON.stringify(examplePayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'pdr_import_example.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="rounded-[28px] border-white/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5 text-primary" />
            Імпорт питань у PostgreSQL
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-500">
            Файл напряму відправляється у ваш FastAPI-бекенд, який імпортує питання у PostgreSQL.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">id</Badge>
            <Badge variant="secondary">section</Badge>
            <Badge variant="secondary">section_name</Badge>
            <Badge variant="secondary">question_text</Badge>
            <Badge variant="secondary">options</Badge>
            <Badge variant="secondary">correct_ans</Badge>
          </div>
          <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4 text-xs">
            <pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(examplePayload[0], null, 2)}</pre>
          </div>
          <Button variant="outline" className="rounded-full" onClick={downloadExample}>
            <Download className="mr-2 h-4 w-4" />
            Завантажити приклад
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-[28px] border-white/70">
        <CardContent className="space-y-5 p-6">
          <button
            type="button"
            className="flex w-full flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition hover:border-primary/40 hover:bg-primary/5"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="mb-4 h-12 w-12 text-primary" />
            <p className="text-lg font-black text-slate-900">Оберіть JSON-файл з питаннями</p>
            <p className="mt-2 text-sm text-slate-500">Підтримується масив питань або об’єкт виду `{` questions: [...] `}`.</p>
            {fileName ? <p className="mt-4 text-sm font-semibold text-primary">{fileName}</p> : null}
          </button>

          <input ref={inputRef} type="file" accept=".json" className="hidden" onChange={(event) => handleFile(event.target.files?.[0] || null)} />

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-100 bg-slate-50/70 px-4 py-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Готово до імпорту: {payload.length}</p>
              <p className="text-sm text-slate-500">Перевірте файл і натисніть кнопку нижче.</p>
            </div>
            <Button className="rounded-full" disabled={payload.length === 0 || importing} onClick={() => void handleImport()}>
              <Upload className="mr-2 h-4 w-4" />
              {importing ? 'Імпорт...' : 'Імпортувати'}
            </Button>
          </div>

          {error ? <div className="rounded-3xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}

          {result ? (
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                Імпорт завершено
              </div>
              <p className="mt-1">У базу додано або оновлено: {result.imported}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
