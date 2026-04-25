// @ts-nocheck
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BellRing, ChevronDown, CircleAlert, ClipboardCheck, FileCheck2, Filter, Truck, Bus, TramFront, Bike, CarFront, Link2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import api from '@/api/apiClient';

const modes = [
  { id: 'quick', icon: ClipboardCheck, label: 'Швидкий тест', desc: '10 питань для короткої перевірки', questions: 10, accent: 'from-sky-500 to-blue-600' },
  { id: 'full', icon: FileCheck2, label: 'Повний іспит', desc: '20 питань як на справжньому іспиті', questions: 20, accent: 'from-blue-600 to-indigo-600' },
  { id: 'difficult', icon: CircleAlert, label: 'Робота над помилками', desc: 'Питання, де ви помилялися раніше', questions: 10, accent: 'from-rose-500 to-orange-500' },
  { id: 'daily', icon: BellRing, label: 'Виклик дня', desc: 'Щоденна добірка питань', questions: 15, accent: 'from-amber-400 to-orange-500' },
];

const categoryGroups = [
  { id: 'A', label: 'A / A1', hint: 'Мотоцикли та мопеди', icon: Bike },
  { id: 'B', label: 'B / B1', hint: 'Легкові автомобілі', icon: CarFront },
  { id: 'C', label: 'C / C1', hint: 'Вантажний транспорт', icon: Truck },
  { id: 'D', label: 'D / D1', hint: 'Автобуси', icon: Bus },
  { id: 'T', label: 'T', hint: 'Трамваї та тролейбуси', icon: TramFront },
  { id: 'BE', label: 'BE / C1E / CE / D1E / DE', hint: 'Транспорт із причепами', icon: Link2 },
];

function buildSections(rows) {
  return rows
    .map((row) => ({
      id: String(row.section),
      title: row.section_name || `Розділ ${row.section}`,
      count: Number(row.count) || 0,
    }))
    .sort((left, right) => Number(left.id) - Number(right.id));
}

export default function TestSelection() {
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [selectedMode, setSelectedMode] = useState(params.get('mode') || 'quick');
  const [selectedCategory, setSelectedCategory] = useState('B');
  const [selectedSection, setSelectedSection] = useState('');
  const [sectionsOpen, setSectionsOpen] = useState(false);

  const { data: rawSections = [], isLoading, error } = useQuery({
    queryKey: ['test-sections', selectedCategory],
    queryFn: () => api.getSections(selectedCategory),
  });

  const sections = useMemo(() => buildSections(rawSections), [rawSections]);
  const currentMode = modes.find((item) => item.id === selectedMode) || modes[0];
  const selectedSectionTitle = sections.find((section) => section.id === selectedSection)?.title;

  const handleStart = () => {
    const query = new URLSearchParams({ mode: selectedMode });
    if (selectedCategory) query.set('category', selectedCategory);
    if (selectedSection) query.set('section', selectedSection);
    navigate(`/test?${query.toString()}`);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modes.map((mode, index) => (
          <motion.button
            key={mode.id}
            type="button"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            whileHover={{ y: -2 }}
            className={cn(
              'rounded-[28px] border p-5 text-left shadow-[0_18px_45px_rgba(15,23,42,0.05)] transition-all duration-200',
              selectedMode === mode.id
                ? 'border-primary bg-[linear-gradient(135deg,rgba(20,107,255,0.12),rgba(255,255,255,0.98)_45%,rgba(239,246,255,0.94))] text-slate-900 shadow-[0_22px_45px_rgba(20,107,255,0.16)] dark:bg-[linear-gradient(135deg,rgba(30,64,175,0.3),rgba(15,23,42,0.98)_45%,rgba(12,74,110,0.9))] dark:text-white dark:shadow-[0_22px_45px_rgba(56,189,248,0.12)]'
                : 'border-white/80 bg-white hover:border-primary/30 hover:shadow-[0_22px_50px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950/92 dark:text-white dark:hover:border-sky-500/30',
            )}
            onClick={() => setSelectedMode(mode.id)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${mode.accent} text-white shadow-[0_12px_24px_rgba(15,23,42,0.14)]`}>
                <mode.icon className="h-6 w-6" />
              </div>
              <Badge
                variant="outline"
                className={cn(
                  'border-slate-200 bg-white/80 text-slate-700 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200',
                  selectedMode === mode.id && 'border-primary/20 bg-primary/5 text-primary dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200',
                )}
              >
                {mode.questions > 0 ? `${mode.questions} питань` : 'Окремий режим'}
              </Badge>
            </div>
            <h3 className="mt-4 text-lg font-extrabold tracking-[-0.02em]">{mode.label}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-300">{mode.desc}</p>
          </motion.button>
        ))}
      </div>

      <div className="rounded-[28px] border border-white/80 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950/92">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Категорія</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-[-0.02em] text-slate-900 dark:text-white">Оберіть категорію посвідчення</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {categoryGroups.map((category) => (
            <motion.button
              key={category.id}
              type="button"
              whileHover={{ y: -2 }}
              className={cn(
                'rounded-3xl border px-4 py-4 text-left transition-all duration-200',
                selectedCategory === category.id
                  ? 'border-primary bg-[linear-gradient(135deg,rgba(20,107,255,0.08),rgba(255,255,255,0.98)_48%,rgba(239,246,255,0.94))] shadow-[0_16px_40px_rgba(20,107,255,0.12)] dark:bg-[linear-gradient(135deg,rgba(30,64,175,0.25),rgba(15,23,42,0.98)_48%,rgba(12,74,110,0.86))] dark:shadow-[0_16px_40px_rgba(56,189,248,0.12)]'
                  : 'border-slate-200 bg-white hover:border-primary/30 dark:border-slate-700 dark:bg-slate-950/92 dark:hover:border-sky-500/30',
              )}
              onClick={() => {
                setSelectedCategory(category.id);
                setSelectedSection('');
                setSectionsOpen(false);
              }}
            >
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <category.icon className="h-5 w-5" />
              </div>
              <p className="text-base font-extrabold tracking-[-0.02em] text-slate-900 dark:text-white">{category.label}</p>
              <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-300">{category.hint}</p>
            </motion.button>
          ))}
        </div>
      </div>

      <div className="rounded-[28px] border border-white/80 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950/92">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Розділи</p>
            <h2 className="mt-1 text-xl font-extrabold tracking-[-0.02em] text-slate-900 dark:text-white">За замовчуванням підуть усі розділи</h2>
          </div>
          <Badge variant="outline" className="border-slate-200 bg-white/85 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <Filter className="mr-2 h-3.5 w-3.5" />
            {selectedCategory}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={cn(
              'inline-flex items-center rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors',
              !selectedSection
                ? 'border-primary bg-primary/10 text-primary dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200'
                : 'border-slate-200 text-slate-700 hover:border-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500/30',
            )}
            onClick={() => setSelectedSection('')}
          >
            Усі розділи
          </button>

          <button
            type="button"
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-500/30"
            onClick={() => setSectionsOpen((value) => !value)}
          >
            {selectedSection ? `Розділ ${selectedSection}` : 'Вибрати окремий розділ'}
            <ChevronDown className={cn('ml-2 h-4 w-4 transition-transform', sectionsOpen && 'rotate-180')} />
          </button>

          {selectedSection && (
            <span className="text-sm text-slate-500 dark:text-slate-300">
              {selectedSection}. {selectedSectionTitle}
            </span>
          )}
        </div>

        {error ? (
          <div className="mt-4 rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
            Не вдалося завантажити розділи. Перевірте backend і CORS на `http://localhost:8000`.
          </div>
        ) : null}

        {sectionsOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-[26px] border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/85"
          >
            {isLoading ? (
              <p className="px-2 py-5 text-sm text-slate-500 dark:text-slate-300">Завантаження розділів...</p>
            ) : (
              <div className="grid max-h-[340px] gap-2 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    className={cn(
                      'rounded-2xl border bg-white px-4 py-3 text-left text-sm font-semibold transition-all duration-200 dark:bg-slate-950',
                      selectedSection === section.id
                        ? 'border-primary bg-primary/10 text-primary dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200'
                        : 'border-slate-200 text-slate-700 hover:border-primary/30 dark:border-slate-700 dark:text-slate-200 dark:hover:border-sky-500/30',
                    )}
                    onClick={() => {
                      setSelectedSection(section.id);
                      setSectionsOpen(false);
                    }}
                  >
                    <span className="block text-slate-900 dark:text-white">{section.id}. {section.title}</span>
                    <span className="mt-1 block text-xs font-medium text-slate-400 dark:text-slate-400">{section.count} питань</span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-primary/15 bg-white px-6 py-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-950/92">
        <div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-300">Готово до старту</p>
          <h3 className="mt-1 text-2xl font-extrabold tracking-[-0.03em] text-slate-900 dark:text-white">{currentMode.label}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-300">
            Категорія {selectedCategory}
            {selectedSection ? `, розділ ${selectedSection}` : ', усі доступні розділи'}
          </p>
        </div>
        <Button className="h-12 rounded-full px-8 text-base shadow-[0_14px_30px_rgba(20,107,255,0.22)]" onClick={handleStart}>
          Почати
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
